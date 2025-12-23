"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/simulations/link_run_to_group_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class LinkRunToGroupSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    group_id: UUID
    run_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.group_id,
            self.run_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/simulations/link_run_to_group_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class LinkRunToGroupSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

