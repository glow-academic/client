"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_eval_with_runs.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestEvalWithRunsSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_eval_with_runs.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestEvalWithRunsSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    eval_id: str
    run_id_1: str
    run_id_2: str
