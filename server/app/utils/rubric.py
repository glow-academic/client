from agents.items import TResponseInputItem
from app.models import Rubrics, StandardGroups, Standards
from typing import List

rubric = """
;5 - Excellent;4 - Good;3 - Acceptable;2 - Marginal;1 - Poor
Facilitates student-driven learning (listen);Consistently employs open-ended questions that empower students to discover solutions independently.;Regularly uses guided questioning, encouraging student reasoning with occasional prompts.;Occasionally guides students with questions but sometimes provides direct answers.;Rarely uses questioning techniques, often resorting to hints or partial solutions.;Directly provided the answer
Demonstrates understanding of course objectives (obj);Clearly articulates course objectives and aligns explanations with learning goals, ensuring conceptual clarity.;Explains course objectives accurately and relates examples to key learning outcomes.;Provides a basic overview of objectives but with occasional inaccuracies or lack of depth.;Demonstrates limited awareness of course goals and offers explanations with minor misconceptions.;Didn't know the course material, had to ask students, or clear demonstration of not knowing
Manages session time effectively (time);Begins and concludes sessions within scheduled times, maximizing productivity and respecting student availability.;Generally adheres to time allocations with minor deviations that do not impact session quality.;Sometimes exceeds or finishes early, slightly affecting pacing yet maintaining core engagement.;Frequently mismanages time, leading to rushed explanations or unnecessary prolongation.;Ended the conversation really early, or made it last longer than needed
Adapts approach to individual student needs (adapt);Perfectly adapts approach to diverse student emotional and attitude types;Mostly seamlessly adjusted communication and teaching style to effectively engage students across a wide range of emotional;Demonstrates thoughtful adjustments to support most student types, maintaining a supportive and responsive demeanor.;Shows minimal ability to adjust to varied student behaviors, occasionally missing cues or responding inappropriately.;Fails to adapt to different student types, responding uniformly without consideration of individual emotional or behavioral needs.
"""


def get_rubric() -> TResponseInputItem:
    """
    Get the static rubric for backward compatibility.

    Returns:
        Static rubric formatted for agent consumption
    """
    return {
        "role": "assistant",
        "content": f"The following is the rubric for the evaluation: {rubric}",
    }


def get_dynamic_rubric(
    rubric_obj: Rubrics,
    standard_groups: List[StandardGroups],
    standards: List[Standards],
) -> TResponseInputItem:
    """
    Build a dynamic rubric from database objects.

    Args:
        rubric_obj: The rubric object from database
        standard_groups: List of standard groups for this rubric
        standards: List of standards for all standard groups

    Returns:
        Dynamic rubric formatted for agent consumption
    """
    rubric_lines = [
        f"RUBRIC: {rubric_obj.name}",
        f"Description: {rubric_obj.description}",
        f"Total Points: {rubric_obj.points}",
        f"Pass Points: {rubric_obj.pass_points}",
        "",
        "EVALUATION CRITERIA:",
        "",
    ]

    # Group standards by standard_group_id
    standards_by_group = {}
    for standard in standards:
        group_id = standard.standard_group_id
        if group_id not in standards_by_group:
            standards_by_group[group_id] = []
        standards_by_group[group_id].append(standard)

    # Build criteria sections
    for group in standard_groups:
        rubric_lines.extend(
            [
                f"CRITERION: {group.name} ({group.short_name})",
                f"Description: {group.description}",
                f"Points: {group.points} (Pass: {group.pass_points})",
                "Rating Scale:",
            ]
        )

        # Sort standards by points (descending - 5 to 1)
        group_standards = standards_by_group.get(group.id, [])
        group_standards.sort(key=lambda x: x.points, reverse=True)

        for standard in group_standards:
            rubric_lines.append(
                f"  {standard.points} - {standard.name}: {standard.description}"
            )

        rubric_lines.append("")  # Empty line between criteria

    rubric_string = "\n".join(rubric_lines)

    return {
        "role": "system",
        "content": f"You are evaluating a conversation based on the following rubric. Please provide scores (1-5) and feedback for each criterion.\n\n{rubric_string}",
    }
