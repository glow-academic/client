"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/models/get_model_detail_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetModelDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    model_id: UUID
    profile_id: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.model_id,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/models/get_model_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetModelDetailSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    name: str
    description: str
    active: bool
    value: str
    provider: str
    provider_id: str
    provider_name: str
    image_model: bool
    valid_provider_ids: list[str]
    provider_mapping: dict[str, Any]
    base_url: str
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    department_ids: list[str]
    key_mapping: dict[str, Any]
    valid_key_ids: list[str]
    default_key_id: str
    temperature_lower: Any
    temperature_upper: Any
    temperature_values: dict[str, Any]
    pricing: dict[str, Any]
    modalities: dict[str, Any]
    reasoning_levels: dict[str, Any]
    voices: dict[str, Any]
    qualities: dict[str, Any]
    units: dict[str, Any]
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/models/get_model_detail_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetModelDetailApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    model_id: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/models/get_model_detail_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetModelDetailApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    name: str
    description: str
    active: bool
    value: str
    provider: str
    provider_id: str
    provider_name: str
    image_model: bool
    valid_provider_ids: list[str]
    provider_mapping: dict[str, Any]
    base_url: str
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    department_ids: list[str]
    key_mapping: dict[str, Any]
    valid_key_ids: list[str]
    default_key_id: str
    temperature_lower: Any
    temperature_upper: Any
    temperature_values: dict[str, Any]
    pricing: dict[str, Any]
    modalities: dict[str, Any]
    reasoning_levels: dict[str, Any]
    voices: dict[str, Any]
    qualities: dict[str, Any]
    units: dict[str, Any]
    actor_name: str
