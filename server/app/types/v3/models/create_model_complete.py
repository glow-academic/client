"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/models/create_model_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateModelSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    provider_id: UUID
    name: str
    description: str
    active: bool
    param_5: str
    param_6: list[str]
    param_7: str
    param_8: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.provider_id,
            self.name,
            self.description,
            self.active,
            self.param_5,
            self.param_6,
            self.param_7,
            self.param_8,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/models/create_model_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateModelSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    id: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/models/create_model_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateModelApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    provider_id: UUID
    name: str
    description: str
    active: bool
    param_5: str
    param_6: list[str]
    param_7: str
    param_8: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/models/create_model_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateModelApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    id: str
    actor_name: str
