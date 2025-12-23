"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/providers/get_provider_detail_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetProviderDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    providerId: UUID
    profileId: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.providerId,
            self.profileId,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/providers/get_provider_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetProviderDetailSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    provider_id: str
    name: str
    description: str
    value: str
    active: bool
    created_at: str
    updated_at: str
    base_url: str
    user_role: str
    can_edit: bool
    can_delete: bool
    actor_name: str
