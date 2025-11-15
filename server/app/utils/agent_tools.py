"""Tool creation functions for agent operations.

These functions create function tools that agents can use during their execution.
"""

import logging
import re
import uuid
from typing import Any

from agents import Tool, ToolsToFinalOutputResult, function_tool
from app.utils.debug_info import debug_info
from pydantic import Field

logger = logging.getLogger(__name__)

# Global storage for classification results
classification_results: dict[str, list[str]] = {}
classification_progress: dict[str, bool] = {}

# Default all categories to empty lists
DEFAULT_CATEGORIES = [
    "homeworks",
    "projects",
    "quizzes",
    "midterms",
    "labs",
    "lectures",
    "syllabi",
]

# Global storage for scenario generation results
scenario_results: dict[str, Any] = {}
scenario_progress: dict[str, bool] = {}

# Global storage for grading results
grading_results: dict[str, Any] = {}
grading_progress: dict[str, bool] = {}

# Global storage for hint results
hint_results: dict[str, Any] = {}
hint_progress: dict[str, bool] = {}

# Global storage for guardrail results
guardrail_results: dict[str, Any] = {}
guardrail_progress: dict[str, bool] = {}


def create_classification_function(category: str, category_description: str) -> Any:
    """Create a function tool for classifying documents into a specific category."""

    async def classify_as_category(
        document_numbers: list[str] = Field(
            description=f"List of document numbers (as strings) that should be classified as {category}. {category_description}"
        ),
    ) -> str:
        f"""Classify documents as {category}.
        
        Use this tool to mark documents that belong to the {category} category.
        {category_description}
        
        Args:
            document_numbers: List of document numbers (e.g., ["1", "3", "5"]) that are {category}
            
        Returns:
            Confirmation message
        """
        # Store the document numbers for this category
        classification_results[category] = document_numbers
        classification_progress[category] = True

        logger.info(
            f"✓ Classified {len(document_numbers)} documents as {category}: {document_numbers}"
        )
        return f"Classified {len(document_numbers)} documents as {category}"

    classify_as_category.__name__ = f"classify_{category}"
    return function_tool(classify_as_category)


def create_classification_tools() -> list[Any]:
    """Create all document classification function tools."""
    tools = []

    # Define categories with descriptions
    categories = {
        "homeworks": "Assignments, problem sets, exercises",
        "projects": "Large assignments, final projects, group work",
        "quizzes": "Short assessments, pop quizzes",
        "midterms": "Midterm exams, major tests",
        "labs": "Laboratory exercises, practical work",
        "lectures": "Lecture notes, slides, presentations",
        "syllabi": "Course syllabus, course outline",
    }

    for category, description in categories.items():
        tool = create_classification_function(category, description)
        tools.append(tool)
        logger.info(f"Created classification tool for: {category}")

    logger.info(f"Total classification tools created: {len(tools)}")
    return tools


def create_title_description_function(group_id: uuid.UUID | None) -> Any:
    """Create a function tool for setting scenario title and description."""

    async def set_title_and_description(
        title: str = Field(
            description="Short, descriptive title for the scenario (5-10 words)"
        ),
        scenario: str = Field(
            description="Scenario description (1-2 sentences) that subtly demonstrates the persona without naming it"
        ),
    ) -> str:
        """Set the title and description for the scenario.

        The title should be concise and descriptive (5-10 words).
        The scenario description must be exactly 1-2 sentences and should:
        - Subtly show the student's persona without stating it directly
        - Incorporate environmental parameters (crowdedness, intensity, time, deadline, location)
        - Focus on the course topic from the documents
        - Build a scene that shows, not tells

        Args:
            title: Short descriptive title
            scenario: 1-2 sentence scenario description

        Returns:
            Confirmation message
        """
        scenario_results["title"] = title
        scenario_results["description"] = scenario
        scenario_progress["title_description"] = True

        logger.info(f"✓ Set title: {title}")
        logger.info(f"✓ Set description: {scenario[:100]}...")
        return "Set title and description successfully"

    return function_tool(set_title_and_description)


