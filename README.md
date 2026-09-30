# chat-ui

A small React chat kit. A headless hook, a plain-CSS panel, and one fetch helper. No runtime dependencies besides React.

```
npm i github:iamsorenl/chat-ui
```

| Piece | Import | What it does |
|---|---|---|
| `useChat` | `chat-ui/useChat` | State for a chat: messages, status, error, send, stop, clear. You supply the backend call. |
| `ChatPanel` | `chat-ui/ChatPanel` | Message list and input box. Works with `useChat` or your own state. |
| `fetchTransport` | `chat-ui/transport` | Posts `{ messages }` as JSON and streams the plain-text reply. Optional. |
| styles | `chat-ui/styles.css` | Default look, themed with `--chatui-*` CSS variables. Optional. |

Everything is also exported from `chat-ui`.

## Usage

```tsx
import { useChat, ChatPanel, fetchTransport } from "chat-ui";
import "chat-ui/styles.css";

export function Chat() {
  const chat = useChat({
    send: fetchTransport("/api/chat"),
    storageKey: "my-chat", // optional: keeps the chat in sessionStorage
  });
  return (
    <div style={{ height: 500 }}>
      <ChatPanel
        messages={chat.messages}
        status={chat.status}
        error={chat.error}
        onSend={chat.send}
        onStop={chat.stop}
        allowUpload
      />
    </div>
  );
}
```

## Your own backend

`send` is `(messages, { signal, files }) => Promise<string> | AsyncIterable<string>`. Return the whole reply, or yield chunks to stream it. Throw a `ChatError` (with a `kind` such as `rateLimited`) to get a useful `error`; any other throw becomes kind `unknown`.

```ts
useChat({ send: async (messages, { signal }) => (await callMyModel(messages, signal)).text });
```

## ChatPanel props

`messages`, `onSend(text, files?)`, `status`, `placeholder`, `renderMessage(message)`, `allowUpload`, `onStop`, `error`, `label`, `accept`, `className`. Enter sends, Shift+Enter adds a newline, the input is disabled while a reply is running, the list is an `aria-live` log, and focus returns to the input when a reply finishes.

## Notes

- `status` is `idle | sending | streaming | error`.
- Only one request runs at a time. `stop()` keeps any partial reply.
- Uploaded files are handed to `send` as `File[]`; only their name, type and size are stored in messages and sessionStorage.

MIT
