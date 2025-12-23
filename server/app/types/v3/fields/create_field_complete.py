"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/fields/create_field_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateFieldSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    name: str
    description: str
    active: bool
    department_ids: list[str]
    conditional_parameter_ids: list[str]
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.name,
            self.description,
            self.active,
            self.department_ids,
            self.conditional_parameter_ids,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/fields/create_field_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateFieldSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    field_id: str
    actor_name: str
