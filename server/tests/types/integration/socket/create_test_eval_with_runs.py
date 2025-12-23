"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_eval_with_runs.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateTestEvalWithRunsSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    agent_id: UUID
    eval_agent_id: UUID
    rubric_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.agent_id,
            self.eval_agent_id,
            self.rubric_id,
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


"""API request model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_eval_with_runs.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateTestEvalWithRunsApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    agent_id: UUID
    eval_agent_id: UUID
    rubric_id: UUID


"""API response model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_eval_with_runs.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateTestEvalWithRunsApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    eval_id: str
    run_id_1: str
    run_id_2: str
