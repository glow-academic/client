"use client";

import dynamic from "next/dynamic";
import React, { useState } from "react";

// Dynamically import Monaco to avoid SSR issues
const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
    </div>
  ),
});

// Dynamically import markdown renderer to avoid SSR issues
const MarkdownRenderer = dynamic(
  () => import("@/components/common/viewers/MarkdownRenderer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    ),
  }
);

export type EditorMode = "editor" | "preview" | "debug";

export interface UnifiedPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  debugContent?: React.ReactNode;
  activeMode?: EditorMode;
}

export default function UnifiedPromptEditor({
  value,
  onChange,
  placeholder = "Enter markdown content...",
  disabled = false,
  className = "",
  debugContent,
  activeMode: externalActiveMode,
}: UnifiedPromptEditorProps) {
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");

  const activeMode = externalActiveMode || "editor";

  // Detect dark mode for Monaco editor
  React.useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      setTheme("vs-dark");
    } else {
      setTheme("light");
    }
  }, []);

  const renderContent = () => {
    switch (activeMode) {
      case "preview":
        return (
          <div className="w-full h-full border rounded-md p-4 overflow-auto">
            <MarkdownRenderer content={value} />
          </div>
        );
      case "debug":
        return (
          <div className="w-full h-full overflow-auto">
            {debugContent || (
              <div className="text-muted-foreground italic">
                No debug information available
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="w-full h-full">
            <Monaco
              height="100%"
              defaultLanguage="markdown"
              value={value}
              onChange={(val) => onChange(val || "")}
              theme={theme}
              options={{
                readOnly: disabled,
                wordWrap: "on",
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                folding: true,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 3,
                renderLineHighlight: "all",
                selectOnLineNumbers: true,
                roundedSelection: false,
                scrollbar: {
                  vertical: "visible",
                  horizontal: "visible",
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8,
                },
                placeholder: placeholder,
              }}
            />
          </div>
        );
    }
  };

  return (
    <div className={`w-full h-full ${className}`}>
      {/* Content area */}
      <div className="h-full">{renderContent()}</div>
    </div>
  );
}
