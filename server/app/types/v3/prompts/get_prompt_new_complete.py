"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/prompts/get_prompt_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetPromptNewSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/prompts/get_prompt_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetPromptNewSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    prompt_id: str
    name: str
    description: str
    system_prompt: str
    active: bool
    created_at: str
    updated_at: str
    department_ids: list[str]
    agent_ids: list[str]
    persona_ids: list[str]
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    user_role: str
    department_id: str
    agent_mapping: dict[str, Any]
    persona_mapping: dict[str, Any]
    can_edit: bool
