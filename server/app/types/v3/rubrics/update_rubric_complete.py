"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/rubrics/update_rubric_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateRubricSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    rubricId: UUID
    name: str
    description: str
    active: bool
    points: int
    passPoints: int
    department_ids: list[str]
    standard_groups: dict[str, Any]
    profile_id: UUID
    rubric_agent_id: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.rubricId,
            self.name,
            self.description,
            self.active,
            self.points,
            self.passPoints,
            self.department_ids,
            self.standard_groups,
            self.profile_id,
            self.rubric_agent_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/rubrics/update_rubric_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateRubricSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    rubric_id: str
    rubric_name: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/rubrics/update_rubric_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateRubricApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    rubricId: UUID
    name: str
    description: str
    active: bool
    points: int
    passPoints: int
    department_ids: list[str]
    standard_groups: dict[str, Any]
    rubric_agent_id: str


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/rubrics/update_rubric_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class UpdateRubricApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    rubric_id: str
    rubric_name: str
    actor_name: str
