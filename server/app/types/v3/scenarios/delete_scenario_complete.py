"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/delete_scenario_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteScenarioSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    scenarioId: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.scenarioId,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/delete_scenario_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DeleteScenarioSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    scenario_id: str
    name: str
    usage_count: int
    deleted: bool
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/delete_scenario_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteScenarioApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    scenarioId: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/delete_scenario_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class DeleteScenarioApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    scenario_id: str
    name: str
    usage_count: int
    deleted: bool
    actor_name: str
