"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/keys/get_key_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetKeyDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/keys/get_key_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetKeyDetailSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    key_id: str
    name: str
    key_masked: str
    description: str
    active: bool
    created_at: str
    updated_at: str
    department_ids: list[str]
    model_ids: list[str]
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    user_role: str
    model_mapping: dict[str, Any]
    can_edit: bool
    actor_name: str
