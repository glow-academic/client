"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/profile/update_profile_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateProfileSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/profile/update_profile_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateProfileSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    id: str
    first_name: str
    last_name: str
    emails: list[str]
    primary_email: str
    role: str
    active: bool
    req_per_day: int
    last_login: str
    last_active: str
    created_at: str
    updated_at: str
    primary_department_id: str
    actor_name: str
