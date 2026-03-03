"""Internal attempt_proceed handler — shared core logic for starting a chat scenario.

Handles: @internal_sio.on("attempt_proceed")

All attempt lifecycle events route through here:
- attempt_start / attempt_next → proceed with attempt_id
- attempt_end → proceed with completed_chat_id (marks chat done, then finds next)
- attempt_end_all → proceed with complete_all=True (marks all done → ended)

Flow (all via _internal() calls — zero inline SQL):
1. If completed_chat_id → create_attempt_completion_entry_internal
2. If complete_all → search bridges → loop create completions → refresh → ended
3. Resolve context: attempt entry → bridges → parent chats → chat entry
4. Check if all chats are done → emit attempt_ended
5. Resolve department from chat entry + attempt fallback
6. Branch on generation/user-choice flags
7. Create attempt_chat_entry (with connection params) + bridge (separate)
8. If generation → emit generate; else → refresh MVs + emit chat_started
"""

from __future__ import annotations

import uuid
from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.get_db_connection import get_db_connection
from app.routes.auth.access import get_access_internal
from app.routes.v5.socket.internal.attempt.helpers import emit_chat_generate
from app.routes.v5.socket.internal.attempt.types import (
    AttemptChatStartedData,
    AttemptEndedData,
    AttemptErrorData,
    AttemptProceedData,
    AttemptStartedData,
)
from app.routes.v5.tools.entries.attempt.get import get_attempt_entries_internal
from app.routes.v5.tools.entries.attempt.refresh import refresh_attempt_internal
from app.routes.v5.tools.entries.attempt_chat.create import (
    create_attempt_chat_entry_internal,
)
from app.routes.v5.tools.entries.attempt_chat.refresh import (
    refresh_attempt_chat_internal,
)
from app.routes.v5.tools.entries.attempt_chat_bridge.create import (
    create_attempt_chat_bridge_entry_internal,
)
from app.routes.v5.tools.entries.attempt_chat_bridge.search import (
    search_attempt_chat_bridge_entries_internal,
)
from app.routes.v5.tools.entries.attempt_completion.create import (
    create_attempt_completion_entry_internal,
)
from app.routes.v5.tools.entries.attempt_home.search import (
    search_attempt_home_entries_internal,
)
from app.routes.v5.tools.entries.attempt_practice.search import (
    search_attempt_practice_entries_internal,
)
from app.routes.v5.tools.entries.chat.get import get_chat_entries_internal
from app.routes.v5.tools.entries.home_chat.search import (
    search_home_chat_entries_internal,
)
from app.routes.v5.tools.entries.practice_chat.search import (
    search_practice_chat_entries_internal,
)
from app.routes.v5.tools.entries.runs.create import create_runs_entry_internal
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

# Map generate_* flag names to resource_types for the generate pipeline
GENERATE_FLAG_TO_RESOURCE = {
    "generate_problem_statements": "problem_statements",
    "generate_objectives": "objectives",
    "generate_videos": "videos",
    "generate_images": "images",
    "generate_questions": "questions",
    "generate_names": "names",
    "generate_descriptions": "descriptions",
    "generate_personas": "personas",
    "generate_documents": "documents",
    "generate_options": "options",
    "generate_parameter_fields": "parameter_fields",
}

# Map generate_* flag names to connection param names on create_attempt_chat_entry
GENERATE_FLAG_TO_CONNECTION = {
    "generate_personas": "personas_ids",
    "generate_problem_statements": "problem_statements_ids",
    "generate_objectives": "objectives_ids",
    "generate_questions": "questions_ids",
    "generate_options": "options_ids",
    "generate_videos": "videos_ids",
    "generate_images": "images_ids",
    "generate_documents": "documents_ids",
    "generate_parameter_fields": "parameter_fields_ids",
}

# Map chat_mv connection array names to create_attempt_chat_entry param names
CHAT_CONNECTION_TO_PARAM = {
    "persona_ids": "personas_ids",
    "problem_statement_ids": "problem_statements_ids",
    "objective_ids": "objectives_ids",
    "question_ids": "questions_ids",
    "option_ids": "options_ids",
    "video_ids": "video_ids",
    "image_ids": "images_ids",
    "document_ids": "documents_ids",
    "parameter_field_ids": "parameter_fields_ids",
}


