"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/models/update_model_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateModelSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    model_id: UUID
    provider_id: UUID
    name: str
    description: str
    active: bool
    param_6: str
    param_7: list[str]
    param_8: str
    param_9: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.model_id,
            self.provider_id,
            self.name,
            self.description,
            self.active,
            self.param_6,
            self.param_7,
            self.param_8,
            self.param_9,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/models/update_model_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateModelSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    model_id: str
    model_name: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/models/update_model_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateModelApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    model_id: UUID
    provider_id: UUID
    name: str
    description: str
    active: bool
    param_6: str
    param_7: list[str]
    param_8: str
    param_9: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/models/update_model_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class UpdateModelApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    model_id: str
    model_name: str
    actor_name: str
