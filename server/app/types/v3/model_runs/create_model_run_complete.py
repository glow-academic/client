"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/model_runs/create_model_run_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateModelRunSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/model_runs/create_model_run_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateModelRunSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    run_id: str
