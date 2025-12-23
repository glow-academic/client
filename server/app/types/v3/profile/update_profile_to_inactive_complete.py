"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/profile/update_profile_to_inactive_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateProfileToInactiveSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    profile_id: UUID
    last_active: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.profile_id,
            self.last_active,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/profile/update_profile_to_inactive_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateProfileToInactiveSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    profile_id: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/profile/update_profile_to_inactive_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any

from pydantic import BaseModel


class UpdateProfileToInactiveApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    last_active: str


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/profile/update_profile_to_inactive_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class UpdateProfileToInactiveApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    profile_id: str
