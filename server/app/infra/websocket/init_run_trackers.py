"""Initialize Redis generation trackers for a run.

Wraps init_generation + init_resource_progress into one call
with redis as an explicit parameter for testability.
"""

from __future__ import annotations

from typing import Any

from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

# TTL for generation tracking keys (1 hour)
GENERATION_TTL = 3600


async def init_run_trackers(
    redis: Any,
    *,
    run_id: str,
    num_agents: int,
    num_resources: int,
) -> None:
    """Initialize both generation and resource progress trackers.

    When redis is None, silently skips (matches existing fallback behavior).
    """
    if not redis:
        return

    gen_key = f"generation:{run_id}"
    res_key = f"resource_progress:{run_id}"

    try:
        pipe = redis.pipeline()
        pipe.hset(
            gen_key,
            mapping={
                "expected": str(num_agents),
                "completed": "0",
                "tool_results": "[]",
            },
        )
        pipe.expire(gen_key, GENERATION_TTL)
        pipe.hset(
            res_key,
            mapping={
                "total": str(num_resources),
                "completed": "0",
            },
        )
        pipe.expire(res_key, GENERATION_TTL)
        await pipe.execute()
    except Exception as e:
        logger.error(f"Redis error initializing trackers for run {run_id}: {e}")
