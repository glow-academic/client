"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/parameters/duplicate_parameter_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DuplicateParameterSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    original_parameterId: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.original_parameterId,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/parameters/duplicate_parameter_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DuplicateParameterSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    parameter_id: str
    original_name: str
    actor_name: str
