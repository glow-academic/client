"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/get_scenario_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetScenarioNewSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/get_scenario_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetScenarioNewSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    department_ids: list[str]
    valid_persona_ids: list[str]
    valid_document_ids: list[str]
    department_mapping: dict[str, Any]
    persona_mapping: dict[str, Any]
    document_mapping: dict[str, Any]
    parameter_mapping: dict[str, Any]
    valid_parameter_ids: list[str]
    field_mapping: dict[str, Any]
    parameters_json: dict[str, Any]
    document_details: dict[str, Any]
    problem_statement_mapping: dict[str, Any]
    objectives_history: dict[str, Any]
    user_role: str
    primary_department_id: str
    scenario_agent_id: str
    image_agent_id: str
    agent_mapping: dict[str, Any]
    valid_agent_ids: list[str]
    selected_template_document_ids: list[str]
    objective_mapping: dict[str, Any]
    scenario_images: dict[str, Any]
    scenario_videos: dict[str, Any]
    question_ids: list[str]
    questions: dict[str, Any]
    video_agent_id: str
    video_enabled: bool
    questions_enabled: bool
    persona_range_min: int
    persona_range_max: int
    document_range_min: int
    document_range_max: int
    parameter_range_min: int
    parameter_range_max: int
    field_ranges_json: dict[str, Any]
    actor_name: str
