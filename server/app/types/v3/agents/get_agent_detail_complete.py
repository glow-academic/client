"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agent_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAgentDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agent_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAgentDetailSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    agent_id: str
    name: str
    description: str
    system_prompt: str
    prompt_id: str
    model_id: str
    active: bool
    role: str
    selected_temperature_level_id: str
    temperature: Any
    selected_reasoning_level_id: str
    reasoning: str
    selected_voice_ids: dict[str, Any]
    valid_voices: dict[str, Any]
    department_ids: list[str]
    valid_department_ids: list[str]
    department_mapping: dict[str, Any]
    prompt_mapping: dict[str, Any]
    department_prompt_links: dict[str, Any]
    can_edit: bool
    debug_info: dict[str, Any]
    model_mapping: dict[str, Any]
    valid_model_ids: dict[str, Any]
    reasoning_options: dict[str, Any]
    temperature_lower: Any
    temperature_upper: Any
    temperature_levels: dict[str, Any]
    available_voices: dict[str, Any]
    actor_name: str
