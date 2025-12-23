"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/fields/get_field_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetFieldNewSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/fields/get_field_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetFieldNewSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    parameter_mapping: dict[str, Any]
    valid_parameter_ids: list[str]
    user_role: str
    primary_department_id: str
    actor_name: str
