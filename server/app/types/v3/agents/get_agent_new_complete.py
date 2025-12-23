"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agent_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAgentNewSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agent_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAgentNewSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    model_mapping: dict[str, Any]
    valid_model_ids: dict[str, Any]
    valid_department_ids: list[str]
    department_mapping: dict[str, Any]
    user_role: str
    actor_name: str
    primary_department_id: str
