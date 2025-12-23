"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/parameters/get_parameter_detail_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetParameterDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    param_1: UUID
    param_2: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.param_1,
            self.param_2,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/parameters/get_parameter_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetParameterDetailSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    name: str
    description: str
    active: bool
    simulation_parameter: bool
    document_parameter: bool
    persona_parameter: bool
    scenario_parameter: bool
    video_parameter: bool
    department_ids: list[str]
    persona_ids: list[str]
    document_ids: list[str]
    can_edit: bool
    actor_name: str
    parameter_items_json: dict[str, Any]
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    field_mapping: dict[str, Any]
    valid_field_ids: list[str]
    field_connections_json: dict[str, Any]
    persona_mapping: dict[str, Any]
    valid_persona_ids: list[str]
    document_mapping: dict[str, Any]
    valid_document_ids: list[str]


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/parameters/get_parameter_detail_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetParameterDetailApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    param_1: UUID
    param_2: str


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/parameters/get_parameter_detail_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetParameterDetailApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    name: str
    description: str
    active: bool
    simulation_parameter: bool
    document_parameter: bool
    persona_parameter: bool
    scenario_parameter: bool
    video_parameter: bool
    department_ids: list[str]
    persona_ids: list[str]
    document_ids: list[str]
    can_edit: bool
    actor_name: str
    parameter_items_json: dict[str, Any]
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    field_mapping: dict[str, Any]
    valid_field_ids: list[str]
    field_connections_json: dict[str, Any]
    persona_mapping: dict[str, Any]
    valid_persona_ids: list[str]
    document_mapping: dict[str, Any]
    valid_document_ids: list[str]
