"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/get_cohort_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetCohortDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/get_cohort_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetCohortDetailSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    title: str
    description: str
    department_ids: list[str]
    active: bool
    updated_at: str
    can_edit: bool
    profile_ids: list[str]
    simulation_ids: list[str]
    valid_department_ids: list[str]
    valid_simulation_ids: list[str]
    simulations_list: dict[str, Any]
    simulation_mapping: dict[str, Any]
    department_mapping: dict[str, Any]
    actor_name: str
