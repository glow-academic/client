"""Per-invocation grade handler for generation resolution.

Listens for: test_grade_progress (emitted by test/complete.py after each grade)

When a grade comes in for a generation-linked test:
  1. Look up generation_run_id via generation_test_link:{test_id} (not available
     on grade events directly — we rely on generation_ended for final resolution).
  2. Store score on the unit's metadata in Redis for generation_ended to read.

NOTE: test_grade_progress has invocation_id but NOT test_id or generation_run_id.
For now, generation_resolve stores per-invocation scores in Redis keyed by
invocation_id. generation_ended (triggered by test_ended which HAS test_id)
collects all scores and resolves.

TODO: Once test_grade_progress includes test_id, we can do incremental
      resolution checks here instead of waiting for test_ended.
"""

from __future__ import annotations

import json
from typing import Any

from app.infra.globals import get_internal_sio, get_redis_client
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

# TTL for score storage (1 hour, matches run tracker)
SCORE_TTL = 3600


@internal_sio.on("test_grade_progress")  # type: ignore
async def handle_generation_resolve(data: dict[str, Any]) -> None:
    """Store invocation grade scores for later resolution by generation_ended.

    Listens to test_grade_progress events. Stores score in Redis keyed by
    invocation_id so generation_ended can collect all scores when test_ended fires.
    """
    invocation_id = data.get("invocation_id")
    if not invocation_id:
        return

    score = data.get("score")
    passed = data.get("passed")
    feedback = data.get("feedback")
    grade_id = data.get("grade_id")

    if score is None and passed is None:
        return  # No grade data

    redis = get_redis_client()
    if not redis:
        return

    grade_data = {
        "invocation_id": invocation_id,
        "score": score,
        "passed": passed,
        "feedback": feedback,
        "grade_id": grade_id,
    }

    try:
        await redis.setex(
            f"generation_grade:{invocation_id}",
            SCORE_TTL,
            json.dumps(grade_data),
        )
        logger.info(
            f"Stored generation grade for invocation {invocation_id}: "
            f"score={score}, passed={passed}"
        )
    except Exception as e:
        logger.warning(f"Failed to store generation grade: {e}")
