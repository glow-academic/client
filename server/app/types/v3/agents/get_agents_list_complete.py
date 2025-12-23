"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agents_list_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAgentsListSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agents_list_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAgentsListSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    agent_id: str
    name: str
    description: str
    reasoning: str
    temperature: Any
    model_id: str
    role: str
    updated_at: str
    department_ids: list[str]
    can_edit: bool
    can_duplicate: bool
    can_delete: bool
    model_name: str
    model_description: str
    department_mapping: dict[str, Any]
    actor_name: str
