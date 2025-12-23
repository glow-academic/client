"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/delete_cohort_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteCohortSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    cohort_id: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.cohort_id,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/delete_cohort_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DeleteCohortSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    usage_count: int
    deleted: bool
    title: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/delete_cohort_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteCohortApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    cohort_id: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/delete_cohort_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class DeleteCohortApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    usage_count: int
    deleted: bool
    title: str
    actor_name: str
