import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ChatError, Message, Status } from "./types.ts";

export interface ChatPanelProps {
  messages: Message[];
  onSend: (text: string, files?: File[]) => void;
  status?: Status;
  placeholder?: string;
  renderMessage?: (message: Message) => ReactNode;
  allowUpload?: boolean;
  /** Passing this shows a Stop button while busy. */
  onStop?: () => void;
  error?: ChatError | null;
  /** Accessible label for the input. */
  label?: string;
  accept?: string;
  className?: string;
}

export function ChatPanel({
  messages,
  onSend,
  status = "idle",
  placeholder = "Type a message",
  renderMessage,
  allowUpload,
  onStop,
  error,
  label = "Message",
  accept = "image/*,video/*",
  className,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = status === "sending" || status === "streaming";

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // A disabled textarea drops focus; give it back when the reply finishes.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) inputRef.current?.focus();
    wasBusy.current = busy;
  }, [busy]);

  function submit() {
    if (busy || (!text.trim() && !files.length)) return;
    onSend(text, files.length ? files : undefined);
    setText("");
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className={`chatui${className ? ` ${className}` : ""}`}>
      <div
        ref={listRef}
        className="chatui-messages"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        aria-busy={busy}
      >
        {messages.map((m) =>
          renderMessage ? (
            <div key={m.id}>{renderMessage(m)}</div>
          ) : (
            <div key={m.id} className={`chatui-message chatui-${m.role}`}>
              <span className="chatui-sr">{m.role === "user" ? "You: " : "Assistant: "}</span>
              {m.content}
              {m.files?.map((f) => (
                <span key={f.name} className="chatui-file">
                  {f.name}
                </span>
              ))}
            </div>
          ),
        )}
      </div>
      {error && (
        <div className="chatui-error" role="alert">
          {error.message}
        </div>
      )}
      <form
        className="chatui-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={inputRef}
          className="chatui-input"
          aria-label={label}
          placeholder={placeholder}
          rows={1}
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {allowUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={accept}
              aria-label="Attach file"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <button
              type="button"
              className="chatui-button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {files.length ? `${files.length} attached` : "Attach"}
            </button>
          </>
        )}
        {busy && onStop ? (
          <button type="button" className="chatui-button" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="chatui-button chatui-primary" disabled={busy}>
            Send
          </button>
        )}
      </form>
    </div>
  );
}
