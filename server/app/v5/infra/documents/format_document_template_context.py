"""Format document template context for agent input."""

from typing import Any

from app.v5.infra.agents.types import TResponseInputItem


def format_document_template_context(
    document_name: str | None = None,
    document_description: str | None = None,
    department_name: str | None = None,
    fields: list[dict[str, Any]] | None = None,
) -> list[TResponseInputItem]:
    """
    Format document template context as list of TResponseInputItem.

    Args:
        document_name: Optional document name
        document_description: Optional document description
        department_name: Optional department name
        fields: Optional list of field dicts with keys: item_name, item_description,
                param_name, param_description

    Returns:
        List of TResponseInputItem formatted for agent input
    """
    input_items: list[TResponseInputItem] = []

    # Build document context message
    context_parts: list[str] = []

    if document_name:
        context_parts.append(f"Document Name: {document_name}")

    if document_description:
        context_parts.append(f"Document Description: {document_description}")

    if department_name:
        context_parts.append(f"Department: {department_name}")

    if context_parts:
        document_context: TResponseInputItem = {
            "role": "user",
            "content": "Document Context:\n" + "\n".join(context_parts),
        }
        input_items.append(document_context)

    # Add fields information if provided
    if fields:
        formatted_items = []
        for row in fields:
            formatted_item = (
                f"This is the {row['param_name']} ({row.get('param_description', '')}) for this chat: {row['item_name']}. "
                f"Description: {row.get('item_description', '')}."
            )
            formatted_items.append(formatted_item)

        content = "The following is the parameter item information:\n" + "\n".join(
            formatted_items
        )
        fields_info = {
            "role": "user",
            "content": content,
        }
        input_items.append(fields_info)

    return input_items
