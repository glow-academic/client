"""Benchmark completion handler - listens to artifact_generation_complete events when eval_mode=True."""

import uuid
from typing import Any
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

@sio.on("artifact_generation_complete")  # type: ignore
async def handle_benchmark_complete(data: dict[str, Any]) -> None:
    """Handle artifact_generation_complete events - only process when eval_mode=True."""
    eval_mode = data.get("eval_mode", False)
    if not eval_mode:
        return  # Not an eval - skip
    
    group_id_str = data.get("group_id")
    run_id = data.get("run_id")
    
    if not group_id_str:
        return  # Missing group_id
    
    group_id = uuid.UUID(group_id_str)
    
    # Get eval context from group_id via SQL lookup
    # TODO: Create SQL function to get test_id, attempt_id, eval_id from group_id
    # For now, emit with group_id and run_id - next.py can look up context
    # The group_id links to the test/attempt/eval via group_runs, eval_groups, etc.
    
    async with get_db_connection() as conn:
        # Query to get eval context from group_id
        # This will need a SQL function like:
        # SELECT test_id, attempt_id, eval_id FROM groups g
        # JOIN eval_groups eg ON eg.group_id = g.id
        # JOIN attempt_tests at ON at.test_id = (SELECT test_id FROM tests WHERE trace_id = ...)
        # WHERE g.id = $1
        # OR simpler: get from group_runs -> runs -> test_runs -> tests -> attempt_tests
        
        # For now, emit with group_id and run_id - next.py can look up context
        await internal_sio.emit(
            "benchmark_eval_complete",
            {
                "group_id": group_id_str,
                "run_id": run_id,
                "success": True,
                "message": "Eval completed successfully",
            },
        )
