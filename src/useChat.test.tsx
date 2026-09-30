import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useChat } from "./useChat.ts";
import { ChatError } from "./types.ts";

beforeEach(() => sessionStorage.clear());

describe("useChat", () => {
  it("appends user and assistant messages from a string reply", async () => {
    const { result } = renderHook(() => useChat({ send: async () => "hello" }));
    await act(() => result.current.send("hi"));
    expect(result.current.messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "hi"],
      ["assistant", "hello"],
    ]);
    expect(result.current.status).toBe("idle");
  });

  it("streams chunks and passes wire messages without ids", async () => {
    let seen: unknown;
    const send = (msgs: unknown) => {
      seen = msgs;
      return (async function* () {
        yield "a";
        yield "b";
      })();
    };
    const { result } = renderHook(() => useChat({ send }));
    await act(() => result.current.send("go"));
    expect(result.current.messages[1]?.content).toBe("ab");
    expect(seen).toEqual([{ role: "user", content: "go" }]);
  });

  it("aborts and keeps partial text", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const send = () =>
      (async function* () {
        yield "part";
        await gate;
        yield "never";
      })();
    const { result } = renderHook(() => useChat({ send }));
    let p!: Promise<void>;
    act(() => {
      p = result.current.send("x");
    });
    await waitFor(() => expect(result.current.messages[1]?.content).toBe("part"));
    act(() => result.current.stop());
    release();
    await act(() => p);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.messages[1]?.content).toBe("part");
  });

  it("surfaces errors and drops the empty placeholder", async () => {
    const send = async () => {
      throw new ChatError("rateLimited", "slow down", 30);
    };
    const { result } = renderHook(() => useChat({ send }));
    await act(() => result.current.send("x"));
    expect(result.current.status).toBe("error");
    expect(result.current.error?.kind).toBe("rateLimited");
    expect(result.current.messages).toHaveLength(1);
  });

  it("persists to sessionStorage and restores; clear wipes it", async () => {
    const opts = { send: async () => "yo", storageKey: "k" };
    const a = renderHook(() => useChat(opts));
    await act(() => a.result.current.send("hey"));
    a.unmount();
    const b = renderHook(() => useChat(opts));
    expect(b.result.current.messages.map((m) => m.content)).toEqual(["hey", "yo"]);
    act(() => b.result.current.clear());
    expect(b.result.current.messages).toEqual([]);
    expect(sessionStorage.getItem("k")).toBeNull();
  });
});
