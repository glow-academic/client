"""Shared types and builder helpers for dashboard endpoints."""

from datetime import date
from typing import Any
from uuid import UUID


# ---------------------------------------------------------------------------
# Rubric scores types
# ---------------------------------------------------------------------------


class RubricScoreItem:
    """Single (chat, standard_group) rubric score row."""

    __slots__ = (
        "chat_id",
        "standard_group_id",
        "rubric_id",
        "score_percent",
        "simulation_id",
        "profile_id",
        "cohort_id",
        "department_id",
        "attempt_date",
        "attempt_type",
        "is_archived",
    )

    def __init__(
        self,
        chat_id: UUID,
        standard_group_id: UUID,
        rubric_id: UUID | None = None,
        score_percent: float | None = None,
        simulation_id: UUID | None = None,
        profile_id: UUID | None = None,
        cohort_id: UUID | None = None,
        department_id: UUID | None = None,
        attempt_date: date | None = None,
        attempt_type: str | None = None,
        is_archived: bool = False,
    ) -> None:
        self.chat_id = chat_id
        self.standard_group_id = standard_group_id
        self.rubric_id = rubric_id
        self.score_percent = score_percent
        self.simulation_id = simulation_id
        self.profile_id = profile_id
        self.cohort_id = cohort_id
        self.department_id = department_id
        self.attempt_date = attempt_date
        self.attempt_type = attempt_type
        self.is_archived = is_archived


class RubricScoresResponse:
    """Response from rubric scores query."""

    __slots__ = ("items", "total_count")

    def __init__(
        self,
        items: list[RubricScoreItem] | None = None,
        total_count: int = 0,
    ) -> None:
        self.items = items or []
        self.total_count = total_count


# ---------------------------------------------------------------------------
# Message stats types
# ---------------------------------------------------------------------------


class MessageStats:
    """Message statistics for a single chat."""

    __slots__ = ("chat_id", "num_messages_total", "avg_response_sec")

    def __init__(
        self,
        chat_id: UUID,
        num_messages_total: int = 0,
        avg_response_sec: float | None = None,
    ) -> None:
        self.chat_id = chat_id
        self.num_messages_total = num_messages_total
        self.avg_response_sec = avg_response_sec


# ---------------------------------------------------------------------------
# Builder helpers (used by dashboard/get.py and record/get.py)
# ---------------------------------------------------------------------------


def build_simulation_meta(simulations: list[Any]) -> list[dict]:
    """Build simulation metadata list from hydrated simulations."""
    return [
        {
            "simulation_id": str(item.simulation_id) if item.simulation_id else None,
            "name": item.name,
            "description": item.description,
            "department_ids": item.department_ids,
            "time_limit": None,
        }
        for item in simulations
    ]


def build_scenario_meta(scenarios: list[Any]) -> list[dict]:
    """Build scenario metadata list from hydrated scenarios."""
    return [
        {
            "scenario_id": str(item.scenario_id) if item.scenario_id else None,
            "name": item.name,
            "description": item.description,
        }
        for item in scenarios
    ]


def build_rubric_meta(rubrics: list[Any]) -> list[dict]:
    """Build rubric metadata list from hydrated rubrics."""
    return [
        {
            "rubric_id": str(item.rubric_id) if item.rubric_id else None,
            "name": item.name,
            "description": item.description,
        }
        for item in rubrics
    ]


def build_parameter_meta(parameters: list[Any]) -> list[dict]:
    """Build parameter metadata list from hydrated parameters."""
    return [
        {
            "parameter_id": str(item.parameter_id) if item.parameter_id else None,
            "name": item.name,
            "description": item.description,
            "numerical": None,
            "document_parameter": item.document_parameter,
            "persona_parameter": item.persona_parameter,
        }
        for item in parameters
    ]


def build_field_meta(
    fields: list[Any],
    field_parameter_map: dict,
    parameters: list[Any],
) -> list[dict]:
    """Build field metadata list from hydrated fields."""
    parameter_name_map = {
        p.parameter_id: p.name for p in parameters if p.parameter_id is not None
    }
    return [
        {
            "field_id": str(item.field_id) if item.field_id else None,
            "name": item.name,
            "description": item.description,
            "parameter_id": (
                str(field_parameter_map.get(item.field_id))
                if item.field_id and field_parameter_map.get(item.field_id)
                else None
            ),
            "parameter_name": (
                parameter_name_map.get(field_parameter_map.get(item.field_id))
                if item.field_id and field_parameter_map.get(item.field_id)
                else None
            ),
        }
        for item in fields
    ]