def create_objectives_function(group_id: uuid.UUID | None) -> Any:
    """Create a function tool for setting scenario learning objectives."""

    async def set_objectives(
        objectives: list[str] = Field(
            description="List of 1-3 specific learning objectives that GTAs should achieve in this scenario"
        ),
    ) -> str:
        """Set the learning objectives for this scenario.

        Objectives should:
        - Be specific and measurable
        - Relate to the skills needed to handle this particular scenario
        - Focus on pedagogical skills, communication, or subject matter knowledge
        - Be achievable within a single chat interaction

        Examples:
        - "Demonstrate active listening by paraphrasing the student's concerns"
        - "Break down complex concepts into understandable chunks"
        - "Manage time effectively while addressing the student's emotional state"

        Args:
            objectives: List of 1-3 learning objectives (maximum 3)

        Returns:
            Confirmation message
        """
        # Limit to maximum 3 objectives
        objectives = objectives[:3]

        if len(objectives) < 1 or len(objectives) > 3:
            logger.warning(
                f"Objectives count ({len(objectives)}) outside recommended range of 1-3"
            )

        scenario_results["objectives"] = objectives
        scenario_progress["objectives"] = True

        logger.info(f"✓ Set {len(objectives)} objectives: {objectives}")
        return f"Set {len(objectives)} learning objectives successfully"

    return function_tool(set_objectives)


def create_scenario_tools(
    group_id: uuid.UUID | None, objectives_enabled: bool = True
) -> list[Any]:
    """Create all scenario generation function tools."""
    tools = []

    # Add title and description tool
    tools.append(create_title_description_function(group_id))
    logger.info("Created title and description tool")

    # Add objectives tool only if enabled
    if objectives_enabled:
        tools.append(create_objectives_function(group_id))
        logger.info("Created objectives tool")
    else:
        logger.info("Objectives tool skipped (objectives_enabled=False)")

    logger.info(f"Total scenario tools created: {len(tools)}")
    return tools


def create_safe_field_name(short_name: str) -> str:
    """
    Create a safe field name from a short_name by removing special characters and spaces.

    Args:
        short_name: The short name from the standard group

    Returns:
        Safe field name for use in Pydantic models
    """
    safe_name = re.sub(r"[^a-zA-Z0-9_]", "_", short_name.lower())
    safe_name = re.sub(r"_+", "_", safe_name).strip("_")
    return safe_name


def create_grading_function(
    standard_group: Any,
    standards: list[Any],
    chat_id: uuid.UUID,
    total_standard_groups: int,
    emit_progress_func: Any,
) -> Any:
    """Create a function tool for grading a specific standard group."""
    safe_name = create_safe_field_name(standard_group["short_name"])

    # Get standards for this group and build rating scale
    group_standards = [
        s for s in standards if s["standard_group_id"] == standard_group["id"]
    ]
    group_standards.sort(key=lambda x: x["points"], reverse=True)

    rating_scale = "\n".join(
        [
            f"  {std['points']} - {std['name']}: {std.get('description', '')}"
            for std in group_standards
        ]
    )

    full_description = (
        f"{standard_group.get('description', '')}\n\nRating Scale:\n{rating_scale}"
    )
    score_description = f"Score for {standard_group['name']} (1-5)"
    feedback_description = f"Feedback explaining the score for {standard_group['name']}"

    async def grade_standard_group(
        score: int = Field(ge=1, le=5, description=score_description),
        feedback: str = Field(default="", description=feedback_description),
    ) -> str:
        f"""Grade the conversation on: {standard_group["name"]}
        
        {full_description}
        
        Args:
            score: Integer score from 1-5 based on the rubric criteria above
            feedback: Brief feedback explaining the score with specific examples
            
        Returns:
            Confirmation message
        """
        grading_results[safe_name] = {"score": score, "feedback": feedback}
        grading_progress[safe_name] = True

        # Count completed standard groups (exclude "summary" from count)
        completed_count = sum(
            1 for k, v in grading_progress.items() if v and k != "summary"
        )

        # Emit progress event
        await emit_progress_func(
            {
                "type": "standard_graded",
                "chat_id": str(chat_id),
                "standard_group_name": standard_group["name"],
                "standard_group_short_name": standard_group["short_name"],
                "score": score,
                "feedback_preview": feedback[:100] + "..."
                if len(feedback) > 100
                else feedback,
                "completed_count": completed_count,
                "total_count": total_standard_groups,
            }
        )

        logger.info(
            f"✓ Graded {standard_group['name']}: {score}/5 - {feedback[:50]}..."
        )
        return f"Graded {standard_group['name']} with score {score}"

    grade_standard_group.__name__ = f"grade_{safe_name}"
    return function_tool(grade_standard_group)


