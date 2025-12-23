"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_auth_detail_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetAuthDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    param_1: UUID
    param_2: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.param_1,
            self.param_2,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_auth_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAuthDetailAuthItemsItem(BaseModel):
    """Generated nested model."""

    auth_item_id: str
    name: str
    description: str
    position: int
    active: bool
    value_masked: str
    key_id: str
    encrypted: bool


class GetAuthDetailSqlRow(BaseModel):
    """SQL query result row after nesting.

    Structure matches nest_many() output.
    """

    name: str
    description: str
    active: bool
    can_edit: bool
    actor_name: str
    auth_items: list[GetAuthDetailAuthItemsItem]


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_auth_detail_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetAuthDetailApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    param_1: UUID
    param_2: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_auth_detail_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetAuthDetailAuthItemsItem(BaseModel):
    """Generated nested model."""

    auth_item_id: str
    name: str
    description: str
    position: int
    active: bool
    value_masked: str
    key_id: str
    encrypted: bool


class GetAuthDetailApiResponse(BaseModel):
    """API response data after nesting.

    Structure matches nest_many() output.
    """

    name: str
    description: str
    active: bool
    can_edit: bool
    actor_name: str
    auth_items: list[GetAuthDetailAuthItemsItem]
