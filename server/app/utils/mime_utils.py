"""
MIME type utilities for server-side document handling
"""

import mimetypes
from typing import Optional

# Extension to MIME type mapping for code files
EXT_MIME_MAP = {
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
}

def infer_mime_from_name(filename: str, fallback: str = "text/plain") -> str:
    """
    Infer MIME type from filename extension
    """
    if not filename:
        return fallback
    
    dot = filename.rfind(".")
    if dot == -1:
        return fallback
    
    ext = filename[dot:].lower()
    return EXT_MIME_MAP.get(ext, fallback)

def get_content_type(filename: str, mime_type: Optional[str] = None) -> str:
    """
    Get the best content type for a file, using MIME type inference if needed
    """
    if mime_type and mime_type != "application/octet-stream":
        return mime_type
    
    # If no MIME type or it's generic, infer from filename
    inferred_type = infer_mime_from_name(filename)
    
    # If we still don't have a good type, try Python's mimetypes
    if inferred_type == "text/plain":
        python_guess = mimetypes.guess_type(filename)[0]
        if python_guess:
            return python_guess
    
    return inferred_type 