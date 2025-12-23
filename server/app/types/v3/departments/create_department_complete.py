"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/departments/create_department_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateDepartmentSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    title: str
    description: str
    active: bool
    settings_id: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.title,
            self.description,
            self.active,
            self.settings_id,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/departments/create_department_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateDepartmentSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    department_id: str
    actor_name: str
