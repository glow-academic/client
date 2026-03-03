"""Build a structured list of per-document, per-page text and optional images."""

import base64
import json
import os
from typing import Any

from openai.types.responses.response_input_image_param import ResponseInputImageParam
from openai.types.responses.response_input_item_param import Message
from openai.types.responses.response_input_message_content_list_param import (
    ResponseInputMessageContentListParam,
)
from openai.types.responses.response_input_text_param import ResponseInputTextParam

from app.v5.infra.agents.types import TResponseInputItem
from app.main import UPLOAD_FOLDER
from app.v5.utils.document.pdf_pages_to_image_data_urls import pdf_pages_to_image_data_urls
from app.v5.utils.document.read_pdf_text_pages import read_pdf_text_pages
from app.v5.utils.document.read_text_file import read_text_file


def _format_template_args_notice(template_args: Any) -> str:
    """Format template arguments schema as a readable notice.

    Args:
        template_args: Template args dict with 'name' and 'fields' keys, or JSON string

    Returns:
        Formatted string describing the template and its required arguments
    """
    if not template_args:
        return ""

    # Parse template_args if it's a string
    parsed_args: dict[str, Any] | None = None
    if isinstance(template_args, str):
        try:
            parsed_args = json.loads(template_args)
        except json.JSONDecodeError:
            return ""
    elif isinstance(template_args, dict):
        parsed_args = template_args
    else:
        return ""

    if not parsed_args:
        return ""

    schema_name = parsed_args.get("name", "Template")
    fields = parsed_args.get("fields", [])

    if not fields:
        return f"⚠️ TEMPLATE DOCUMENT: This is a template document ({schema_name}) with template arguments that need to be filled.\n\n"

    # Build field descriptions
    field_descriptions = []
    for field in fields:
        field_name = field.get("name", "")
        field_type = field.get("type", "string")
        required = field.get("required", False)
        description = field.get("description", "")
        placeholder = field.get("placeholder", "")
        required_str = " (required)" if required else " (optional)"

        field_desc = f"  - {field_name}: {field_type}{required_str}"
        if description:
            field_desc += f"\n    Description: {description}"
        if placeholder:
            field_desc += f"\n    Example: {placeholder}"

        field_descriptions.append(field_desc)

    fields_text = "\n".join(field_descriptions)

    notice = (
        f"⚠️ TEMPLATE DOCUMENT: This is a template document ({schema_name}) with the following template arguments:\n\n"
        f"{fields_text}\n\n"
    )

    return notice


def format_document_info(
    documents: list[dict[str, Any]], show_images: bool = False
) -> TResponseInputItem:
    """Build a structured list of per-document, per-page text and optional images.

    Order per document: docN-image-pageM, then docN-text-pageM. If images are
    unavailable or disabled, only include docN-text-pageM.

    Args:
        documents: List of dicts with keys: id, name, file_path, mime_type, template (bool), template_args (dict)
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

        # Skip documents without a file_path (no upload or upload has no file)
        file_path = document.get("file_path")
        if not file_path:
            continue

        full_path = os.path.join(UPLOAD_FOLDER, file_path)
        # Note: document.tags removed in BCNF migration (now via simulation_tags)
        tags_display = ""  # document.tags removed
        mime_lower = (document.get("mime_type") or "").lower()

        # Check if this is a template document
        is_template = document.get("template", False)
        template_args = document.get("template_args")
        template_notice = ""
        if is_template and template_args:
            template_notice = _format_template_args_notice(template_args)

        is_pdf = file_path.lower().endswith(".pdf") or "pdf" in mime_lower
        is_image = mime_lower.startswith("image/") or file_path.lower().endswith(
            (".png", ".jpg", ".jpeg", ".webp", ".gif")
        )

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
                # Add template notice before content (only on first page)
                page_content = (template_notice if page_num == 0 else "") + page_text
                text_item_page: ResponseInputTextParam = {
                    "type": "input_text",
                    "text": header + page_content,
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
                        if file_path.lower().endswith(".png"):
                            mime = "image/png"
                        elif file_path.lower().endswith((".jpg", ".jpeg")):
                            mime = "image/jpeg"
                        elif file_path.lower().endswith(".webp"):
                            mime = "image/webp"
                        elif file_path.lower().endswith(".gif"):
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
            # Add template notice before content
            full_content = template_notice + content
            text_item_single: ResponseInputTextParam = {
                "type": "input_text",
                "text": header + full_content,
            }
            content_items.append(text_item_single)

    if not content_items:
        # Fallback to a minimal text item if nothing could be built
        content_items.append({"type": "input_text", "text": "No documents provided"})

    result_msg: Message = {"role": "developer", "content": content_items}
    return result_msg
