import { useNoPasteTextarea } from "@/hooks/use-no-paste-textarea";
import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";

// Test component to use the hook
function TestComponent() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [pasteAttempts, setPasteAttempts] = useState(0);

  const pastePrevention = useNoPasteTextarea(textareaRef, {
    onPasteAttempt: () => setPasteAttempts((prev) => prev + 1),
    enableBurstDetection: true,
    maxBurstSize: 1,
  });

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) =>
          pastePrevention.handleChange(e, setValue, (val) => val)
        }
        onPaste={pastePrevention.handlePaste}
        onDrop={pastePrevention.handleDrop}
        onContextMenu={pastePrevention.handleContextMenu}
        onMouseDown={pastePrevention.handleMouseDown}
        onKeyDown={(e) => pastePrevention.handleKeyDown(e)}
        onCompositionStart={pastePrevention.handleCompositionStart}
        onCompositionEnd={pastePrevention.handleCompositionEnd}
        data-testid="textarea"
      />
      <div data-testid="paste-attempts">{pasteAttempts}</div>
      <div data-testid="value">{value}</div>
    </div>
  );
}

describe("useNoPasteTextarea", () => {
  it("should prevent paste events", () => {
    render(<TestComponent />);

    const textarea = screen.getByTestId("textarea");
    const pasteAttempts = screen.getByTestId("paste-attempts");

    // Simulate paste event
    fireEvent.paste(textarea, {
      clipboardData: {
        getData: () => "pasted text",
      },
    });

    expect(pasteAttempts).toHaveTextContent("1");
  });

  it("should prevent drop events", () => {
    render(<TestComponent />);

    const textarea = screen.getByTestId("textarea");
    const pasteAttempts = screen.getByTestId("paste-attempts");

    // Simulate drop event
    fireEvent.drop(textarea, {
      dataTransfer: {
        getData: () => "dropped text",
      },
    });

    expect(pasteAttempts).toHaveTextContent("1");
  });

  it("should prevent context menu", () => {
    render(<TestComponent />);

    const textarea = screen.getByTestId("textarea");

    // Simulate context menu event
    const contextMenuEvent = fireEvent.contextMenu(textarea);

    expect(contextMenuEvent).toBe(false); // Should be prevented
  });

  it("should allow normal typing", () => {
    render(<TestComponent />);

    const textarea = screen.getByTestId("textarea");
    const valueDisplay = screen.getByTestId("value");

    // Type normally
    fireEvent.change(textarea, { target: { value: "hello" } });

    expect(valueDisplay).toHaveTextContent("hello");
  });
});
