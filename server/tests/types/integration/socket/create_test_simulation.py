"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_simulation.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestSimulationSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_simulation.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestSimulationSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    simulation_id: str
