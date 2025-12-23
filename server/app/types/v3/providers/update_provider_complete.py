"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/providers/update_provider_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateProviderSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    provider_id: UUID
    name: str
    description: str
    value: str
    active: bool
    base_url: str
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.provider_id,
            self.name,
            self.description,
            self.value,
            self.active,
            self.base_url,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/providers/update_provider_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateProviderSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    provider_id: str
    actor_name: str
