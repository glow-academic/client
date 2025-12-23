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


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/departments/create_department_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateDepartmentApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    title: str
    description: str
    active: bool
    settings_id: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/departments/create_department_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateDepartmentApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    department_id: str
    actor_name: str
