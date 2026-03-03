"""Read textual content from a document for similarity scoring."""

import os

import pypdf  # type: ignore

from app.infra.globals import UPLOAD_FOLDER


def read_document_content_for_similarity(file_path: str) -> str:
    """Read textual content from a document under UPLOAD_FOLDER for similarity scoring.

    - PDFs: extract per-page text via pypdf
    - Text files: read with UTF-8, fallback to latin-1
    """
    full_path = os.path.join(UPLOAD_FOLDER, file_path)
    content = ""
    if file_path.lower().endswith(".pdf"):
        try:
            with open(full_path, "rb") as fh:  # noqa: PTH123
                reader = pypdf.PdfReader(fh)
                for page in reader.pages:
                    content += (page.extract_text() or "") + "\n"
        except Exception:
            return ""
    else:
        try:
            with open(full_path, encoding="utf-8") as fh:  # noqa: PTH123
                content = fh.read()
        except UnicodeDecodeError:
            try:
                with open(full_path, encoding="latin-1") as fh:  # noqa: PTH123
                    content = fh.read()
            except Exception:
                return ""
        except Exception:
            return ""

    return content.strip()
