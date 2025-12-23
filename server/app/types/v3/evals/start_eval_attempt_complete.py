"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/evals/start_eval_attempt_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class StartEvalAttemptSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/evals/start_eval_attempt_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class StartEvalAttemptSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    attempt_id: str
    eval_id: str
    agent_id: str
    eval_agent_id: str
    rubric_id: str
    dynamic: bool
    conversation_mode: bool
    conversation_agent_id: str
    conversation_max_turns: int
    pending_run_ids: list[str]
