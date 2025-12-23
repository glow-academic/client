"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/models/get_model_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetModelNewSqlParams(BaseModel):
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

Generated from: app/sql/v3/models/get_model_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetModelNewSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    valid_provider_ids: list[str]
    provider_mapping: dict[str, Any]
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    model_mapping: dict[str, Any]
    valid_model_ids: dict[str, Any]
    key_mapping: dict[str, Any]
    valid_key_ids: list[str]
    units: dict[str, Any]
    user_role: str
    primary_department_id: str
    actor_name: str
