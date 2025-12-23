"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/simulations/delete_simulation_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteSimulationSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    simulationId: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.simulationId,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/simulations/delete_simulation_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DeleteSimulationSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    simulation_id: str
    title: str
    usage_count: int
    deleted: bool
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/simulations/delete_simulation_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteSimulationApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    simulationId: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/simulations/delete_simulation_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class DeleteSimulationApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    simulation_id: str
    title: str
    usage_count: int
    deleted: bool
    actor_name: str
