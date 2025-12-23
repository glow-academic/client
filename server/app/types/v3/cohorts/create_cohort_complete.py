"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/create_cohort_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateCohortSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    title: str
    description: str
    active: bool
    department_ids: list[str]
    param_5: list[str]
    param_6: list[str]
    param_7: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.title,
            self.description,
            self.active,
            self.department_ids,
            self.param_5,
            self.param_6,
            self.param_7,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/create_cohort_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateCohortSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    id: UUID
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/create_cohort_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateCohortApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    title: str
    description: str
    active: bool
    department_ids: list[str]
    param_5: list[str]
    param_6: list[str]
    param_7: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/create_cohort_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateCohortApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    id: UUID
    actor_name: str
