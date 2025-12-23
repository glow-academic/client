"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_scenario_with_dependencies.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateTestScenarioWithDependenciesSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    department_id: UUID
    persona_id: UUID
    name: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.department_id,
            self.persona_id,
            self.name,
        )


"""SQL response row model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_scenario_with_dependencies.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestScenarioWithDependenciesSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    scenario_id: str
