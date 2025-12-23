"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/duplicate_cohort_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DuplicateCohortSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    original_cohort_id: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.original_cohort_id,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/duplicate_cohort_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DuplicateCohortSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    id: UUID
    original_title: str
    title: str
    description: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/duplicate_cohort_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DuplicateCohortApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    original_cohort_id: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/duplicate_cohort_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class DuplicateCohortApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    id: UUID
    original_title: str
    title: str
    description: str
    actor_name: str
