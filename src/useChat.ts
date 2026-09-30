import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatError,
  type Message,
  type Status,
  type Transport,
} from "./types.ts";

export interface UseChatOptions {
  send: Transport;
  /** sessionStorage key. Omit to skip persistence. */
  storageKey?: string;
  initialMessages?: Message[];
}

export interface UseChat {
  messages: Message[];
  status: Status;
  error: ChatError | null;
  send: (text: string, files?: File[]) => Promise<void>;
  stop: () => void;
  clear: () => void;
}

// Bump when the persisted shape changes; mismatched data is dropped.
const VERSION = 1;

function load(key?: string): Message[] | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== VERSION || !Array.isArray(parsed.messages)) return null;
    return parsed.messages;
  } catch {
    return null;
  }
}

function save(key: string | undefined, messages: Message[]) {
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ version: VERSION, messages }));
  } catch {
    // quota or disabled storage: ignore
  }
}

let counter = 0;
const newId = () => `m${Date.now().toString(36)}-${counter++}`;

export function useChat({ send: transport, storageKey, initialMessages }: UseChatOptions): UseChat {
  const [messages, setMessagesState] = useState<Message[]>(
    () => load(storageKey) ?? initialMessages ?? [],
  );
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<ChatError | null>(null);

  // Mirror of messages so send() never reads stale state.
  const msgsRef = useRef(messages);
  const setMessages = useCallback((m: Message[]) => {
    msgsRef.current = m;
    setMessagesState(m);
  }, []);
  const abortRef = useRef<AbortController | null>(null);
  const transportRef = useRef(transport);
  transportRef.current = transport;

  const stop = useCallback(() => abortRef.current?.abort(), []);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string, files?: File[]) => {
      const trimmed = text.trim();
      if (!trimmed && !files?.length) return;
      if (abortRef.current) return; // one request at a time

      const controller = new AbortController();
      abortRef.current = controller;

      const user: Message = {
        id: newId(),
        role: "user",
        content: trimmed,
        ...(files?.length && {
          files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
        }),
      };
      const assistant: Message = { id: newId(), role: "assistant", content: "" };
      const history = [...msgsRef.current, user];
      setMessages([...history, assistant]);
      setStatus("sending");
      setError(null);
      save(storageKey, history);

      let acc = "";
      const show = () =>
        setMessages(
          msgsRef.current.map((m) => (m.id === assistant.id ? { ...m, content: acc } : m)),
        );

      try {
        const result = transportRef.current(
          history.map(({ role, content }) => ({ role, content })),
          { signal: controller.signal, files },
        );
        if (typeof (result as Promise<string>).then === "function") {
          acc = await (result as Promise<string>);
          if (!controller.signal.aborted) show();
        } else {
          for await (const chunk of result as AsyncIterable<string>) {
            if (controller.signal.aborted) break;
            acc += chunk;
            setStatus("streaming");
            show();
          }
        }
        if (abortRef.current === controller) setStatus("idle");
      } catch (err) {
        if (abortRef.current !== controller) {
          // cleared or superseded: leave state alone
        } else if (controller.signal.aborted) {
          setStatus("idle");
        } else {
          setError(
            err instanceof ChatError
              ? err
              : new ChatError("unknown", err instanceof Error ? err.message : String(err)),
          );
          setStatus("error");
        }
      } finally {
        // Keep partial text; drop an empty placeholder. Persist once per
        // request, never per chunk.
        if (abortRef.current === controller) {
          const final = acc ? [...history, { ...assistant, content: acc }] : history;
          setMessages(final);
          save(storageKey, final);
          abortRef.current = null;
        }
      }
    },
    [storageKey, setMessages],
  );

  const clear = useCallback(() => {
    const c = abortRef.current;
    abortRef.current = null;
    c?.abort();
    setMessages([]);
    setStatus("idle");
    setError(null);
    if (storageKey) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }, [storageKey, setMessages]);

  return { messages, status, error, send, stop, clear };
}
