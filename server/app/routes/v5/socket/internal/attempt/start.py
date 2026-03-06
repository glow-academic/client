"""Internal attempt_start handler — creates a new attempt, then delegates to attempt_proceed.

Handles: @internal_sio.on("attempt_start")

Flow:
1. Resolve session_id, profiles_resource_id, persona_id, num_chats, simulation metadata
2. Create run (with profile link) via create_run
3. Create persona entry (with resource link) via create_persona
4. Create attempt entry (with profiles connection) via create_attempt
5. Create parent bridge via create_attempt_practice/home
6. Refresh MVs + invalidate cache
7. Emit attempt_proceed with attempt_id
"""

from __future__ import annotations

import uuid
from typing import Any

from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.get_db_connection import get_db_connection
from app.routes.auth.access import get_access_internal
from app.routes.v5.socket.client.types import AttemptStartPayload
from app.routes.v5.socket.internal.attempt.types import (
    AttemptErrorData,
    AttemptProceedData,
)
from app.routes.v5.tools.entries.attempt.create import create_attempt
from app.routes.v5.tools.entries.attempt.refresh import refresh_attempt
from app.routes.v5.tools.entries.attempt_chat.refresh import refresh_attempt_chat
from app.routes.v5.tools.entries.attempt_home.create import create_attempt_home
from app.routes.v5.tools.entries.attempt_practice.create import create_attempt_practice
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.home.get import get_home_entries_internal
from app.routes.v5.tools.entries.home_chat.search import search_home_chats
from app.routes.v5.tools.entries.persona.create import create_persona
from app.routes.v5.tools.entries.practice.get import get_practice_entries_internal
from app.routes.v5.tools.entries.practice_chat.search import search_practice_chats
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.resources.profile_personas.get import (
    get_profile_personas,
)
from app.routes.v5.tools.resources.simulations.get import get_simulations
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
                # --- Resolution via _internal() calls ---

                # 1. Resolve profiles_resource_id via access internal
                access = await get_access_internal(conn, profile_id, bypass_cache=True)
                profiles_resource_id = access.profiles_id
                if not profiles_resource_id:
                    raise ValueError(
                        f"Profile resource not found for profile_id {profile_id}"
                    )

                # 2. Get parent entry data (persona_ids, simulation_ids)
                parent_id = payload.practice_id if is_practice else payload.home_id
                if not parent_id:
                    raise ValueError("Either practice_id or home_id is required")

                if is_practice:
                    entries = await get_practice_entries_internal(
                        conn, [parent_id], bypass_cache=True
                    )
                else:
                    entries = await get_home_entries_internal(
                        conn, [parent_id], bypass_cache=True
                    )

                if not entries:
                    raise ValueError(f"Parent entry not found: {parent_id}")
                parent_entry = entries[0]

                # 3. Resolve persona_id from parent's profile_personas
                persona_ids = parent_entry.get("persona_ids") or []
                if not persona_ids:
                    raise ValueError("No profile personas found in parent")

                profile_personas = await get_profile_personas(
                    conn,
                    [uuid.UUID(pid) for pid in persona_ids],
                    redis=get_redis_client(),
                    bypass_cache=True,
                )

                # Find the persona matching this profile
                persona_id = None
                for pp in profile_personas:
                    if pp.profile_id == profiles_resource_id:
                        persona_id = pp.persona_id
                        break

                if not persona_id:
                    raise ValueError("No profile persona found matching this profile")

                # 4. Count chats from parent via search internal
                if is_practice:
                    chat_entries = await search_practice_chats(
                        conn,
                        practice_ids=[payload.practice_id],
                        limit=1000,
                        bypass_mv=True,
                    )
                else:
                    chat_entries = await search_home_chats(
                        conn,
                        home_ids=[payload.home_id],
                        limit=1000,
                        bypass_mv=True,
                    )
                num_chats = max(len(chat_entries), 1)

                # 5. Resolve simulation name/description
                simulation_ids = parent_entry.get("simulation_ids") or []
                sim_name = None
                sim_desc = None
                if simulation_ids:
                    simulations = await get_simulations(
                        conn,
                        [uuid.UUID(sid_str) for sid_str in simulation_ids[:1]],
                        get_redis_client(),
                        bypass_cache=True,
                    )
                    if simulations:
                        sim_name = simulations[0].name
                        sim_desc = simulations[0].description

                # --- Mutations via _internal() calls ---

                # 6. Create run for this group + link profile
                run_result = await create_run(
                    conn,
                    session_id=session_id,
                    group_id=payload.group_id,
                    profiles_id=profiles_resource_id,
                )
                run_id = run_result.id

                # 7. Create persona entry + link to personas_resource
                persona_result = await create_persona(conn, personas_id=persona_id)

                # 8. Create call + attempt entry + profiles connection
                call = await create_call(
                    conn,
                    run_id=run_id,
                    session_id=session_id,
                )
                attempt_result = await create_attempt(
                    conn,
                    call_id=call.id,
                    user_persona_id=persona_result.id,
                    profiles_id=profiles_resource_id,
                    name=sim_name or "",
                    description=sim_desc or "",
                    infinite_mode=payload.infinite_mode,
                    num_chats=num_chats,
                    practice=is_practice,
                )
                attempt_id = attempt_result.id

                # 9. Create parent bridge
                if is_practice:
                    await create_attempt_practice(
                        conn,
                        attempt_id=attempt_id,
                        practice_id=payload.practice_id,
                        session_id=session_id,
                    )
                else:
                    await create_attempt_home(
                        conn,
                        attempt_id=attempt_id,
                        home_id=payload.home_id,
                        session_id=session_id,
                    )

        # Step 2: Refresh MVs so the attempt is visible immediately
        async with get_db_connection() as conn:
            await refresh_attempt(conn)
            await refresh_attempt_chat(conn)

        # Step 3: Delegate to attempt_proceed
        await internal_sio.emit(
            "attempt_proceed",
            AttemptProceedData(
                sid=sid,
                attempt_id=str(attempt_id),
                group_id=str(payload.group_id),
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