def create_summary_function(chat_id: uuid.UUID, emit_progress_func: Any) -> Any:
    """Create a function tool for recording the overall summary."""

    async def record_summary(
        summary: str = Field(
            description="Overall evaluation summary synthesizing main strengths and areas for improvement"
        ),
    ) -> str:
        """Record the overall evaluation summary after grading all standards.

        This should be a 2-3 sentence summary that synthesizes the TA's main strengths
        and areas for improvement based on the rubric evaluation.

        Args:
            summary: Overall summary of the evaluation

        Returns:
            Confirmation message
        """
        grading_results["summary"] = summary
        grading_progress["summary"] = True

        # Emit progress event
        await emit_progress_func(
            {
                "type": "summary_recorded",
                "chat_id": str(chat_id),
                "message": "Overall summary recorded",
                "summary_preview": summary[:150] + "..."
                if len(summary) > 150
                else summary,
            }
        )

        logger.info(f"✓ Recorded summary: {summary[:100]}...")
        return "Summary recorded successfully"

    return function_tool(record_summary)


def create_grading_tools(
    standard_groups: list[Any],
    standards: list[Any],
    chat_id: uuid.UUID,
    emit_progress_func: Any,
) -> list[Any]:
    """Create all grading function tools for the standard groups."""
    tools = []
    total_standard_groups = len(standard_groups)

    for group in standard_groups:
        tool = create_grading_function(
            group, standards, chat_id, total_standard_groups, emit_progress_func
        )
        tools.append(tool)
        logger.info(f"Created grading tool for: {group['name']}")

    # Add summary tool
    tools.append(create_summary_function(chat_id, emit_progress_func))
    logger.info("Created summary tool")

    logger.info(f"Total grading tools created: {len(tools)}")
    return tools


def create_hint_function(hint_number: int) -> Tool:
    """Create a function tool for providing a specific hint."""

    async def provide_hint(
        hint: str = Field(
            description=(
                f"A concise, practical teaching strategy or communication tip for the GTA. "
                f"This is hint #{hint_number} of 3 required hints. "
                f"Make it distinct from the other hints and focused on a different aspect "
                f"of helping the student (e.g., content explanation, emotional support, pedagogical approach)."
            )
        ),
    ) -> str:
        """Provide a strategic hint for the GTA.

        This hint should help the GTA better address the student's needs or communication style.
        Focus on teaching strategies, clarification techniques, empathy, or encouragement.
        Each hint should cover a different aspect of the interaction.

        Args:
            hint: Practical, actionable hint for the GTA (distinct from other hints)

        Returns:
            Confirmation message indicating the hint was recorded
        """
        hint_results[f"hint_{hint_number}"] = hint
        hint_progress[f"hint_{hint_number}"] = True

        logger.info(f"✓ Hint {hint_number} recorded: {hint[:80]}...")
        return f"Hint {hint_number} recorded successfully. Continue until all 3 hints are provided."

    # Set unique function name
    provide_hint.__name__ = f"provide_hint_{hint_number}"
    return function_tool(provide_hint)


def create_hint_tools() -> list[Tool]:
    """Create all tools needed for hint generation."""
    tools = []

    # Create three separate hint tools
    for i in range(1, 4):  # 1, 2, 3
        tools.append(create_hint_function(i))

    # Add debug_info tool
    tools.append(debug_info)

    logger.info(f"Created {len(tools)} hint tools (3 hints + debug_info)")
    return tools


def create_evaluation_function() -> Any:
    """Create a function tool for evaluating if a response is proper."""

    async def evaluate_response(
        proper: bool = Field(
            description="Whether the response adheres to role expectations and is natural"
        ),
        reason: str = Field(
            description="Clear explanation for the evaluation decision"
        ),
    ) -> str:
        """Evaluate if the response is proper and provide reasoning.

        Args:
            proper: True if the response is appropriate, False if it violates guidelines
            reason: Detailed explanation of the evaluation

        Returns:
            Confirmation message
        """
        guardrail_results["proper"] = proper
        guardrail_results["reason"] = reason
        guardrail_progress["evaluation"] = True

        logger.info(f"✓ Evaluation complete: proper={proper}, reason={reason[:100]}...")
        return f"Evaluation recorded: {'Proper' if proper else 'Improper'}"

    return function_tool(evaluate_response)


def create_guardrail_tools() -> list[Any]:
    """Create all tools needed for guardrail evaluation."""
    tools = []

    # Add evaluation tool
    tools.append(create_evaluation_function())

    # Add debug_info tool (already decorated with @function_tool)
    tools.append(debug_info)

    logger.info(f"Created {len(tools)} guardrail tools")
    return tools
