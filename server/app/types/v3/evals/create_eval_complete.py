"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/evals/create_eval_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateEvalSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    name: str
    description: str
    rubric_id: UUID
    agent_id: UUID
    eval_agent_id: UUID
    run_ids: list[UUID]
    department_ids: list[UUID]
    active: bool
    dynamic: bool
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.name,
            self.description,
            self.rubric_id,
            self.agent_id,
            self.eval_agent_id,
            self.run_ids,
            self.department_ids,
            self.active,
            self.dynamic,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/evals/create_eval_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateEvalSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    eval_id: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/evals/create_eval_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateEvalApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    name: str
    description: str
    rubric_id: UUID
    agent_id: UUID
    eval_agent_id: UUID
    run_ids: list[UUID]
    department_ids: list[UUID]
    active: bool
    dynamic: bool


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/evals/create_eval_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateEvalApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    eval_id: str
    actor_name: str
