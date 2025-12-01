"""Format question information for agent input."""

from typing import Any

from agents.items import TResponseInputItem


def format_question_info(questions: list[dict[str, Any]], video_length_seconds: int | None = None) -> TResponseInputItem:
    """
    Format question information as TResponseInputItem.

    Args:
        questions: List of dicts with keys: id, question_text, type, allow_multiple
        video_length_seconds: Optional video length in seconds for timestamp context

    Returns:
        TResponseInputItem formatted for agent input
    """
    if not questions:
        return {
            "role": "user",
            "content": "No questions provided.",
        }

    # Format each question with ID for timestamp assignment
    formatted_questions = []
    for question in questions:
        question_id = question.get("id", "")
        question_type = question.get("type", "unknown")
        allow_multiple = question.get("allow_multiple", False)
        type_label = "Multi-select" if (question_type == "choice" and allow_multiple) else (
            "Multiple Choice" if question_type == "choice" else "Free Response"
        )
        question_text = (
            f"Question ID: {question_id}\n"
            f"Question ({type_label}): {question.get('question_text', 'No text')}\n"
        )
        formatted_questions.append(question_text)

    content = (
        "The following are the questions that should be incorporated into the video outline:\n\n"
        + "\n---\n\n".join(formatted_questions)
    )
    
    if video_length_seconds:
        content += (
            f"\n\n**IMPORTANT - Video Length and Timestamps:**\n"
            f"The video is {video_length_seconds} seconds long. "
            f"You MUST assign timestamps to ALL questions above. "
            f"Valid timestamps are integers from 0 to {video_length_seconds} (inclusive). "
            f"Use the EXACT Question ID shown for each question when creating the question_timestamps dictionary. "
            f"For example, if the video is {video_length_seconds} seconds: "
            f"valid timestamps are {', '.join(map(str, range(video_length_seconds + 1)))}."
        )
    else:
        content += (
            "\n\n**IMPORTANT:** You MUST assign timestamps to ALL questions above. "
            "Use the EXACT Question ID shown for each question when creating the question_timestamps dictionary."
        )

    return {
        "role": "user",
        "content": content,
    }

