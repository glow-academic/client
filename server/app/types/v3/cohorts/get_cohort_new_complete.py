"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/get_cohort_new_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetCohortNewSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    param_1: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.param_1,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/get_cohort_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetCohortNewSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    title: str
    description: str
    department_ids: list[str]
    active: bool
    can_edit: bool
    profile_ids: list[str]
    simulation_ids: list[str]
    valid_department_ids: list[str]
    valid_simulation_ids: list[str]
    valid_profile_ids: list[str]
    simulations_list: dict[str, Any]
    simulation_mapping: dict[str, Any]
    profile_mapping: dict[str, Any]
    staff: dict[str, Any]
    cohort_mapping: dict[str, Any]
    department_mapping_for_staff: dict[str, Any]
    department_mapping: dict[str, Any]
    primary_department_id: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/get_cohort_new_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetCohortNewApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    param_1: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/cohorts/get_cohort_new_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetCohortNewApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    title: str
    description: str
    department_ids: list[str]
    active: bool
    can_edit: bool
    profile_ids: list[str]
    simulation_ids: list[str]
    valid_department_ids: list[str]
    valid_simulation_ids: list[str]
    valid_profile_ids: list[str]
    simulations_list: dict[str, Any]
    simulation_mapping: dict[str, Any]
    profile_mapping: dict[str, Any]
    staff: dict[str, Any]
    cohort_mapping: dict[str, Any]
    department_mapping_for_staff: dict[str, Any]
    department_mapping: dict[str, Any]
    primary_department_id: str
    actor_name: str
