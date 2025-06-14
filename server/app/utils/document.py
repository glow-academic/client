import uuid
from typing import List

from app.models import Documents
from sqlmodel import Session, select


def get_document_info(document_ids: List[uuid.UUID], session: Session) -> dict[str, str]:
    """
    Get the document information for a given document ids.
    """

    document_info = session.exec(
        select(Documents).where(Documents.id.in_(document_ids))
    ).all()
    if not document_info:
        raise ValueError(f"Documents not found for document ids {document_ids}")

    document_info_string = "\n".join(
        [
            f"Document Name: {document.name}\nDocument File Type: {document.mime_type}"
            for document in document_info
        ]
    )

    return {
        "role": "assistant",
        "content": f"The following is the document information: {document_info_string}",
    }
    
