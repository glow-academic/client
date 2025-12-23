"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/create_scenario_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateScenarioSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/create_scenario_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateScenarioSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    scenario_id: str
    actor_name: str
