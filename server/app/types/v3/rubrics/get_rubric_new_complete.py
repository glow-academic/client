"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/rubrics/get_rubric_new_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetRubricNewSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/rubrics/get_rubric_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetRubricNewSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    name: str
    description: str
    active: bool
    points: int
    passpoints: int
    department_ids: list[str]
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    user_role: str
    actor_name: str
    standard_groups_complete: dict[str, Any]
    primary_department_id: str
    agent_mapping: dict[str, Any]
    valid_agent_ids: list[str]
