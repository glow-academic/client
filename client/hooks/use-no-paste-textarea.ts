import { useEffect, useRef } from "react";

interface UseNoPasteTextareaOptions {
  onPasteAttempt?: () => void;
  enableBurstDetection?: boolean;
  maxBurstSize?: number;
}

export function useNoPasteTextarea(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  options: UseNoPasteTextareaOptions = {},
) {
  const {
    onPasteAttempt,
    enableBurstDetection = true,
    maxBurstSize = 1,
  } = options;

  const prevValueRef = useRef<string>("");
  const isComposingRef = useRef<boolean>(false);

  // Update previous value reference
  const updatePrevValue = (value: string) => {
    prevValueRef.current = value;
  };

  // Global paste guard (capture phase) just for this textarea
  useEffect(() => {
    const onDocPaste = (e: ClipboardEvent) => {
      if (document.activeElement === textareaRef.current) {
        e.preventDefault();
        onPasteAttempt?.();
      }
    };
    document.addEventListener("paste", onDocPaste, true);
    return () => document.removeEventListener("paste", onDocPaste, true);
  }, [textareaRef, onPasteAttempt]);

  // Block middle-click paste (Linux/X11 primary selection)
  const handleMouseDown = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (e.button === 1) {
      e.preventDefault(); // middle button
      onPasteAttempt?.();
    }
  };

  // Block paste/drop at the earliest stage
  const handleBeforeInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const nativeEvent = e.nativeEvent as InputEvent;
    const inputType = nativeEvent?.inputType as string | undefined;
    // Covers desktop + mobile long-press
    if (
      inputType &&
      (inputType.startsWith("insertFromPaste") ||
        inputType === "insertFromDrop")
    ) {
      e.preventDefault();
      onPasteAttempt?.();
    }
  };

  // Kill context menu (mouse + long-press)
  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  };

  // Block paste events
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    onPasteAttempt?.();
  };

  const handlePasteCapture = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    onPasteAttempt?.();
  };

  // Block drop events
  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    onPasteAttempt?.();
  };

  // Enhanced keydown handler with burst detection
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    onSendMessage?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void,
  ) => {
    const isModifier = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    const isPasteShortcut =
      (isModifier && key === "v") || (e.shiftKey && e.key === "Insert");

    if (isPasteShortcut) {
      e.preventDefault();
      onPasteAttempt?.();
      return;
    }

    // Let IME compose; let Enter submit
    if (e.key === "Enter" && !e.shiftKey && !isComposingRef.current) {
      onSendMessage?.(e);
    }
  };

  // Enhanced change handler with burst detection
  const handleChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
    onValueChange: (value: string) => void,
    sanitizeInput?: (value: string) => string,
  ) => {
    const next = e.target.value;
    const prev = prevValueRef.current;
    const delta = next.length - prev.length;

    // Update composition state
    isComposingRef.current = (e.nativeEvent as InputEvent).isComposing || false;

    // Fallback "burst" guard: if inserted > maxBurstSize chars and not during composition, revert
    if (
      enableBurstDetection &&
      !isComposingRef.current &&
      delta > maxBurstSize
    ) {
      // Revert DOM to previous value
      e.target.value = prev;
      onPasteAttempt?.();
      return; // keep state as-is
    }

    // Apply sanitization if provided
    const sanitizedValue = sanitizeInput ? sanitizeInput(next) : next;
    onValueChange(sanitizedValue);
    updatePrevValue(sanitizedValue);
  };

  // Composition event handlers for IME support
  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
  };

  return {
    handleMouseDown,
    handleBeforeInput,
    handleContextMenu,
    handlePaste,
    handlePasteCapture,
    handleDrop,
    handleKeyDown,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    updatePrevValue,
  };
}
