"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_simulation.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateTestSimulationSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    department_id: UUID
    rubric_id: UUID
    title: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.department_id,
            self.rubric_id,
            self.title,
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

    simulation_id: UUID


"""API request model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_simulation.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateTestSimulationApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    department_id: UUID
    rubric_id: UUID
    title: str


"""API response model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_simulation.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateTestSimulationApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    simulation_id: UUID
