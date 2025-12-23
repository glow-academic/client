"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agent_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAgentNewSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    profile_id: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agent_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAgentNewModelMappingTemperatureLevelsItem(BaseModel):
    """Generated nested model."""

    id: str
    temperature: str
    is_upper: bool

class GetAgentNewModelMappingAvailableVoicesItem(BaseModel):
    """Generated nested model."""

    id: str
    voice: str

class GetAgentNewModelMappingReasoningOptionsItem(BaseModel):
    """Generated nested model."""

    id: str
    reasoning_level: str

class GetAgentNewModelMappingItem(BaseModel):
    """Generated nested model."""

    id: str
    name: str
    description: str
    temperature_lower: Any | None
    temperature_upper: Any | None
    input_modalities: str
    input_modality: str
    output_modality: str
    temperature_levels: list[GetAgentNewModelMappingTemperatureLevelsItem]
    available_voices: list[GetAgentNewModelMappingAvailableVoicesItem]
    reasoning_options: list[GetAgentNewModelMappingReasoningOptionsItem]

class GetAgentNewDepartmentMappingItem(BaseModel):
    """Generated nested model."""

    id: str
    name: str
    description: str


class GetAgentNewSqlRow(BaseModel):
    """SQL query result row after nesting.

    Structure matches nest_many() output.
    """

    valid_model_ids: list[Any]
    valid_department_ids: list[Any]
    user_role: str
    actor_name: str
    primary_department_id: str
    model_mapping: list[GetAgentNewModelMappingItem]
    department_mapping: list[GetAgentNewDepartmentMappingItem]


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agent_new_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any

from pydantic import BaseModel


class GetAgentNewApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """



"""API response model generated from SQL introspection.

Generated from: app/sql/v3/agents/get_agent_new_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetAgentNewModelMappingTemperatureLevelsItem(BaseModel):
    """Generated nested model."""

    id: str
    temperature: str
    is_upper: bool

class GetAgentNewModelMappingAvailableVoicesItem(BaseModel):
    """Generated nested model."""

    id: str
    voice: str

class GetAgentNewModelMappingReasoningOptionsItem(BaseModel):
    """Generated nested model."""

    id: str
    reasoning_level: str

class GetAgentNewModelMappingItem(BaseModel):
    """Generated nested model."""

    id: str
    name: str
    description: str
    temperature_lower: Any | None
    temperature_upper: Any | None
    input_modalities: str
    input_modality: str
    output_modality: str
    temperature_levels: list[GetAgentNewModelMappingTemperatureLevelsItem]
    available_voices: list[GetAgentNewModelMappingAvailableVoicesItem]
    reasoning_options: list[GetAgentNewModelMappingReasoningOptionsItem]

class GetAgentNewDepartmentMappingItem(BaseModel):
    """Generated nested model."""

    id: str
    name: str
    description: str


class GetAgentNewApiResponse(BaseModel):
    """API response data after nesting.

    Structure matches nest_many() output.
    """

    valid_model_ids: list[Any]
    valid_department_ids: list[Any]
    user_role: str
    actor_name: str
    primary_department_id: str
    model_mapping: list[GetAgentNewModelMappingItem]
    department_mapping: list[GetAgentNewDepartmentMappingItem]
