from typing import Any

from agents.items import TResponseInputItem


def get_dynamic_rubric(
    rubric_obj: dict[str, Any],
    standard_groups: list[dict[str, Any]],
    standards: list[dict[str, Any]],
) -> TResponseInputItem:
    """
    Build a dynamic rubric from database records.

    Args:
        rubric_obj: The rubric dict from database
        standard_groups: List of standard group dicts for this rubric
        standards: List of standard dicts for all standard groups

    Returns:
        Dynamic rubric formatted for agent consumption
    """
    rubric_lines = [
        f"RUBRIC: {rubric_obj['name']}",
        f"Description: {rubric_obj.get('description', '')}",
        f"Total Points: {rubric_obj['points']}",
        f"Pass Points: {rubric_obj['pass_points']}",
        "",
        "EVALUATION CRITERIA:",
        "",
    ]

    # Group standards by standard_group_id
    standards_by_group: dict[Any, list[dict[str, Any]]] = {}
    for standard in standards:
        group_id = standard["standard_group_id"]
        if group_id not in standards_by_group:
            standards_by_group[group_id] = []
        standards_by_group[group_id].append(standard)

    # Build criteria sections
    for group in standard_groups:
        rubric_lines.extend(
            [
                f"CRITERION: {group['name']} ({group['short_name']})",
                f"Description: {group.get('description', '')}",
                f"Points: {group['points']} (Pass: {group['pass_points']})",
                "Rating Scale:",
            ]
        )

        # Sort standards by points (descending - 5 to 1)
        group_standards = standards_by_group.get(group["id"], [])
        group_standards.sort(key=lambda x: x["points"], reverse=True)

        for standard in group_standards:
            rubric_lines.append(
                f"  {standard['points']} - {standard['name']}: {standard.get('description', '')}"
            )

        rubric_lines.append("")  # Empty line between criteria

    rubric_string = "\n".join(rubric_lines)

    return {
        "role": "system",
        "content": f"You are evaluating a conversation based on the following rubric. Please provide scores (1-5) and feedback for each criterion.\n\n{rubric_string}",
    }
