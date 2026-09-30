export type Role = "user" | "assistant";

export interface FileInfo {
  name: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  files?: FileInfo[];
}

/** idle -> sending (waiting for first chunk) -> streaming -> idle | error */
export type Status = "idle" | "sending" | "streaming" | "error";

export type ChatErrorKind =
  | "network"
  | "upstream"
  | "rateLimited"
  | "tooLarge"
  | "badRequest"
  | "unknown";

export class ChatError extends Error {
  kind: ChatErrorKind;
  retryAfterSec: number;
  constructor(kind: ChatErrorKind, message: string, retryAfterSec = 0) {
    super(message);
    this.name = "ChatError";
    this.kind = kind;
    this.retryAfterSec = retryAfterSec;
  }
}

/** What the transport sees: role + content only (no ids). */
export type WireMessage = Pick<Message, "role" | "content">;

export interface SendOptions {
  signal: AbortSignal;
  files?: File[];
}

/** Caller-supplied backend. Return the full reply, or stream it as chunks. */
export type Transport = (
  messages: WireMessage[],
  options: SendOptions,
) => Promise<string> | AsyncIterable<string>;
