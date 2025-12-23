"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/infra/activity/insert_test_profile.sql
"""

from typing import Any

from pydantic import BaseModel


class InsertTestProfileSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: tests/sql/integration/infra/activity/insert_test_profile.sql
"""

from typing import Any

from pydantic import BaseModel


class InsertTestProfileSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    id: UUID


"""API request model generated from SQL introspection.

Generated from: tests/sql/integration/infra/activity/insert_test_profile.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any

from pydantic import BaseModel


class InsertTestProfileApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """



"""API response model generated from SQL introspection.

Generated from: tests/sql/integration/infra/activity/insert_test_profile.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class InsertTestProfileApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    id: UUID
