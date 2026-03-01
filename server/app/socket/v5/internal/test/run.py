"""Internal test_run handler — replay a run against an original conversation.

Handles: @internal_sio.on("test_run")

Flow:
1. Resolve group_id from test_invocation_entry
2. Create new runs_entry (same group) + profile link
3. Copy all messages from original run_id except the last assistant message
4. Create assistant placeholder message
5. Emit generate_artifact with the conversation context
"""

from __future__ import annotations

import uuid
from typing import Any

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.client.types import TestRunPayload
from app.socket.v5.internal.test.types import TestErrorData
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("test_run")  # type: ignore
async def test_run_handler(data: dict[str, Any]) -> None:
    """Handle test_run — copy conversation, create new run, emit generate."""
    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = data.get("profile_id")
    if not profile_id_str:
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        payload = TestRunPayload(**data)
    except Exception as e:
        logger.exception(f"Invalid test_run payload: {e}")
        return

    try:
        test_id = payload.test_id
        test_invocation_id = payload.test_invocation_id
        original_run_id = payload.run_id

        async with get_db_connection() as conn:
            # Step 1: Resolve group_id from test_invocation_entry
            group_id = await conn.fetchval(
                "SELECT group_id FROM test_invocation_entry WHERE id = $1",
                test_invocation_id,
            )

            if not group_id:
                await internal_sio.emit(
                    "test_error",
                    TestErrorData(
                        sid=sid,
                        invocation_id=str(test_invocation_id),
                        message="No group found for test invocation",
                        error_type="run",
                    ).model_dump(mode="json"),
                )
                return

            # Step 2: Create new runs_entry + profile link
            new_run_id = await conn.fetchval(
                """INSERT INTO runs_entry (group_id)
                VALUES ($1) RETURNING id""",
                group_id,
            )

            await conn.execute(
                """INSERT INTO profiles_runs_connection (profiles_id, run_id)
                SELECT ppj.profiles_id, $2
                FROM profile_profiles_junction ppj
                WHERE ppj.profile_id = $1
                LIMIT 1""",
                profile_id,
                new_run_id,
            )

            # Step 3: Fetch all messages from original run, ordered by creation
            original_messages = await conn.fetch(
                """SELECT
                    me.role::text as role,
                    COALESCE(te.content, '') as content,
                    me.created_at
                FROM messages_entry me
                LEFT JOIN texts_entry te ON te.id = me.text_id
                WHERE me.run_id = $1 AND me.active = true
                ORDER BY me.created_at""",
                original_run_id,
            )

            if not original_messages:
                await internal_sio.emit(
                    "test_error",
                    TestErrorData(
                        sid=sid,
                        invocation_id=str(test_invocation_id),
                        message="No messages found in original run",
                        error_type="run",
                    ).model_dump(mode="json"),
                )
                return

            # Remove the last assistant message
            messages_to_copy = list(original_messages)
            for i in range(len(messages_to_copy) - 1, -1, -1):
                if messages_to_copy[i]["role"] == "assistant":
                    messages_to_copy.pop(i)
                    break

            # Copy messages into the new run
            for msg in messages_to_copy:
                # Create text entry
                text_id = await conn.fetchval(
                    """INSERT INTO texts_entry (content)
                    VALUES ($1) RETURNING id""",
                    msg["content"],
                )

                # Create message entry
                await conn.execute(
                    """INSERT INTO messages_entry (run_id, role, text_id, created_at, updated_at)
                    VALUES ($1, $2::message_type, $3, $4, $4)""",
                    new_run_id,
                    msg["role"],
                    text_id,
                    msg["created_at"],
                )

            # Step 4: Create assistant placeholder
            created_at = await conn.fetchval("SELECT NOW()")

            assistant_message_id = await conn.fetchval(
                """INSERT INTO messages_entry (run_id, role, created_at, updated_at)
                VALUES ($1, 'assistant'::message_type, $2, $2)
                RETURNING id""",
                new_run_id,
                created_at,
            )

        # Step 5: Emit test_run_started so the client knows a run is in progress
        await internal_sio.emit(
            "test_run_started",
            {
                "sid": sid,
                "test_id": str(test_id),
                "test_invocation_id": str(test_invocation_id),
                "run_id": str(new_run_id),
                "original_run_id": str(original_run_id),
                "message_id": str(assistant_message_id),
            },
        )

        # Step 6: Build messages for generate_artifact
        conversation_messages = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in messages_to_copy
        ]

        # TODO: resolve LLM config (model, provider, prompt, instructions, tools)
        # from the test invocation's connections — for now emit with placeholder
        await internal_sio.emit(
            "generate_artifact",
            {
                "sid": sid,
                "artifact_type": "test",
                "resource_type": "test",
                "modality": "text",
                "run_id": str(new_run_id),
                "group_id": str(group_id),
                "chat_id": str(test_invocation_id),
                "messages": conversation_messages,
                "llm_config": {},  # TODO: resolve from invocation config
                "tools": [],  # TODO: resolve from invocation config
                "metadata": {
                    "test_id": str(test_id),
                    "test_invocation_id": str(test_invocation_id),
                    "original_run_id": str(original_run_id),
                },
            },
        )

        logger.info(
            f"Test run started - test_id={test_id}, "
            f"invocation_id={test_invocation_id}, "
            f"new_run_id={new_run_id}, original_run_id={original_run_id}"
        )

    except Exception as e:
        logger.exception(f"Error in test_run: {e}")
        await internal_sio.emit(
            "test_error",
            TestErrorData(
                sid=sid,
                message=f"Failed to run test: {e}",
                error_type="run",
            ).model_dump(mode="json"),
        )
