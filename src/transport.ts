import { ChatError, type Transport } from "./types.ts";

export interface FetchTransportOptions {
  headers?: Record<string, string>;
  /** Shape the JSON request body. Default: `{ messages }`. */
  body?: (messages: Parameters<Transport>[0]) => unknown;
}

/**
 * POSTs `{ messages }` as JSON and streams the plain-text response body as
 * chunks. Maps HTTP failures to ChatError kinds (429 -> rateLimited with
 * Retry-After, 413 -> tooLarge, 5xx -> upstream, other -> badRequest).
 */
export function fetchTransport(url: string, opts: FetchTransportOptions = {}): Transport {
  return async function* (messages, { signal }) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...opts.headers },
        body: JSON.stringify(opts.body ? opts.body(messages) : { messages }),
        signal,
      });
    } catch (err) {
      if (signal.aborted) throw err;
      throw new ChatError("network", err instanceof Error ? err.message : "Network error");
    }
    if (!res.ok) {
      if (res.status === 429)
        throw new ChatError("rateLimited", "Rate limited", Number(res.headers.get("Retry-After")) || 60);
      if (res.status === 413) throw new ChatError("tooLarge", "Conversation too large");
      if (res.status >= 500) throw new ChatError("upstream", `Status ${res.status}`);
      throw new ChatError("badRequest", `Status ${res.status}`);
    }
    if (!res.body) throw new ChatError("upstream", "No response body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
      const tail = decoder.decode();
      if (tail) yield tail;
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  };
}
