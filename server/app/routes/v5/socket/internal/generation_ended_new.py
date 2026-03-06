"""Generation resolution finalization — handles test_ended for generation runs.

Listens for: test_ended (emitted by test/proceed.py when all invocations done)

Flow:
  1. Look up generation_run_id via generation_test_link:{test_id}
  2. Load generation resolution context from generation_resolution:{run_id}
  3. For each contested target: compare scores, promote winner, fail losers
  4. Emit generation_complete to client
  5. Cleanup Redis keys

TODO: Currently uses highest score wins. Should be configurable per artifact type.
TODO: Link test_id to run more intimately so score traces back via test_grade_entry
      without metadata duplication.
"""

from __future__ import annotations

import json
from typing import Any

from app.infra.globals import get_internal_sio, get_redis_client
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


# NOTE: Not registered yet. To activate: import and register.
async def handle_generation_ended(data: dict[str, Any]) -> None:
    """Resolve contested targets after test grading completes.

    Triggered by test_ended. Looks up generation context, compares scores,
    promotes winners, fails losers, emits generation_complete.
    """
    test_id = data.get("test_id")
    if not test_id:
        return

    redis = get_redis_client()
    if not redis:
        return

    # Step 1: Look up generation_run_id from test_id
    try:
        run_id = await redis.get(f"generation_test_link:{test_id}")
    except Exception:
        return

    if not run_id:
        return  # Not a generation-linked test

    if isinstance(run_id, bytes):
        run_id = run_id.decode()

    # Step 2: Load resolution context
    try:
        ctx_raw = await redis.get(f"generation_resolution:{run_id}")
    except Exception as e:
        logger.exception(f"Failed to load resolution context for {run_id}: {e}")
        return

    if not ctx_raw:
        logger.warning(f"No resolution context found for run {run_id}")
        return

    ctx = json.loads(ctx_raw)
    sid = ctx.get("sid", "")
    artifact_type = ctx.get("artifact_type", "unknown")
    group_id_str = ctx.get("group_id", "")
    resource_actions = ctx.get("resource_actions", {})
    contested_targets = ctx.get("contested_targets", [])

    # Step 3: Get all units and resolve contested targets
    units = await get_all_units(redis, run_id=run_id)

    for target_info in contested_targets:
        target_type = target_info["target_type"]
        target_name = target_info["target_name"]
        agents = target_info["agents"]

        # Collect scores from unit metadata
        scored_agents: list[tuple[str, int | None, str | None]] = []
        for agent_info in agents:
            agent_id = agent_info["agent_id"]
            result_id = agent_info.get("result_id")
            unit_key = f"{agent_id}:{target_type}:{target_name}"
            unit = units.get(unit_key)
            score = unit.metadata.get("score") if unit else None
            scored_agents.append((agent_id, score, result_id))

        # Pick winner: highest score wins, None scores lose
        winner = _pick_winner(scored_agents)

        for agent_id, score, result_id in scored_agents:
            try:
                if agent_id == winner:
                    await promote_unit(
                        redis,
                        run_id=run_id,
                        agent_id=agent_id,
                        target_type=target_type,
                        target_name=target_name,
                    )
                    # TODO: Wire create_tool_call(soft=false) to activate the
                    # DB record. promote_unit only updates Redis state.
                    logger.info(
                        f"Promoted {agent_id}:{target_type}:{target_name} "
                        f"(score={score})"
                    )
                else:
                    await fail_unit(
                        redis,
                        run_id=run_id,
                        agent_id=agent_id,
                        target_type=target_type,
                        target_name=target_name,
                    )
                    logger.info(
                        f"Failed {agent_id}:{target_type}:{target_name} "
                        f"(score={score})"
                    )
            except Exception as e:
                logger.exception(
                    f"Failed to resolve {agent_id}:{target_type}:{target_name}: {e}"
                )

    # Step 4: Emit generation_complete
    events: list[SocketEvent] = []
    events.append(internal_event(
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
    ))

    # Step 5: Cleanup
    await cleanup_run(redis, run_id=run_id)
    try:
        await redis.delete(
            f"generation_resolution:{run_id}",
            f"generation_test_link:{test_id}",
        )
    except Exception:
        pass

    await flush_events(events, internal_sio=internal_sio)


def _pick_winner(
    agents: list[tuple[str, int | None, str | None]],
) -> str | None:
    """Pick the agent with the highest score. None scores are treated as -inf.

    Returns the winning agent_id, or the first agent if all scores are None.
    """
    best_agent: str | None = None
    best_score: int | None = None

    for agent_id, score, _result_id in agents:
        if score is not None:
            if best_score is None or score > best_score:
                best_score = score
                best_agent = agent_id

    # If no scores at all, pick first agent
    if best_agent is None and agents:
        best_agent = agents[0][0]

    return best_agent
