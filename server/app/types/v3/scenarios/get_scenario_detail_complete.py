"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/get_scenario_detail_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetScenarioDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    scenario_id: UUID
    profile_id: str
    use_image: bool
    use_objectives: bool
    document_ids: list[UUID]
    problem_statement_ids: list[UUID]
    template_document_ids: list[UUID]
    use_video: bool

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.scenario_id,
            self.profile_id,
            self.use_image,
            self.use_objectives,
            self.document_ids,
            self.problem_statement_ids,
            self.template_document_ids,
            self.use_video,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/get_scenario_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetScenarioDetailSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    id: UUID
    name: str
    description: str
    problem_statement: str
    problem_statement_id: str
    active: bool
    generated: bool
    department_ids: list[str]
    parent_scenario_id: str
    hints_enabled: bool
    objectives_enabled: bool
    image_input_enabled: bool
    persona_ids: list[str]
    document_ids: list[str]
    objective_ids: list[str]
    simulation_ids: list[str]
    parameters_json: dict[str, Any]
    valid_persona_ids: list[str]
    valid_document_ids: list[str]
    valid_department_ids: list[UUID]
    active_usage_count: int
    user_role: str
    actor_name: str
    objective_mapping: dict[str, Any]
    persona_mapping: dict[str, Any]
    document_mapping: dict[str, Any]
    simulation_mapping: dict[str, Any]
    parameter_mapping: dict[str, Any]
    field_mapping: dict[str, Any]
    department_mapping: dict[str, Any]
    document_details: dict[str, Any]
    problem_statement_mapping: dict[str, Any]
    objectives_history: dict[str, Any]
    scenario_images: dict[str, Any]
    scenario_videos: dict[str, Any]
    question_ids: list[str]
    questions: dict[str, Any]
    video_enabled: bool
    questions_enabled: bool
    problem_statement_enabled: bool
    scenario_agent_id: str
    image_agent_id: str
    video_agent_id: str
    parameter_ids: list[str]
    persona_range_min: int
    persona_range_max: int
    document_range_min: int
    document_range_max: int
    parameter_range_min: int
    parameter_range_max: int
    field_ranges_json: dict[str, Any]
