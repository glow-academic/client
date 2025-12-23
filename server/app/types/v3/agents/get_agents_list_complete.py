"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agents_list_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetAgentsListSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    param_1: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.param_1,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agents_list_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAgentsListDepartmentMappingItem(BaseModel):
    """Generated nested model."""

    id: str
    name: str
    description: str


class GetAgentsListSqlRow(BaseModel):
    """SQL query result row after nesting.

    Structure matches nest_many() output.
    """

    agent_id: str
    name: str
    description: str
    reasoning: str
    temperature: Any | None
    model_id: str
    role: str
    updated_at: str
    department_ids: list[Any]
    can_edit: bool
    can_duplicate: bool
    can_delete: bool
    model_name: str
    model_description: str
    actor_name: str
    department_mapping: list[GetAgentsListDepartmentMappingItem]


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agents_list_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetAgentsListApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    param_1: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agents_list_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetAgentsListDepartmentMappingItem(BaseModel):
    """Generated nested model."""

    id: str
    name: str
    description: str


class GetAgentsListApiResponse(BaseModel):
    """API response data after nesting.

    Structure matches nest_many() output.
    """

    agent_id: str
    name: str
    description: str
    reasoning: str
    temperature: Any | None
    model_id: str
    role: str
    updated_at: str
    department_ids: list[Any]
    can_edit: bool
    can_duplicate: bool
    can_delete: bool
    model_name: str
    model_description: str
    actor_name: str
    department_mapping: list[GetAgentsListDepartmentMappingItem]
