"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/model_runs/create_model_run_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateModelRunSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    department_id: UUID
    model_id: UUID
    entity_id: UUID
    entity_type: str
    profile_id: UUID
    key_id: UUID
    agent_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.department_id,
            self.model_id,
            self.entity_id,
            self.entity_type,
            self.profile_id,
            self.key_id,
            self.agent_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/model_runs/create_model_run_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateModelRunSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    run_id: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/model_runs/create_model_run_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateModelRunApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    department_id: UUID
    model_id: UUID
    entity_id: UUID
    entity_type: str
    key_id: UUID
    agent_id: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/model_runs/create_model_run_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateModelRunApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    run_id: str
