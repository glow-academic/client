"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/parameters/update_parameter_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateParameterSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    parameterId: UUID
    name: str
    description: str
    active: bool
    simulation_parameter: bool
    document_parameter: bool
    persona_parameter: bool
    scenario_parameter: bool
    video_parameter: bool
    parameter_level_department_ids: list[str]
    field_connections_json: dict[str, Any]
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.parameterId,
            self.name,
            self.description,
            self.active,
            self.simulation_parameter,
            self.document_parameter,
            self.persona_parameter,
            self.scenario_parameter,
            self.video_parameter,
            self.parameter_level_department_ids,
            self.field_connections_json,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/parameters/update_parameter_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateParameterSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    parameter_id: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/parameters/update_parameter_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateParameterApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    parameterId: UUID
    name: str
    description: str
    active: bool
    simulation_parameter: bool
    document_parameter: bool
    persona_parameter: bool
    scenario_parameter: bool
    video_parameter: bool
    parameter_level_department_ids: list[str]
    field_connections_json: dict[str, Any]


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/parameters/update_parameter_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class UpdateParameterApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    parameter_id: str
    actor_name: str
