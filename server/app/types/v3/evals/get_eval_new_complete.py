"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/evals/get_eval_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetEvalNewSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    profile_id: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/evals/get_eval_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetEvalNewSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    eval_id: str
    name: str
    description: str
    rubric_id: str
    eval_agent_id: str
    agent_id: str
    agent_ids: list[str]
    model_run_ids: list[str]
    active: bool
    dynamic: bool
    department_ids: list[str]
    valid_department_ids: list[str]
    department_mapping: dict[str, Any]
    eval_agent_mapping: dict[str, Any]
    valid_eval_agent_ids: list[str]
    agent_mapping: dict[str, Any]
    valid_agent_ids: list[str]
    rubric_mapping: dict[str, Any]
    valid_rubric_ids: list[str]
    can_edit: bool
    can_delete: bool
    actor_name: str
