"""Internal attempt_start handler — creates a new attempt, then delegates to attempt_proceed.

Handles: @internal_sio.on("attempt_start")

Flow:
1. Resolve session_id, profiles_resource_id, persona_id, num_chats, simulation metadata
2. Create run (with profile link) via create_runs_entry_internal
3. Create persona entry (with resource link) via create_persona_entry_internal
4. Create attempt entry (with profiles connection) via create_attempt_entry_internal
5. Create parent bridge via create_attempt_practice/home_entry_internal
6. Refresh MVs + invalidate cache
7. Emit attempt_proceed with attempt_id
"""

from __future__ import annotations

import uuid
from typing import Any

from app.api.v4.entries.attempt.create import create_attempt_entry_internal
from app.api.v4.entries.attempt_home.create import create_attempt_home_entry_internal
from app.api.v4.entries.attempt_practice.create import (
    create_attempt_practice_entry_internal,
)
from app.api.v4.entries.persona.create import create_persona_entry_internal
from app.api.v4.entries.runs.create import create_runs_entry_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.find_session_by_socket import find_session_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.client.types import AttemptStartPayload
from app.socket.v5.internal.attempt.types import (
    AttemptErrorData,
    AttemptProceedData,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_start")  # type: ignore
async def attempt_start_handler(data: dict[str, Any]) -> None:
    """Handle attempt_start — create a new attempt, then emit attempt_proceed."""
    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        payload = AttemptStartPayload(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_start payload: {e}")
        return

    is_practice = payload.practice_id is not None

    try:
        # Resolve session_id from socket
        session_id_str = await find_session_by_socket(sid)
        if not session_id_str:
            raise ValueError("Session not found for socket")
        session_id = uuid.UUID(session_id_str)

        async with get_db_connection() as conn:
            async with conn.transaction():
                # --- Resolution queries (reads) ---

                # 1. Resolve profiles_resource_id
                profiles_resource_id = await conn.fetchval(
                    """SELECT pp.profiles_id
                    FROM profile_profiles_junction pp
                    WHERE pp.profile_id = $1 AND pp.active = true
                    LIMIT 1""",
                    profile_id,
                )
                if not profiles_resource_id:
                    raise ValueError(
                        f"Profile resource not found for profile_id {profile_id}"
                    )

                # 2. Resolve persona_id from parent's profile_personas_resource
                if is_practice:
                    persona_id = await conn.fetchval(
                        """SELECT ppr.persona_id
                        FROM practice_profile_personas_connection hpp
                        JOIN profile_personas_resource ppr
                            ON ppr.id = hpp.profile_personas_id AND ppr.active = true
                        WHERE hpp.practice_id = $1
                          AND hpp.active = true
                          AND ppr.profile_id = $2
                        LIMIT 1""",
                        payload.practice_id,
                        profiles_resource_id,
                    )
                else:
                    persona_id = await conn.fetchval(
                        """SELECT ppr.persona_id
                        FROM home_profile_personas_connection hpp
                        JOIN profile_personas_resource ppr
                            ON ppr.id = hpp.profile_personas_id AND ppr.active = true
                        WHERE hpp.home_id = $1
                          AND hpp.active = true
                          AND ppr.profile_id = $2
                        LIMIT 1""",
                        payload.home_id,
                        profiles_resource_id,
                    )

                if not persona_id:
                    raise ValueError("No profile persona found in parent")

                # 3. Count chats from parent
                if is_practice:
                    num_chats = await conn.fetchval(
                        """SELECT COUNT(*)::int
                        FROM practice_chat_entry
                        WHERE practice_id = $1 AND active = true""",
                        payload.practice_id,
                    )
                else:
                    num_chats = await conn.fetchval(
                        """SELECT COUNT(*)::int
                        FROM home_chat_entry
                        WHERE home_id = $1 AND active = true""",
                        payload.home_id,
                    )
                num_chats = max(num_chats or 1, 1)

                # 4. Resolve simulation name/description from parent
                if is_practice:
                    sim_row = await conn.fetchrow(
                        """SELECT sr.name, sr.description
                        FROM practice_simulations_connection psc
                        JOIN simulations_resource sr
                            ON sr.id = psc.simulations_id AND sr.active = true
                        WHERE psc.practice_id = $1 AND psc.active = true
                        LIMIT 1""",
                        payload.practice_id,
                    )
                else:
                    sim_row = await conn.fetchrow(
                        """SELECT sr.name, sr.description
                        FROM home_simulations_connection hsc
                        JOIN simulations_resource sr
                            ON sr.id = hsc.simulations_id AND sr.active = true
                        WHERE hsc.home_id = $1 AND hsc.active = true
                        LIMIT 1""",
                        payload.home_id,
                    )
                sim_name = sim_row["name"] if sim_row else None
                sim_desc = sim_row["description"] if sim_row else None

                # --- Mutations via _internal() calls ---

                # 5. Create run for this group + link profile
                run_result = await create_runs_entry_internal(
                    conn,
                    session_id=session_id,
                    group_id=payload.group_id,
                    profiles_id=profiles_resource_id,
                )
                run_id = run_result.id

                # 6. Create persona entry + link to personas_resource
                persona_result = await create_persona_entry_internal(
                    conn,
                    {"run_id": str(run_id), "personas_id": str(persona_id)},
                )

                # 7. Create attempt entry + profiles connection
                attempt_result = await create_attempt_entry_internal(
                    conn,
                    {
                        "run_id": str(run_id),
                        "infinite_mode": payload.infinite_mode,
                        "num_chats": num_chats,
                        "user_persona_id": str(persona_result.id),
                        "name": sim_name,
                        "description": sim_desc,
                        "practice": is_practice,
                        "profiles_id": str(profiles_resource_id),
                    },
                )
                attempt_id = attempt_result.id

                # 8. Create parent bridge
                if is_practice:
                    await create_attempt_practice_entry_internal(
                        conn,
                        {
                            "run_id": str(run_id),
                            "attempt_id": str(attempt_id),
                            "practice_id": str(payload.practice_id),
                        },
                    )
                else:
                    await create_attempt_home_entry_internal(
                        conn,
                        {
                            "run_id": str(run_id),
                            "attempt_id": str(attempt_id),
                            "home_id": str(payload.home_id),
                        },
                    )

        # Step 2: Refresh MVs so the attempt is visible immediately
        async with get_db_connection() as conn:
            await conn.execute("REFRESH MATERIALIZED VIEW attempt_mv")
            await conn.execute("REFRESH MATERIALIZED VIEW attempt_chat_mv")
        await invalidate_tags(["attempt", "attempts"])

        # Step 3: Delegate to attempt_proceed
        await internal_sio.emit(
            "attempt_proceed",
            AttemptProceedData(
                sid=sid,
                attempt_id=str(attempt_id),
                force_proceed=False,
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in attempt_start: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="start",
                message=f"Failed to start attempt: {e}",
            ).model_dump(mode="json"),
        )
