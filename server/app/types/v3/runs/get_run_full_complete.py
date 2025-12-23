"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/runs/get_run_full_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetRunFullSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/runs/get_run_full_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetRunFullSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    run: dict[str, Any]
    chats: dict[str, Any]
    aggregated_results: dict[str, Any]
    timer: dict[str, Any]
    rubric_structure: dict[str, Any]
    scenario_documents: dict[str, Any]
    current_chat_index: int
    expected_chat_count: int
    is_single_chat_attempt: bool
    is_last_attempt: bool
    show_results: bool
    should_show_controls: bool
    remaining_scenarios_count: int
    is_last_remaining_scenario: bool
    can_pick_multiple_alternatives: bool
    is_active: bool
    all_simulation_scenarios: dict[str, Any]
