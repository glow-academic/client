"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/models/update_model_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateModelSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
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
