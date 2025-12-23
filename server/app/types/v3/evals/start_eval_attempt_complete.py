"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/evals/start_eval_attempt_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class StartEvalAttemptSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    eval_id: UUID
    conversation_mode: bool
    conversation_agent_id: UUID
    conversation_max_turns: int

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.eval_id,
            self.conversation_mode,
            self.conversation_agent_id,
            self.conversation_max_turns,
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


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/evals/start_eval_attempt_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class StartEvalAttemptApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    eval_id: UUID
    conversation_mode: bool
    conversation_agent_id: UUID
    conversation_max_turns: int


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/evals/start_eval_attempt_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class StartEvalAttemptApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
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
