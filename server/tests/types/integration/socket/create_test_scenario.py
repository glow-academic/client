"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_scenario.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestScenarioSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_scenario.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestScenarioSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    id: str
