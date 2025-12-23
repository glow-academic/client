"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/models/list_models_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class ListModelsSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/models/list_models_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class ListModelsSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    model_id: str
    name: str
    description: str
    active: bool
    image_model: bool
    updated_at: str
    provider: str
    base_url: str
    can_edit: bool
    can_delete: bool
    actor_name: str
