"use client";
import { languageFromName } from "@/utils/mime-map";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

// Dynamically import Monaco to avoid SSR issues
const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
    </div>
  ),
});

export interface CodeViewerProps {
  name?: string;
  value: string;
}

export default function CodeViewer({ name, value }: CodeViewerProps) {
  const lang = useMemo(() => languageFromName(name), [name]);
  // Detect dark mode on first render to avoid theme flash
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");

  useEffect(() => {
    // Check for dark mode preference on mount
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

  return (
    <div className="w-full h-full p-3 min-h-[300px]" style={{ height: "100%" }}>
      <Monaco
        height="100%"
        defaultLanguage={lang}
        value={value}
        theme={theme}
        options={{
          readOnly: true,
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
        }}
      />
    </div>
  );
}
