"""Handler for send_simulation_message WebSocket event."""

import asyncio
import logging
import uuid
from typing import Any

from agents.exceptions import OutputGuardrailTripwireTriggered
from app.agents.collection.simulation import run_simulation_agent
from app.db import get_pool
from app.utils.sql_helper import load_sql
from app.web.simulations.utils import (
    _generate_hints_background,
    get_sio_instance,
)

logger = logging.getLogger(__name__)


async def handle_send_simulation_message(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation message sending requests"""
    try:
        chat_id = data.get("chat_id")
        message = data.get("message")
        assistant_audio_enabled = data.get("assistant_audio_enabled", False)
        sketch_data = data.get("sketch_data")
        is_retry = data.get("isRetry", False)

        if not chat_id or (not message and not sketch_data):
            logger.error(
                f"Missing chat_id or both message and sketch_data in request from {sid}"
            )
            return

        logger.info(
            f"Processing send_simulation_message from {sid}: {chat_id} (audio: {assistant_audio_enabled}, sketch: {sketch_data is not None})"
        )

        # Process the message via WebSocket
        await process_simulation_message_websocket(
            chat_id=uuid.UUID(chat_id),
            message=message or "",
            is_retry=is_retry,
        )

    except Exception as e:
        logger.error(f"Error in send_simulation_message for {sid}: {str(e)}")

        # Try to create an error message in the database if we have a valid chat_id
        try:
            chat_id = data.get("chat_id")
            if chat_id:
                pool = get_pool()
                if pool:
                    async with pool.acquire() as conn:
                        # Create an error message in the database
                        sql = load_sql("sql/v3/simulations/insert_error_message.sql")
                        error_message = await conn.fetchrow(
                            sql,
                            uuid.UUID(chat_id),
                            "response",
                            f"Error: {str(e)}",
                            True,
                        )

                        # Emit the error message to clients
                        sio_instance = get_sio_instance()
                        if error_message:
                            await sio_instance.emit(
                                "simulation_new_message",
                                {
                                    "message_id": str(error_message["id"]),
                                    "chat_id": str(chat_id),
                                    "role": "assistant",
                                    "content": f"Error: {str(e)}",
                                    "completed": True,
                                    "created_at": error_message[
                                        "created_at"
                                    ].isoformat(),
                                },
                                room=f"simulation_{chat_id}",
                            )
        except Exception as db_error:
            logger.error(f"Failed to create error message in database: {db_error}")

        # Also emit the error event for backward compatibility
        sio_instance = get_sio_instance()
        await sio_instance.emit(
            "simulation_error",
            {"success": False, "message": str(e)},
            room=sid,
        )


async def process_simulation_message_websocket(
    chat_id: uuid.UUID,
    message: str = "",
    is_retry: bool = False,
) -> None:
    """
    Process a simulation message and stream the response via WebSocket
    Handles both text and audio messages with unified pipeline
    """

    # Get connection pool
    pool = get_pool()
    if not pool:
        raise ValueError("Database connection pool not available")

    async with pool.acquire() as conn:
        try:
            # 1. Add the user message to the chat (skip if this is a retry)
            sio_instance = get_sio_instance()
            if message and message.strip() != "" and not is_retry:
                sql = load_sql("sql/v3/simulations/create_message.sql")
                user_message_row = await conn.fetchrow(
                    sql, str(chat_id), "query", message, True
                )
                user_message = {
                    "id": user_message_row["id"],
                    "created_at": user_message_row["created_at"],
                }

                # 2. Emit user message to connected clients
                logger.info(f"Emitting user message to room simulation_{chat_id}")
                await sio_instance.emit(
                    "simulation_new_message",
                    {
                        "message_id": str(user_message["id"]),
                        "chat_id": str(chat_id),
                        "role": "user",
                        "content": message,
                        "completed": True,
                        "created_at": user_message["created_at"].isoformat(),
                    },
                    room=f"simulation_{chat_id}",
                )
            else:
                if is_retry:
                    logger.info(
                        f"Skipping user message creation for retry in chat {chat_id}"
                    )

            # 3. Create placeholder assistant message
            sql = load_sql("sql/v3/simulations/create_message.sql")
            assistant_message_row = await conn.fetchrow(
                sql, str(chat_id), "response", "", False
            )
            assistant_message = {
                "id": assistant_message_row["id"],
                "created_at": assistant_message_row["created_at"],
            }

            # 4. Emit placeholder assistant message
            logger.info(f"Emitting assistant placeholder to room simulation_{chat_id}")
            await sio_instance.emit(
                "simulation_new_message",
                {
                    "message_id": str(assistant_message["id"]),
                    "chat_id": str(chat_id),
                    "role": "assistant",
                    "content": "",
                    "completed": False,
                    "created_at": assistant_message["created_at"].isoformat(),
                },
                room=f"simulation_{chat_id}",
            )

            logger.info(f"Processing simulation message for chat {chat_id}")

            # 5. Stream the assistant response
            accumulated_content = ""
            cancelled = False

            try:
                # Cooperative cancellation support using Redis flags
                # We poll for a cancellation flag bound to this chat's active run ID
                from app.extensions import get_active_run, is_run_cancelled

                async for token in run_simulation_agent(chat_id, conn):  # type: ignore[arg-type]
                    # Check cancellation BEFORE processing this token to avoid emitting it
                    try:
                        run_id = await get_active_run(str(chat_id))
                        if run_id and await is_run_cancelled(run_id):
                            cancelled = True
                            sql = load_sql("sql/v3/simulations/complete_message.sql")
                            await conn.execute(sql, None, str(assistant_message["id"]))
                            break
                    except Exception:
                        pass

                    # Regular content token
                    accumulated_content += token

                    # Update the database with accumulated content
                    sql = load_sql("sql/v3/simulations/update_message_content.sql")
                    await conn.execute(sql, accumulated_content, str(assistant_message["id"]))

                    logger.info(
                        f"Emitting token to room simulation_{chat_id}: {token[:20]}..."
                    )
                    await sio_instance.emit(
                        "simulation_message_token",
                        {
                            "message_id": str(assistant_message["id"]),
                            "chat_id": str(chat_id),
                            "token": token,
                            "accumulated_content": accumulated_content,
                        },
                        room=f"simulation_{chat_id}",
                    )
            except OutputGuardrailTripwireTriggered as e:
                # Handle guardrail-triggered output: overwrite message with model-provided reason
                reason = ""
                try:
                    reason = (
                        getattr(e, "guardrail_result", None)
                        and getattr(e.guardrail_result, "output", None)
                        and getattr(e.guardrail_result.output, "output_info", None)
                        and getattr(e.guardrail_result.output.output_info, "reason", "")
                    ) or ""
                except Exception:
                    reason = ""

                error_text = f"Error: {reason or 'Guardrail tripwire triggered'}"

                # Persist error onto the assistant message and emit completion + error
                sql = load_sql("sql/v3/simulations/complete_message.sql")
                await conn.execute(sql, error_text, str(assistant_message["id"]))

                sio_instance = get_sio_instance()
                await sio_instance.emit(
                    "simulation_message_complete",
                    {
                        "message_id": str(assistant_message["id"]),
                        "chat_id": str(chat_id),
                        "final_content": error_text,
                    },
                    room=f"simulation_{chat_id}",
                )

                await sio_instance.emit(
                    "simulation_message_error",
                    {"chat_id": str(chat_id), "error": error_text},
                    room=f"simulation_{chat_id}",
                )

                # Skip later completion emission
                cancelled = True

            except Exception as e:
                if "cancelled" in str(e).lower() or "canceled" in str(e).lower():
                    # Handle cancellation gracefully
                    cancelled = True
                    logger.info(f"Simulation run for chat {chat_id} was cancelled")

                    # Keep content as-is, don't add cancellation notice
                    # Mark message as completed when cancelled
                    sql = load_sql("sql/v3/simulations/complete_message.sql")
                    await conn.execute(sql, accumulated_content, str(assistant_message["id"]))

                    # Emit cancellation signal
                    logger.info(f"Emitting cancellation to room simulation_{chat_id}")
                    await sio_instance.emit(
                        "simulation_message_cancelled",
                        {
                            "message_id": str(assistant_message["id"]),
                            "chat_id": str(chat_id),
                            "final_content": accumulated_content,
                        },
                        room=f"simulation_{chat_id}",
                    )
                else:
                    # Re-raise other exceptions
                    raise e

            # 6. Mark as completed and ensure final content is persisted
            sql = load_sql("sql/v3/simulations/complete_message.sql")
            await conn.execute(sql, accumulated_content, str(assistant_message["id"]))

            # 7. Emit completion signal (only if not cancelled)
            if not cancelled:
                logger.info(f"Emitting completion to room simulation_{chat_id}")
                await sio_instance.emit(
                    "simulation_message_complete",
                    {
                        "message_id": str(assistant_message["id"]),
                        "chat_id": str(chat_id),
                        "final_content": accumulated_content,
                    },
                    room=f"simulation_{chat_id}",
                )

                # 8. Trigger hint generation for practice simulations only (fire and forget)
                # Use optimized query to get simulation metadata
                sql = load_sql("sql/v3/simulations/get_simulation_metadata_for_chat.sql")
                sim_metadata_row = await conn.fetchrow(sql, str(chat_id))
                if not sim_metadata_row:
                    logger.warning(f"Failed to get simulation metadata for chat {chat_id}")
                    sim_metadata = {"practice_simulation": False}
                else:
                    sim_metadata = {
                        "simulation_id": sim_metadata_row["simulation_id"],
                        "attempt_id": sim_metadata_row["attempt_id"],
                        "practice_simulation": sim_metadata_row["practice_simulation"],
                    }

                if sim_metadata["practice_simulation"]:
                    logger.info(
                        f"Triggering hint generation for practice message {assistant_message['id']}"
                    )
                    # Extract department_id from run context for hint generation
                    sql = load_sql("sql/v3/agents/get_simulation_run_context.sql")
                    run_context_for_hints = await conn.fetchrow(sql, str(chat_id))
                    hint_dept_id = run_context_for_hints.get("department_id") if run_context_for_hints else None
                    if not hint_dept_id:
                        logger.warning(f"Failed to get department_id for hint generation in chat {chat_id}")
                    else:
                        asyncio.create_task(
                            _generate_hints_background(
                                chat_id=chat_id,
                                message_id=assistant_message["id"],
                                department_id=uuid.UUID(hint_dept_id),
                                sio_instance=sio_instance,
                            )
                        )
                else:
                    logger.debug("Skipping hint generation for non-practice simulation")

        except Exception as e:
            logger.error(f"Error in process_simulation_message_websocket: {str(e)}")
            sio_instance = get_sio_instance()

            # Best-effort: if we have already created a placeholder assistant message,
            # persist the error text onto it and mark it complete so the UI shows it.
            try:
                error_text = f"Error: {str(e)}"
                if "assistant_message" in locals() and assistant_message is not None:
                    sql = load_sql("sql/v3/simulations/complete_message.sql")
                    await conn.execute(sql, error_text, str(assistant_message["id"]))

                    # Emit a completion update using the same message so the client updates content
                    await sio_instance.emit(
                        "simulation_message_complete",
                        {
                            "message_id": str(assistant_message["id"]),
                            "chat_id": str(chat_id),
                            "final_content": error_text,
                        },
                        room=f"simulation_{chat_id}",
                    )
            except Exception as persist_error:
                logger.error(
                    f"Failed to persist/emit error content for chat {chat_id}: {persist_error}"
                )

            # Also emit the explicit error event for toasts/state resets
            # Only emit explicit error event if not cancelled
            if "cancelled" not in str(e).lower() and "canceled" not in str(e).lower():
                logger.info(f"Emitting error to room simulation_{chat_id}")
                await sio_instance.emit(
                    "simulation_message_error",
                    {"chat_id": str(chat_id), "error": str(e)},
                    room=f"simulation_{chat_id}",
                )

