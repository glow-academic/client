"""Format policy information for agent input."""

from typing import Any

from agents.items import TResponseInputItem


def format_policy_info(policies: list[dict[str, Any]]) -> TResponseInputItem:
    """
    Format policy information as TResponseInputItem.

    Args:
        policies: List of dicts with keys: id, name, content

    Returns:
        TResponseInputItem formatted for agent input
    """
    if not policies:
        return {
            "role": "user",
            "content": "No policies provided.",
        }

    # Format each policy
    formatted_policies = []
    for policy in policies:
        policy_text = (
            f"Policy: {policy.get('name', 'Unnamed Policy')}\n"
            f"Content: {policy.get('content', 'No content available')}\n"
        )
        formatted_policies.append(policy_text)

    content = (
        "The following are the policies that should inform the video content:\n\n"
        + "\n---\n\n".join(formatted_policies)
    )

    return {
        "role": "user",
        "content": content,
    }

