"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/fields/get_field_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetFieldDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/fields/get_field_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetFieldDetailSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    field_id: str
    name: str
    description: str
    active: bool
    department_ids: list[str]
    parameter_ids: list[str]
    conditional_parameter_ids: list[str]
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    parameter_mapping: dict[str, Any]
    valid_parameter_ids: list[str]
    can_edit: bool
    actor_name: str
