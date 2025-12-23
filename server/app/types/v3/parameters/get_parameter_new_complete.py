"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/parameters/get_parameter_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetParameterNewSqlParams(BaseModel):
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

Generated from: app/sql/v3/parameters/get_parameter_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetParameterNewSqlRow(BaseModel):
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
    parameter_items_json: dict[str, Any]
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    primary_department_id: str
    field_mapping: dict[str, Any]
    valid_field_ids: list[str]
    field_connections_json: dict[str, Any]
    persona_mapping: dict[str, Any]
    valid_persona_ids: list[str]
    document_mapping: dict[str, Any]
    valid_document_ids: list[str]
    actor_name: str
