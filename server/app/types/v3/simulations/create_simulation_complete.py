"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/simulations/create_simulation_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateSimulationSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    title: str
    description: str
    active: bool
    practice_simulation: bool
    department_ids: list[str]
    scenario_ids: list[str]
    scenario_active_flags: list[bool]
    scenario_hints_enabled: list[bool]
    scenario_rubric_ids: list[str]
    scenario_time_limit_seconds: list[int]
    scenario_audio_enabled: list[bool]
    scenario_text_enabled: list[bool]
    simulation_text_agent_id: UUID
    simulation_voice_agent_id: str
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.title,
            self.description,
            self.active,
            self.practice_simulation,
            self.department_ids,
            self.scenario_ids,
            self.scenario_active_flags,
            self.scenario_hints_enabled,
            self.scenario_rubric_ids,
            self.scenario_time_limit_seconds,
            self.scenario_audio_enabled,
            self.scenario_text_enabled,
            self.simulation_text_agent_id,
            self.simulation_voice_agent_id,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/simulations/create_simulation_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateSimulationSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    simulation_id: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/simulations/create_simulation_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateSimulationApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    title: str
    description: str
    active: bool
    practice_simulation: bool
    department_ids: list[str]
    scenario_ids: list[str]
    scenario_active_flags: list[bool]
    scenario_hints_enabled: list[bool]
    scenario_rubric_ids: list[str]
    scenario_time_limit_seconds: list[int]
    scenario_audio_enabled: list[bool]
    scenario_text_enabled: list[bool]
    simulation_text_agent_id: UUID
    simulation_voice_agent_id: str


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/simulations/create_simulation_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateSimulationApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    simulation_id: str
    actor_name: str
