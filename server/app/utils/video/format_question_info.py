"""Format question information for agent input."""

from typing import Any

from agents.items import TResponseInputItem


def format_question_info(
    questions: list[dict[str, Any]], video_length_seconds: int | None = None
) -> tuple[TResponseInputItem, dict[str, str]]:
    """
    Format question information as TResponseInputItem with simple number mapping.

    Args:
        questions: List of dicts with keys: id, question_text, type, allow_multiple
        video_length_seconds: Optional video length in seconds for timestamp context

    Returns:
        Tuple of (TResponseInputItem formatted for agent input, mapping dict from simple number to UUID)
        Mapping format: {"1": "uuid1", "2": "uuid2", "3": "uuid3"}
    """
    if not questions:
        return (
            {
                "role": "user",
                "content": "No questions provided.",
            },
            {},
        )

    # Create mapping from simple numbers (1, 2, 3) to UUIDs
    question_id_mapping: dict[str, str] = {}
    formatted_questions = []

    for question_index, question in enumerate(questions, start=1):
        question_id = question.get("id", "")
        allow_multiple = question.get("allow_multiple", False)
        type_label = "Multi-select" if allow_multiple else "Multiple Choice"

        # Map simple number to UUID
        simple_id = str(question_index)
        question_id_mapping[simple_id] = question_id

        # Display simple number instead of UUID
        question_text = (
            f"Question ID: {simple_id}\n"
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
            f"Use the EXACT Question ID shown for each question (1, 2, 3, etc.) when creating the question_timestamps dictionary. "
            f"For example, if the video is {video_length_seconds} seconds: "
            f"valid timestamps are {', '.join(map(str, range(video_length_seconds + 1)))}. "
            f"Example format: {{'1': [0, 2], '2': [3]}}"
        )
    else:
        content += (
            "\n\n**IMPORTANT:** You MUST assign timestamps to ALL questions above. "
            "Use the EXACT Question ID shown for each question (1, 2, 3, etc.) when creating the question_timestamps dictionary. "
            "Example format: {'1': [0, 2], '2': [3]}"
        )

    return (
        {
            "role": "user",
            "content": content,
        },
        question_id_mapping,
    )
