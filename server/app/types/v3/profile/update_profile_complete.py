"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/profile/update_profile_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateProfileSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    profileId: UUID
    first_name: str
    last_name: str
    last_login: str
    role: str
    active: bool
    unused: int
    last_active: str
    current_profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.profileId,
            self.first_name,
            self.last_name,
            self.last_login,
            self.role,
            self.active,
            self.unused,
            self.last_active,
            self.current_profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/profile/update_profile_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateProfileSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    id: UUID
    first_name: str
    last_name: str
    emails: list[str]
    primary_email: str
    role: str
    active: bool
    req_per_day: int
    last_login: str
    last_active: str
    created_at: str
    updated_at: str
    primary_department_id: UUID
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/profile/update_profile_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateProfileApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    profileId: UUID
    first_name: str
    last_name: str
    last_login: str
    role: str
    active: bool
    unused: int
    last_active: str
    current_profile_id: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/profile/update_profile_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class UpdateProfileApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    id: UUID
    first_name: str
    last_name: str
    emails: list[str]
    primary_email: str
    role: str
    active: bool
    req_per_day: int
    last_login: str
    last_active: str
    created_at: str
    updated_at: str
    primary_department_id: UUID
    actor_name: str
