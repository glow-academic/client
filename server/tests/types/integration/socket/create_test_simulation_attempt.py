"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_simulation_attempt.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestSimulationAttemptSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_simulation_attempt.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestSimulationAttemptSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    attempt_id: str
    simulation_id: str
    chat_id: str
    scenario_id: str
