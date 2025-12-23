"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/simulations/get_simulation_new_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetSimulationNewSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    param_1: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.param_1,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/simulations/get_simulation_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetSimulationNewSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    title: str
    description: str
    department_ids: list[str]
    time_limit: int
    rubric_id: str
    active: bool
    default_simulation: bool
    practice_simulation: bool
    hint_agent_id: str
    grade_text_agent_id: str
    grade_voice_agent_id: str
    simulation_text_agent_id: str
    simulation_voice_agent_id: str
    user_role: str
    active_cohort_count: int
    total_cohort_links: int
    can_edit: bool
    scenarios_list: dict[str, Any]
    scenario_ids: list[str]
    valid_scenario_ids: list[str]
    valid_video_ids: list[str]
    valid_rubric_ids: list[str]
    valid_department_ids: list[str]
    scenario_mapping: dict[str, Any]
    video_mapping: dict[str, Any]
    rubric_mapping: dict[str, Any]
    department_mapping: dict[str, Any]
    parameter_mapping: dict[str, Any]
    field_mapping: dict[str, Any]
    parameter_items_list: dict[str, Any]
    primary_department_id: str
    agent_mapping: dict[str, Any]
    valid_agent_ids: list[str]
    actor_name: str
