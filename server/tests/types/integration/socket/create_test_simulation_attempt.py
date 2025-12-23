"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_simulation_attempt.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateTestSimulationAttemptSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    profile_id: UUID
    department_id: UUID
    simulation_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.profile_id,
            self.department_id,
            self.simulation_id,
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


"""API request model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_simulation_attempt.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateTestSimulationAttemptApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    department_id: UUID
    simulation_id: UUID


"""API response model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_simulation_attempt.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateTestSimulationAttemptApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    attempt_id: str
    simulation_id: str
    chat_id: str
    scenario_id: str
