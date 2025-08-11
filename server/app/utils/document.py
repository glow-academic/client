import os
import uuid
from typing import List

import pypdf  # type: ignore
from agents.items import TResponseInputItem
from app.extensions import UPLOAD_FOLDER
from app.models import Documents
from sqlmodel import Session, select


def _read_document_content(file_path: str) -> str:
    """Read and return textual content from a document at UPLOAD_FOLDER/file_path.

    Supports PDFs (via pypdf) and text files with UTF-8 fallback to latin-1.
    """
    full_path = os.path.join(UPLOAD_FOLDER, file_path)

    content = ""
    if file_path.lower().endswith(".pdf"):
        try:
            with open(full_path, "rb") as file:  # noqa: PTH123
                pdf_reader = pypdf.PdfReader(file)
                for page in pdf_reader.pages:
                    # extract_text may return None; guard for safety
                    page_text = page.extract_text() or ""
                    content += page_text + "\n"
        except Exception as e:  # pragma: no cover - surfaced to caller
            raise ValueError(f"Error reading PDF file {file_path}: {str(e)}")
    else:
        try:
            with open(full_path, "r", encoding="utf-8") as file:  # noqa: PTH123
                content = file.read()
        except UnicodeDecodeError:
            try:
                with open(full_path, "r", encoding="latin-1") as file:  # noqa: PTH123
                    content = file.read()
            except Exception as e:  # pragma: no cover - surfaced to caller
                raise ValueError(f"Error reading text file {file_path}: {str(e)}")
        except Exception as e:  # pragma: no cover - surfaced to caller
            raise ValueError(f"Error reading file {file_path}: {str(e)}")

    return content.strip()


def get_document_info(document_ids: List[uuid.UUID], session: Session) -> TResponseInputItem:
    """Create a comprehensive message for the given documents in the order provided.

    Includes document name, MIME type, tags, and extracted textual content.
    """
    # Fetch all requested documents, then preserve input order
    documents = session.exec(select(Documents).where(Documents.id.in_(document_ids))).all()
    if not documents:
        raise ValueError(f"Documents not found for document ids {document_ids}")

    by_id = {doc.id: doc for doc in documents}

    sections: list[str] = []
    for idx, doc_id in enumerate(document_ids, start=1):
        document = by_id.get(doc_id)
        if not document:
            # Skip missing docs quietly to keep order for others
            continue

        tags_display = ", ".join(document.tags or [])
        content = _read_document_content(document.file_path)

        section = (
            f"--- Document {idx} ---\n"
            f"Name: {document.name}\n"
            f"File Type: {document.mime_type}\n"
            f"Tags: {tags_display if tags_display else 'None'}\n"
            f"Content:\n{content}\n"
        )
        sections.append(section)

    message = "The following documents are provided in order:"\
        + ("\n" + "\n".join(sections) if sections else "\nNone")

    return {"role": "user", "content": message}
