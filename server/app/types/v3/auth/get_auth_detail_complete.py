"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_auth_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAuthDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
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
    encrypted: int


class GetAuthDetailSqlRow(BaseModel):
    """SQL query result row after nesting.

    Structure matches nest_many() output.
    """

    name: str
    description: str
    active: int
    can_edit: bool
    actor_name: str
    auth_items: list[GetAuthDetailAuthItemsItem]
