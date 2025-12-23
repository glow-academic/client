"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/departments/delete_department_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteDepartmentSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    departmentId: UUID
    current_profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.departmentId,
            self.current_profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/departments/delete_department_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DeleteDepartmentSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    department_id: str
    title: str
    simulation_count: int
    scenario_count: int
    persona_count: int
    document_count: int
    cohort_count: int
    total_usage: int
    deleted: bool
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/departments/delete_department_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteDepartmentApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    departmentId: UUID
    current_profile_id: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/departments/delete_department_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class DeleteDepartmentApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    department_id: str
    title: str
    simulation_count: int
    scenario_count: int
    persona_count: int
    document_count: int
    cohort_count: int
    total_usage: int
    deleted: bool
    actor_name: str
