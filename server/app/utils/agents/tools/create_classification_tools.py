"""Create all document classification function tools."""

import logging
from typing import Any

from app.utils.agents.tools.create_classification_function import (
    create_classification_function,
)

logger = logging.getLogger(__name__)


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
