"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

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
  () => import("@/components/common/chat/markdown/MarkdownRenderer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    ),
  },
);

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = "Enter markdown content...",
  disabled = false,
  className = "",
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<"source" | "preview">("source");
  const [previewLoading, setPreviewLoading] = useState(false);

  // Detect dark mode for Monaco editor
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

  const handleTabChange = (newTab: string) => {
    if (newTab === "preview") {
      setPreviewLoading(true);
      // Simulate loading time for markdown rendering
      setTimeout(() => setPreviewLoading(false), 100);
    }
    setActiveTab(newTab as "source" | "preview");
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className={`w-full h-full ${className}`}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="source">Source</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>

      <TabsContent value="source" className="mt-2 h-full">
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
      </TabsContent>

      <TabsContent value="preview" className="mt-2 h-full">
        <div className="w-full h-full border rounded-md p-4 overflow-auto">
          {previewLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <MarkdownRenderer content={value} />
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
