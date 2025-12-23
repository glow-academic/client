"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_login_data_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetLoginDataSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_login_data_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetLoginDataSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    providers_json: dict[str, Any]
    departments_json: dict[str, Any]
    guest_login_enabled: bool
    default_department_id: str
    realm_name: str
