"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/fields/update_field_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateFieldSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    param_1: UUID
    param_2: str
    param_3: str
    param_4: bool
    param_5: list[str]
    param_6: list[str]
    param_7: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.param_1,
            self.param_2,
            self.param_3,
            self.param_4,
            self.param_5,
            self.param_6,
            self.param_7,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/fields/update_field_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateFieldSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    field_id: str
    field_name: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/fields/update_field_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateFieldApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    param_1: UUID
    param_2: str
    param_3: str
    param_4: bool
    param_5: list[str]
    param_6: list[str]
    param_7: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/fields/update_field_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class UpdateFieldApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    field_id: str
    field_name: str
    actor_name: str
