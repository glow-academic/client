"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/simulations/generate_hints_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GenerateHintsSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    message_id: UUID
    chat_id: UUID
    department_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.message_id,
            self.chat_id,
            self.department_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/simulations/generate_hints_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GenerateHintsSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    message_id: str
    message_created_at: str
    chat_id: str
    attempt_id_out: str
    scenario_id: str
    trace_id: str
    chat_title: str
    simulation_id: str
    problem_statement: str
    agent_id: str
    agent_name: str
    system_prompt: str
    temperature: Any
    reasoning: str
    model_id: str
    model_name: str
    provider_name: str
    base_url: str
    api_key: str
    provider_id: str
    profile_id: str
    req_per_day: int
    runs_today_count: int
    earliest_run_created_at: str
    documents: dict[str, Any]
    run_id: str
