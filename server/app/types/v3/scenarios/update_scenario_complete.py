"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/update_scenario_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateScenarioSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    scenarioId: UUID
    name: str
    description: str
    active: bool
    objectives_enabled: bool
    param_6: bool
    param_7: bool
    param_8: bool
    param_9: bool
    param_10: UUID
    param_11: str
    param_12: str
    param_13: list[str]
    param_14: list[str]
    param_15: list[str]
    param_16: list[str]
    param_17: list[str]
    param_18: list[str]
    param_19: dict[str, Any]
    param_20: UUID
    param_21: UUID
    param_22: list[str]
    param_23: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.scenarioId,
            self.name,
            self.description,
            self.active,
            self.objectives_enabled,
            self.param_6,
            self.param_7,
            self.param_8,
            self.param_9,
            self.param_10,
            self.param_11,
            self.param_12,
            self.param_13,
            self.param_14,
            self.param_15,
            self.param_16,
            self.param_17,
            self.param_18,
            self.param_19,
            self.param_20,
            self.param_21,
            self.param_22,
            self.param_23,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/update_scenario_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateScenarioSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    scenario_id: str
    name: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/update_scenario_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateScenarioApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    scenarioId: UUID
    name: str
    description: str
    active: bool
    objectives_enabled: bool
    param_6: bool
    param_7: bool
    param_8: bool
    param_9: bool
    param_10: UUID
    param_11: str
    param_12: str
    param_13: list[str]
    param_14: list[str]
    param_15: list[str]
    param_16: list[str]
    param_17: list[str]
    param_18: list[str]
    param_19: dict[str, Any]
    param_20: UUID
    param_21: UUID
    param_22: list[str]
    param_23: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/update_scenario_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class UpdateScenarioApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    scenario_id: str
    name: str
    actor_name: str
