"""Format policy information for agent input."""

import os
from typing import Any

from agents.items import TResponseInputItem
from app.main import UPLOAD_FOLDER
from app.utils.document.read_pdf_text_pages import read_pdf_text_pages
from app.utils.document.read_text_file import read_text_file


def format_policy_info(policies: list[dict[str, Any]], video_length_seconds: int | None = None) -> TResponseInputItem:
    """
    Format policy information as TResponseInputItem.
    
    Reads actual PDF/text file content from file_path if available,
    falling back to description field if file reading fails.

    Args:
        policies: List of dicts with keys: id, name, content, file_path, mime_type
        video_length_seconds: Optional video length in seconds for context

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
    for policy_index, policy in enumerate(policies, start=1):
        policy_name = policy.get("name", "Unnamed Policy")
        file_path = policy.get("file_path")
        mime_type = policy.get("mime_type", "")
        
        # Try to read file content if file_path is available
        policy_content = None
        if file_path:
            try:
                full_path = os.path.join(UPLOAD_FOLDER, file_path)
                mime_lower = mime_type.lower() if mime_type else ""
                is_pdf = file_path.lower().endswith(".pdf") or "pdf" in mime_lower
                
                if is_pdf:
                    # Read PDF per-page text
                    text_pages = read_pdf_text_pages(full_path)
                    if text_pages:
                        # Format per-page content similar to document format
                        page_contents = []
                        for page_num, page_text in enumerate(text_pages, start=1):
                            page_contents.append(
                                f"--- Page {page_num} ---\n{page_text}"
                            )
                        policy_content = "\n\n".join(page_contents)
                else:
                    # Read text file content
                    policy_content = read_text_file(full_path)
            except Exception:
                # Fallback to description if file reading fails
                policy_content = None
        
        # Use file content if available, otherwise fall back to description
        if policy_content is None:
            policy_content = policy.get("content", "No content available")
        
        policy_text = (
            f"Policy: {policy_name}\n"
            f"Content:\n{policy_content}\n"
        )
        formatted_policies.append(policy_text)

    content = (
        "The following are the policies that should inform the video content:\n\n"
        + "\n---\n\n".join(formatted_policies)
    )
    
    # Add video length information if provided
    if video_length_seconds is not None:
        content += (
            f"\n\n**IMPORTANT - Video Length:**\n"
            f"The video is {video_length_seconds} seconds long. "
            f"Use this to structure the outline appropriately and ensure all content fits within this duration. "
            f"When assigning question timestamps, use integers from 0 to {video_length_seconds} (inclusive)."
        )

    return {
        "role": "user",
        "content": content,
    }

