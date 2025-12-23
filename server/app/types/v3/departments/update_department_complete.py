"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/departments/update_department_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateDepartmentSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    department_id: UUID
    title: str
    description: str
    active: bool
    settings_id: str
    current_profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.department_id,
            self.title,
            self.description,
            self.active,
            self.settings_id,
            self.current_profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/departments/update_department_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateDepartmentSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    id: UUID
    title: str
    actor_name: str
