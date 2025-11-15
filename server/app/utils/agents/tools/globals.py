"""Global state dictionaries for agent tool results and progress."""

from typing import Any

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

