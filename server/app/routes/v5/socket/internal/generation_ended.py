"""Generation resolution finalization — handles test_ended for generation runs.

Listens for: test_ended (emitted by test/proceed.py when all invocations done)

Flow:
  1. Load minimal resolution context from generation_resolution:{run_id}
  2. Call resolve_generation_winner(conn, test_id) → winning agent_id from DB grades
  3. Get all run_tracker units → promote winner's targets, fail losers
  4. Activate winner's dormant DB records
  5. Emit generation_complete to client
  6. Cleanup Redis + run tracker
"""

from __future__ import annotations

import json
import uuid as _uuid
from typing import Any

from app.infra.activate.activate import activate_rows
from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.resolve_generation_winner import resolve_generation_winner
from app.infra.websocket.run_tracker import (
    cleanup_run,
    fail_unit,
    get_all_units,
    promote_unit,
)
from app.infra.websocket.socket_event import SocketEvent, flush_events, internal_event
from app.routes.v5.socket.internal.generation_types import GenerationCompleteData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


def _table_name(target_type: str, target_name: str) -> str:
    """Derive DB table from run_tracker target."""
    suffix = "resource" if target_type == "resource" else "entry"
    return f"{target_name}_{suffix}"


@internal_sio.on("test_ended")  # type: ignore
async def handle_generation_ended(data: dict[str, Any]) -> None:
    """Resolve contested targets after test grading completes.

    Triggered by test_ended. Uses resolve_generation_winner to query grades
    from DB, promotes winner's dormant records, fails losers.
    """
    test_id = data.get("test_id")
    if not test_id:
        return

    redis = get_redis_client()
    if not redis:
        return

    # Step 1: Resolve the winning agent from DB grades
    async with get_db_connection() as conn:
        winner = await resolve_generation_winner(conn, test_id=_uuid.UUID(test_id))

    if not winner:
        logger.warning(f"No winner resolved for test {test_id}")
        return

    winning_agent_id = str(winner.winning_agent_id)
    logger.info(
        f"Generation test {test_id} resolved: winner={winning_agent_id} "
        f"score={winner.winning_score}"
    )

    # Step 2: Find run_id — scan resolution keys for this test
    # The run_id is needed to look up units and the resolution context.
    # We find it by checking all results for the run_id that stored this test.
    # The resolution context was stored by generate_run_complete with the run_id
    # from metadata. We need to find it — check the winning invocation's run.
    #
    # Simpler: the test_ended event should carry run_id from the pipeline.
    # For now, search via the invocation's run link.
    run_id = data.get("run_id")

    # Fallback: look up from any invocation's run connection
    if not run_id and winner.all_results:
        try:
            async with get_db_connection() as conn:
                row = await conn.fetchval(
                    """
                    SELECT tirc.runs_id::text
                    FROM test_invocation_runs_entry tire
                    JOIN test_invocation_runs_runs_connection tirc
                        ON tirc.test_invocation_runs_id = tire.id
                    WHERE tire.test_invocation_id = $1 AND tire.active = true
                    LIMIT 1
                    """,
                    winner.winning_invocation_id,
                )
                if row:
                    run_id = row
        except Exception as e:
            logger.exception(f"Failed to look up run_id for test {test_id}: {e}")

    if not run_id:
        logger.warning(f"Could not determine run_id for test {test_id}")
        return

    # Step 3: Load minimal resolution context
    ctx = {}
    try:
        ctx_raw = await redis.get(f"generation_resolution:{run_id}")
        if ctx_raw:
            ctx = json.loads(ctx_raw)
    except Exception as e:
        logger.warning(f"Failed to load resolution context for {run_id}: {e}")

    sid = ctx.get("sid", data.get("sid", ""))
    artifact_type = ctx.get("artifact_type", "unknown")
    group_id_str = ctx.get("group_id", "")
    resource_actions = ctx.get("resource_actions", {})

    # Step 4: Get all units and promote winner / fail losers
    units = await get_all_units(redis, run_id=run_id)

    for unit_key, unit_state in units.items():
        parts = unit_key.split(":", 2)
        if len(parts) != 3:
            continue
        agent_id, target_type, target_name = parts

        try:
            if agent_id == winning_agent_id:
                await promote_unit(
                    redis,
                    run_id=run_id,
                    agent_id=agent_id,
                    target_type=target_type,
                    target_name=target_name,
                )
                # Activate the dormant DB record
                if unit_state.result_id:
                    table = _table_name(target_type, target_name)
                    async with get_db_connection() as conn:
                        await activate_rows(
                            conn,
                            table=table,
                            ids=[_uuid.UUID(unit_state.result_id)],
                        )
                logger.info(
                    f"Promoted {agent_id}:{target_type}:{target_name} "
                    f"(score={winner.winning_score})"
                )
            else:
                await fail_unit(
                    redis,
                    run_id=run_id,
                    agent_id=agent_id,
                    target_type=target_type,
                    target_name=target_name,
                )
                logger.info(f"Failed {agent_id}:{target_type}:{target_name}")
        except Exception as e:
            logger.exception(
                f"Failed to resolve {agent_id}:{target_type}:{target_name}: {e}"
            )

    # Step 5: Emit generation_complete
    events: list[SocketEvent] = []
    events.append(
        internal_event(
            "generation_channel",
            GenerationCompleteData(
                sid=sid,
                artifact_type=artifact_type,
                group_id=group_id_str,
                run_id=run_id,
                success=True,
                message=f"{artifact_type.capitalize()} generation resolved",
                resource_actions=resource_actions,
            ).model_dump(mode="json"),
        )
    )

    # Step 6: Cleanup
    await cleanup_run(redis, run_id=run_id)
    try:
        await redis.delete(f"generation_resolution:{run_id}")
    except Exception:
        pass

    await flush_events(events, internal_sio=internal_sio)
