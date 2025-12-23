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
