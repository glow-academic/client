"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/get_cohort_with_profiles_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetCohortWithProfilesSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/get_cohort_with_profiles_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetCohortWithProfilesSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    cohort_id: str
    title: str
    description: str
    active: bool
    current_profile_ids: list[str]
    available_profiles: dict[str, Any]
    department_mapping: dict[str, Any]
