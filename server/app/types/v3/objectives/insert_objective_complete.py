"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/objectives/insert_objective_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class InsertObjectiveSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    objective: str
    idx: int
    scenario_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.objective,
            self.idx,
            self.scenario_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/objectives/insert_objective_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class InsertObjectiveSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    objective_id: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/objectives/insert_objective_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class InsertObjectiveApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    objective: str
    idx: int
    scenario_id: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/objectives/insert_objective_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class InsertObjectiveApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    objective_id: str