@internal_sio.on("attempt_proceed")  # type: ignore
async def attempt_proceed_handler(data: dict[str, Any]) -> None:
    """Shared core: resolve context → check done → resolve chat → emit."""
    sid = data.get("sid", "")
    if not sid:
        return

    try:
        payload = AttemptProceedData(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_proceed payload: {e}")
        return

    # Step 1: Resolve profile_id from socket
    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        logger.warning("No profile_id for attempt_proceed")
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        attempt_id = uuid.UUID(payload.attempt_id)
        force_proceed = payload.force_proceed
        draft_id = uuid.UUID(payload.draft_id) if payload.draft_id else None
        completed_chat_id = (
            uuid.UUID(payload.completed_chat_id) if payload.completed_chat_id else None
        )
        complete_all = payload.complete_all

        # Resolve session + create run for entry creates
        session_id_str = await find_session_by_socket(sid)
        if not session_id_str:
            raise ValueError("Session not found for socket")
        session_id = uuid.UUID(session_id_str)

        async with get_db_connection() as conn:
            access = await get_access_internal(conn, profile_id, bypass_cache=True)
            profiles_resource_id = access.profiles_id

            run_result = await create_runs_entry_internal(
                conn,
                session_id=session_id,
                profiles_id=profiles_resource_id,
            )
            run_id = run_result.id

        # Step 2a: If completed_chat_id, mark that chat completed
        if completed_chat_id:
            async with get_db_connection() as conn:
                try:
                    await create_attempt_completion_entry_internal(
                        conn,
                        {"chat_id": str(completed_chat_id)},
                        run_id=run_id,
                    )
                except Exception:
                    # Already completed — ON CONFLICT equivalent
                    logger.debug(f"Chat {completed_chat_id} already completed")

        # Step 2b: If complete_all, mark all remaining chats completed → ended
        if complete_all:
            async with get_db_connection() as conn:
                # Find all bridges for this attempt
                bridges = await search_attempt_chat_bridge_entries_internal(
                    conn,
                    attempt_id=attempt_id,
                    limit_count=1000,
                    bypass_cache=True,
                )

                # Create completion for each bridge (skip already-completed)
                for bridge in bridges:
                    bridge_chat_id = bridge.get("attempt_chat_id")
                    if bridge_chat_id:
                        try:
                            await create_attempt_completion_entry_internal(
                                conn,
                                {"chat_id": str(bridge_chat_id)},
                                run_id=run_id,
                            )
                        except Exception:
                            # Already completed
                            pass

                # Refresh MVs
                await refresh_attempt_internal(conn)
                await refresh_attempt_chat_internal(conn)

            await internal_sio.emit(
                "attempt_ended",
                AttemptEndedData(
                    sid=sid,
                    attempt_id=str(attempt_id),
                    success=True,
                    all_scenarios_complete=True,
                    message="All scenarios completed",
                ).model_dump(mode="json"),
            )
            return

        # ---- Context Resolution (replacing get_attempt_proceed_context) ----

        async with get_db_connection() as conn:
            # 3a. Get attempt entry (num_chats, practice flag, department_id)
            attempt_entries = await get_attempt_entries_internal(
                conn, [attempt_id], bypass_cache=True
            )
            if not attempt_entries:
                raise ValueError(f"Attempt not found: {attempt_id}")
            attempt_data = attempt_entries[0]

            num_chats = attempt_data.get("num_chats", 1)
            is_practice = attempt_data.get("practice", False)
            attempt_department_id = attempt_data.get("department_id")

            # 3b. Get already-resolved bridges (completed_count + resolved chat_ids)
            bridges = await search_attempt_chat_bridge_entries_internal(
                conn,
                attempt_id=attempt_id,
                limit_count=1000,
                bypass_cache=True,
            )
            resolved_chat_ids = {
                bridge.get("chat_id") for bridge in bridges if bridge.get("chat_id")
            }
            completed_count = len(bridges)

            # 3c. Get parent chat_ids from practice/home
            if is_practice:
                practice_entries = await search_attempt_practice_entries_internal(
                    conn, attempt_id=attempt_id, bypass_cache=True
                )
                if not practice_entries:
                    raise ValueError("No practice link for this attempt")
                practice_id = uuid.UUID(practice_entries[0].get("practice_id"))
                parent_chat_links = await search_practice_chat_entries_internal(
                    conn, practice_id=practice_id, limit_count=1000, bypass_cache=True
                )
            else:
                home_entries = await search_attempt_home_entries_internal(
                    conn, attempt_id=attempt_id, bypass_cache=True
                )
                if not home_entries:
                    raise ValueError("No home link for this attempt")
                home_id = uuid.UUID(home_entries[0].get("home_id"))
                parent_chat_links = await search_home_chat_entries_internal(
                    conn, home_id=home_id, limit_count=1000, bypass_cache=True
                )

            # Extract all parent chat_ids
            all_parent_chat_ids = [
                uuid.UUID(link.get("chat_id"))
                for link in parent_chat_links
                if link.get("chat_id")
            ]

            # 3d. Get chat entry details for all parent chats (includes position)
            all_chat_entries = await get_chat_entries_internal(
                conn,
                all_parent_chat_ids,
                bypass_cache=True,
            )

            # Sort by position, filter out already-resolved
            remaining = [
                ce
                for ce in all_chat_entries
                if str(ce.get("chat_entry_id"))
                not in {str(rid) for rid in resolved_chat_ids}
            ]
            remaining.sort(
                key=lambda ce: (
                    ce.get("position", 0) or 0,
                    str(ce.get("created_at", "")),
                )
            )

        # Step 4: Check if all chats are done
        if not remaining or completed_count >= num_chats:
            await internal_sio.emit(
                "attempt_ended",
                AttemptEndedData(
                    sid=sid,
                    attempt_id=str(attempt_id),
                    success=True,
                    all_scenarios_complete=True,
                    message="All scenarios completed",
                ).model_dump(mode="json"),
            )
            return

        # Next chat to resolve
        next_chat = remaining[0]
        chat_entry_id = uuid.UUID(str(next_chat.get("chat_entry_id")))

        # Step 5: Resolve department
        chat_department_ids = next_chat.get("department_ids") or []
        if len(chat_department_ids) == 1:
            department_id = uuid.UUID(str(chat_department_ids[0]))
        elif attempt_department_id:
            department_id = uuid.UUID(str(attempt_department_id))
        else:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="proceed",
                    message="No department could be resolved for this chat",
                ).model_dump(mode="json"),
            )
            return

        # Step 6: Determine generation needs and user choices
        resource_types_to_generate: list[str] = []
        for flag_name, resource_type in GENERATE_FLAG_TO_RESOURCE.items():
            if next_chat.get(flag_name, False):
                resource_types_to_generate.append(resource_type)

        needs_generation = len(resource_types_to_generate) > 0
        has_user_choice = bool(next_chat.get("use_custom")) or bool(
            next_chat.get("use_previous")
        )

        # Step 7: Branch on state
        if has_user_choice and not force_proceed:
            # Path 4: Show lobby — user needs to choose
            await internal_sio.emit(
                "attempt_started",
                AttemptStartedData(
                    sid=sid,
                    attempt_id=str(attempt_id),
                    chat_entry_id=str(chat_entry_id),
                ).model_dump(mode="json"),
            )
            return

        # ---- Write Phase (replacing resolve_attempt_chat) ----

        # Build request_dict from chat entry data
        request_dict: dict[str, Any] = {
            "chat_id": str(chat_entry_id),
            "title": next_chat.get("name") or "",
            "position": next_chat.get("position", 0),
            "time_limit": next_chat.get("time_limit"),
            "negative_time": next_chat.get("negative_time", False),
            "audio_enabled": next_chat.get("audio_enabled", True),
            "text_enabled": next_chat.get("text_enabled", True),
            "hints_enabled": next_chat.get("hints_enabled", False),
            "copy_paste_allowed": next_chat.get("copy_paste_allowed", True),
            "show_images": next_chat.get("show_images", True),
            "show_objectives": next_chat.get("show_objectives", True),
            "show_problem_statement": next_chat.get("show_problem_statement", True),
            "analyses_enabled": next_chat.get("analyses_enabled", True),
            "improvements_enabled": next_chat.get("improvements_enabled", True),
            "replacements_enabled": next_chat.get("replacements_enabled", True),
            "strengths_enabled": next_chat.get("strengths_enabled", True),
            "use_custom": next_chat.get("use_custom", False),
            "use_previous": next_chat.get("use_previous", False),
            "problem_statement_enabled": next_chat.get(
                "problem_statement_enabled", True
            ),
            "objectives_enabled": next_chat.get("objectives_enabled", True),
            "video_enabled": next_chat.get("video_enabled", False),
            "images_enabled": next_chat.get("images_enabled", False),
            "questions_enabled": next_chat.get("questions_enabled", False),
        }

        # Always-copied connections: rubrics, standards, standard_groups, departments
        rubric_ids = next_chat.get("rubric_ids") or []
        if rubric_ids:
            request_dict["rubrics_ids"] = [str(rid) for rid in rubric_ids]

        standard_ids = next_chat.get("standard_ids") or []
        if standard_ids:
            request_dict["standards_ids"] = [str(sid_val) for sid_val in standard_ids]

        standard_group_ids = next_chat.get("standard_group_ids") or []
        if standard_group_ids:
            request_dict["standard_groups_ids"] = [
                str(sgid) for sgid in standard_group_ids
            ]

        department_ids_list = next_chat.get("department_ids") or []
        if department_ids_list:
            request_dict["departments_ids"] = [str(did) for did in department_ids_list]

        # Conditional connections: only copy when generate_*=false
        for gen_flag, conn_param in GENERATE_FLAG_TO_CONNECTION.items():
            if not next_chat.get(gen_flag, False):
                # Not generating → copy from chat entry
                chat_mv_key = {
                    "personas_ids": "persona_ids",
                    "problem_statements_ids": "problem_statement_ids",
                    "objectives_ids": "objective_ids",
                    "questions_ids": "question_ids",
                    "options_ids": "option_ids",
                    "videos_ids": "video_ids",
                    "images_ids": "image_ids",
                    "documents_ids": "document_ids",
                    "parameter_fields_ids": "parameter_field_ids",
                }.get(conn_param, conn_param)

                ids_from_chat = next_chat.get(chat_mv_key) or []
                if ids_from_chat:
                    request_dict[conn_param] = [str(cid) for cid in ids_from_chat]

        # Step 8: Create attempt_chat entry + bridge (separate)
        async with get_db_connection() as conn:
            async with conn.transaction():
                chat_result = await create_attempt_chat_entry_internal(
                    conn, request_dict, run_id=run_id
                )
                attempt_chat_id = chat_result.id

                await create_attempt_chat_bridge_entry_internal(
                    conn,
                    {
                        "attempt_id": str(attempt_id),
                        "attempt_chat_id": str(attempt_chat_id),
                    },
                    run_id=run_id,
                )

        # Step 9: Post-write
        if needs_generation:
            # Paths 2 & 3 (with generation): emit generate
            await emit_chat_generate(
                sid=sid,
                profile_id=profile_id,
                attempt_id=attempt_id,
                chat_entry_id=chat_entry_id,
                department_id=department_id,
                attempt_chat_id=attempt_chat_id,
                draft_id=draft_id,
                resource_types=resource_types_to_generate,
            )
        else:
            # Paths 1 & 3 (no generation): refresh MVs, emit chat_started
            async with get_db_connection() as conn:
                await refresh_attempt_internal(conn)
                await refresh_attempt_chat_internal(conn)

            await internal_sio.emit(
                "attempt_chat_started",
                AttemptChatStartedData(
                    sid=sid,
                    attempt_id=str(attempt_id),
                    chat_id=str(attempt_chat_id),
                ).model_dump(mode="json"),
            )

    except Exception as e:
        logger.exception(f"Error in attempt_proceed: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="proceed",
                message=f"Failed to proceed: {e}",
            ).model_dump(mode="json"),
        )
