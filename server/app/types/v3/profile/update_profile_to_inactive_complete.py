"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/profile/update_profile_to_inactive_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateProfileToInactiveSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/profile/update_profile_to_inactive_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateProfileToInactiveSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    profile_id: str
