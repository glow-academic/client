"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/simulations/start_simulation_attempt_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class StartSimulationAttemptSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    simulation_id: UUID
    infinite_mode: bool
    profile_id: UUID
    scenario_id_override: str
    trace_id: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.simulation_id,
            self.infinite_mode,
            self.profile_id,
            self.scenario_id_override,
            self.trace_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/simulations/start_simulation_attempt_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class StartSimulationAttemptSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    attempt_id: str
    chat_id: str
    chat_title: str
    scenario_id: str
    scenario_name: str
    problem_statement: str
    needs_generation: bool
    content_type: str
    video_id: str
    simulation_data: dict[str, Any]
    scenario_metadata: dict[str, Any]


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/simulations/start_simulation_attempt_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class StartSimulationAttemptApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    simulation_id: UUID
    infinite_mode: bool
    scenario_id_override: str
    trace_id: str


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/simulations/start_simulation_attempt_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class StartSimulationAttemptApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    attempt_id: str
    chat_id: str
    chat_title: str
    scenario_id: str
    scenario_name: str
    problem_statement: str
    needs_generation: bool
    content_type: str
    video_id: str
    simulation_data: dict[str, Any]
    scenario_metadata: dict[str, Any]
