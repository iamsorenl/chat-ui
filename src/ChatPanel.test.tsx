import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel.tsx";

describe("ChatPanel", () => {
  it("sends on Enter, newline on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<ChatPanel messages={[]} onSend={onSend} />);
    const box = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "hi\nthere" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("hi\nthere", undefined);
    expect(box.value).toBe("");
  });

  it("is disabled while sending", () => {
    render(<ChatPanel messages={[]} onSend={() => {}} status="streaming" />);
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses renderMessage and exposes a live log", () => {
    render(
      <ChatPanel
        messages={[{ id: "1", role: "assistant", content: "yo" }]}
        onSend={() => {}}
        renderMessage={(m) => <b data-testid="custom">{m.content}!</b>}
      />,
    );
    expect(screen.getByTestId("custom").textContent).toBe("yo!");
    expect(screen.getByRole("log").getAttribute("aria-live")).toBe("polite");
  });
});
