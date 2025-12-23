"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/departments/get_department_default_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetDepartmentDefaultSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    profileId: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.profileId,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/departments/get_department_default_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetDepartmentDefaultSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    profile_role: str
    settings_mapping: dict[str, Any]
    actor_name: str
