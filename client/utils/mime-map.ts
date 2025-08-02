/**
 * mime-map.ts
 * MIME type mapping and inference utilities for document handling
 * Handles code files and other text-based formats that browsers don't set properly
 */

export const EXT_MIME_MAP: Record<string, string> = {
  ".java": "text/x-java-source",
  ".py": "text/x-python",
  ".c": "text/x-c",
  ".h": "text/x-c",
  ".cpp": "text/x-c++src",
  ".hpp": "text/x-c++hdr",
  ".cc": "text/x-c++src",
  ".cs": "text/x-csharp",
  ".js": "text/javascript",
  ".jsx": "text/javascript",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".mjs": "text/javascript",
  ".cjs": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".scss": "text/x-scss",
  ".md": "text/markdown",
  ".json": "application/json",
  ".yml": "application/x-yaml",
  ".yaml": "application/x-yaml",
  ".xml": "application/xml",
  ".sh": "text/x-shellscript",
  ".bash": "text/x-shellscript",
  ".zsh": "text/x-shellscript",
  ".rb": "text/x-ruby",
  ".go": "text/x-go",
  ".rs": "text/rust",
  ".kt": "text/x-kotlin",
  ".swift": "text/x-swift",
  ".m": "text/x-objectivec",
  ".mm": "text/x-objectivec",
  ".sql": "application/sql",
  ".ipynb": "application/x-ipynb+json",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

export function inferMimeFromName(
  name: string,
  fallback = "text/plain"
): string {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return fallback;
  const ext = name.slice(dot).toLowerCase();
  return EXT_MIME_MAP[ext] || fallback;
}

// Set of known code file extensions for viewer logic
export const CODE_EXTS = new Set([
  ".java",
  ".py",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cc",
  ".cs",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".md",
  ".json",
  ".yml",
  ".yaml",
  ".xml",
  ".sh",
  ".bash",
  ".zsh",
  ".rb",
  ".go",
  ".rs",
  ".kt",
  ".swift",
  ".m",
  ".mm",
  ".sql",
  ".txt",
  ".csv",
  ".ipynb",
]);

export function isCodeByName(name?: string | null): boolean {
  if (!name) return false;
  const dot = name.lastIndexOf(".");
  if (dot === -1) return false;
  return CODE_EXTS.has(name.slice(dot).toLowerCase());
}

// Language mapping for Monaco editor
export function languageFromName(name?: string): string {
  if (!name) return "plaintext";
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, string> = {
    java: "java",
    py: "python",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    hpp: "cpp",
    cs: "csharp",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    html: "html",
    css: "css",
    scss: "scss",
    md: "markdown",
    json: "json",
    yml: "yaml",
    yaml: "yaml",
    xml: "xml",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    rb: "ruby",
    go: "go",
    rs: "rust",
    kt: "kotlin",
    swift: "swift",
    sql: "sql",
    txt: "plaintext",
    csv: "csv",
  };
  return map[ext] || "plaintext";
}
