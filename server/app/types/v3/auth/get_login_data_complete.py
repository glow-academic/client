"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_login_data_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetLoginDataSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    department_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.department_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_login_data_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetLoginDataSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    providers_json: dict[str, Any]
    departments_json: dict[str, Any]
    guest_login_enabled: bool
    default_department_id: str
    realm_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_login_data_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetLoginDataApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    department_id: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_login_data_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetLoginDataApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    providers_json: dict[str, Any]
    departments_json: dict[str, Any]
    guest_login_enabled: bool
    default_department_id: str
    realm_name: str
