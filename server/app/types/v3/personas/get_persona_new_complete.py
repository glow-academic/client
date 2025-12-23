"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/personas/get_persona_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetPersonaNewSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/personas/get_persona_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetPersonaNewSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    name: str
    description: str
    active: bool
    color: str
    icon: str
    instructions: str
    department_ids: list[str]
    dept_mapping: dict[str, Any]
    valid_department_ids: list[str]
    agent_mapping: dict[str, Any]
    valid_agent_ids: list[str]
    usage_count: int
    user_role: str
    primary_department_id: str
    parameter_mapping: dict[str, Any]
    valid_parameter_ids: list[str]
    field_mapping: dict[str, Any]
    valid_parameter_item_ids: list[str]
    actor_name: str
