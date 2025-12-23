"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/agents/update_agent_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateAgentSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    agentId: UUID
    name: str
    description: str
    model_id: UUID
    active: bool
    role: str
    prompt_id: str
    system_prompt: str
    department_ids: list[str]
    department_ids_for_prompt: list[str]
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.agentId,
            self.name,
            self.description,
            self.model_id,
            self.active,
            self.role,
            self.prompt_id,
            self.system_prompt,
            self.department_ids,
            self.department_ids_for_prompt,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/agents/update_agent_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateAgentSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    agent_id: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/agents/update_agent_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateAgentApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    agentId: UUID
    name: str
    description: str
    model_id: UUID
    active: bool
    role: str
    prompt_id: str
    system_prompt: str
    department_ids: list[str]
    department_ids_for_prompt: list[str]


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/agents/update_agent_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class UpdateAgentApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    agent_id: str
    actor_name: str
