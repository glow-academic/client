"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/evals/get_eval_attempt_full_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetEvalAttemptFullSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    attempt_id: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.attempt_id,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/evals/get_eval_attempt_full_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetEvalAttemptFullSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    attempt: dict[str, Any]
    eval: dict[str, Any]
    runs: dict[str, Any]
    status_summary: dict[str, Any]
    actor_name: str
