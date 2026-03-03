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

from app.v5.api.auth.access import get_access_internal
from app.v5.api.entries.attempt.create import create_attempt_entry_internal
from app.v5.api.entries.attempt.refresh import refresh_attempt_internal
from app.v5.api.entries.attempt_chat.refresh import refresh_attempt_chat_internal
from app.v5.api.entries.attempt_home.create import create_attempt_home_entry_internal
from app.v5.api.entries.attempt_practice.create import (
    create_attempt_practice_entry_internal,
)
from app.v5.api.entries.home.get import get_home_entries_internal
from app.v5.api.entries.home_chat.search import search_home_chat_entries_internal
from app.v5.api.entries.persona.create import create_persona_entry_internal
from app.v5.api.entries.practice.get import get_practice_entries_internal
from app.v5.api.entries.practice_chat.search import (
    search_practice_chat_entries_internal,
)
from app.v5.api.entries.runs.create import create_runs_entry_internal
from app.v5.api.resources.profile_personas.get import get_profile_personas_internal
from app.v5.api.resources.simulations.get import get_simulations_internal
from app.v5.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.v5.infra.websocket.find_session_by_socket import find_session_by_socket
from app.v5.infra.websocket.get_db_connection import get_db_connection
from app.globals import get_internal_sio
from app.v5.api.socket.client.types import AttemptStartPayload
from app.v5.api.socket.internal.attempt.types import (
    AttemptErrorData,
    AttemptProceedData,
)
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

                profile_personas = await get_profile_personas_internal(
                    conn,
                    [uuid.UUID(pid) for pid in persona_ids],
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
                    chat_entries = await search_practice_chat_entries_internal(
                        conn,
                        practice_id=payload.practice_id,
                        limit_count=1000,
                        bypass_cache=True,
                    )
                else:
                    chat_entries = await search_home_chat_entries_internal(
                        conn,
                        home_id=payload.home_id,
                        limit_count=1000,
                        bypass_cache=True,
                    )
                num_chats = max(len(chat_entries), 1)

                # 5. Resolve simulation name/description
                simulation_ids = parent_entry.get("simulation_ids") or []
                sim_name = None
                sim_desc = None
                if simulation_ids:
                    simulations = await get_simulations_internal(
                        conn,
                        [uuid.UUID(sid_str) for sid_str in simulation_ids[:1]],
                        bypass_cache=True,
                    )
                    if simulations:
                        sim_name = simulations[0].name
                        sim_desc = simulations[0].description

                # --- Mutations via _internal() calls ---

                # 6. Create run for this group + link profile
                run_result = await create_runs_entry_internal(
                    conn,
                    session_id=session_id,
                    group_id=payload.group_id,
                    profiles_id=profiles_resource_id,
                )
                run_id = run_result.id

                # 7. Create persona entry + link to personas_resource
                persona_result = await create_persona_entry_internal(
                    conn,
                    {"run_id": str(run_id), "personas_id": str(persona_id)},
                )

                # 8. Create attempt entry + profiles connection
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

                # 9. Create parent bridge
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
            await refresh_attempt_internal(conn)
            await refresh_attempt_chat_internal(conn)

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
