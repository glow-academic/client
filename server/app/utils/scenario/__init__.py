"""Scenario utility functions."""

from typing import Any

from agents.items import TResponseInputItem


def format_parameter_item_info(
    parameter_items: list[dict[str, Any]],
) -> TResponseInputItem:
    """
    Format parameter item information as TResponseInputItem.

    Args:
        parameter_items: List of dicts with keys: item_name, item_description,
                        param_name, param_description

    Returns:
        Dict with role and content formatted for agent input
    """
    if not parameter_items:
        return {
            "role": "user",
            "content": "No parameter items found.",
        }

    # Format each parameter item using the template
    formatted_items = []
    for row in parameter_items:
        formatted_item = (
            f"This is the {row['param_name']} ({row.get('param_description', '')}) for this chat: {row['item_name']}. "
            f"Description: {row.get('item_description', '')}."
        )
        formatted_items.append(formatted_item)

    content = "The following is the parameter item information:\n" + "\n".join(
        formatted_items
    )

    return {
        "role": "user",
        "content": content,
    }


__all__ = ["format_parameter_item_info"]

