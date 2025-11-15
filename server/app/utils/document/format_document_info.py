"""Build a structured list of per-document, per-page text and optional images."""

import os
from typing import Any

from agents.items import TResponseInputItem
from openai.types.responses.response_input_image_param import ResponseInputImageParam
from openai.types.responses.response_input_item_param import Message
from openai.types.responses.response_input_message_content_list_param import (
    ResponseInputMessageContentListParam,
)
from openai.types.responses.response_input_text_param import ResponseInputTextParam

from app.main import UPLOAD_FOLDER
from app.utils.document.pdf_pages_to_image_data_urls import pdf_pages_to_image_data_urls
from app.utils.document.read_pdf_text_pages import read_pdf_text_pages
from app.utils.document.read_text_file import read_text_file


def format_document_info(
    documents: list[dict[str, Any]], show_images: bool = False
) -> TResponseInputItem:
    """Build a structured list of per-document, per-page text and optional images.

    Order per document: docN-image-pageM, then docN-text-pageM. If images are
    unavailable or disabled, only include docN-text-pageM.

    Args:
        documents: List of dicts with keys: id, name, file_path, mime_type
        show_images: Whether to include images in the output

    Returns:
        TResponseInputItem formatted for agent input
    """
    if not documents:
        # Return a minimal message if no documents provided
        msg: Message = {
            "role": "user",
            "content": [{"type": "input_text", "text": "No documents provided"}],
        }
        return msg

    content_items: ResponseInputMessageContentListParam = []

    for doc_index, document in enumerate(documents, start=1):
        if not document:
            # Skip missing docs quietly to keep order for others
            continue

        full_path = os.path.join(UPLOAD_FOLDER, document["file_path"])
        # Note: document.tags removed in BCNF migration (now via simulation_tags)
        tags_display = ""  # document.tags removed
        mime_lower = (document.get("mime_type") or "").lower()

        is_pdf = document["file_path"].lower().endswith(".pdf") or "pdf" in mime_lower
        is_image = mime_lower.startswith("image/") or document[
            "file_path"
        ].lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif"))

        if is_pdf:
            # Per-page text via pypdf
            text_pages = read_pdf_text_pages(full_path)
            # Optional images via PyMuPDF if enabled
            image_urls = pdf_pages_to_image_data_urls(full_path) if show_images else []

            total_pages = (
                max(len(text_pages), len(image_urls))
                if show_images
                else len(text_pages)
            )
            for page_num in range(total_pages):
                # Image first if available
                if show_images and page_num < len(image_urls):
                    image_item: ResponseInputImageParam = {
                        "type": "input_image",
                        "detail": "auto",
                        "image_url": image_urls[page_num],
                    }
                    content_items.append(image_item)

                # Then text for this page (include minimal header/context)
                page_text = text_pages[page_num] if page_num < len(text_pages) else ""
                header = (
                    f"--- doc{doc_index}-text-page{page_num + 1} ---\n"
                    f"Name: {document['name']}\n"
                    f"File Type: {document.get('mime_type', 'unknown')}\n"
                    f"Tags: {tags_display if tags_display else 'None'}\n"
                    f"Content:\n"
                )
                text_item_page: ResponseInputTextParam = {
                    "type": "input_text",
                    "text": header + page_text,
                }
                content_items.append(text_item_page)
        elif is_image:
            # For image files, include the image only (no text)
            if show_images:
                try:
                    with open(full_path, "rb") as img_file:  # noqa: PTH123
                        img_bytes = img_file.read()
                    b64 = base64.b64encode(img_bytes).decode("ascii")
                    # Prefer MIME from record; fallback based on extension
                    mime_type = document.get("mime_type")
                    mime = (
                        mime_type
                        if (mime_type and mime_type.startswith("image/"))
                        else None
                    )
                    if not mime:
                        if document["file_path"].lower().endswith(".png"):
                            mime = "image/png"
                        elif document["file_path"].lower().endswith((".jpg", ".jpeg")):
                            mime = "image/jpeg"
                        elif document["file_path"].lower().endswith(".webp"):
                            mime = "image/webp"
                        elif document["file_path"].lower().endswith(".gif"):
                            mime = "image/gif"
                        else:
                            mime = "image/png"
                    img_item: ResponseInputImageParam = {
                        "type": "input_image",
                        "detail": "auto",
                        "image_url": f"data:{mime};base64,{b64}",
                    }
                    content_items.append(img_item)
                except Exception:
                    # If reading fails, skip the image silently
                    pass
            # If show_images is False, we add nothing for pure image docs
        else:
            # Treat other files as a single-page text document
            content = read_text_file(full_path)
            header = (
                f"--- doc{doc_index}-text-page1 ---\n"
                f"Name: {document['name']}\n"
                f"File Type: {document.get('mime_type', 'unknown')}\n"
                f"Tags: {tags_display if tags_display else 'None'}\n"
                f"Content:\n"
            )
            text_item_single: ResponseInputTextParam = {
                "type": "input_text",
                "text": header + content,
            }
            content_items.append(text_item_single)

    if not content_items:
        # Fallback to a minimal text item if nothing could be built
        content_items.append({"type": "input_text", "text": "No documents provided"})

    result_msg: Message = {"role": "user", "content": content_items}
    return result_msg

