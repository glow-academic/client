"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/infra/error/mock_select_test.sql
"""

from typing import Any

from pydantic import BaseModel


class MockSelectTestSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: tests/sql/integration/infra/error/mock_select_test.sql
"""

from typing import Any

from pydantic import BaseModel


class MockSelectTestSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    created_at: str
    message: str
    endpoint: str
    error: bool
    id: UUID
    profile_id: UUID


"""API request model generated from SQL introspection.

Generated from: tests/sql/integration/infra/error/mock_select_test.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any

from pydantic import BaseModel


class MockSelectTestApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """



"""API response model generated from SQL introspection.

Generated from: tests/sql/integration/infra/error/mock_select_test.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class MockSelectTestApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    created_at: str
    message: str
    endpoint: str
    error: bool
    id: UUID
    profile_id: UUID
