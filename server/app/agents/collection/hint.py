import logging
import uuid
from typing import Any

import asyncpg  # type: ignore
from agents import Runner, Tool, ToolsToFinalOutputResult, function_tool, trace
from agents.items import TResponseInputItem
from app.agents.generic import GenericAgent
from app.db import get_db
from app.utils.chat import (format_chat_scenario,
                            get_simulation_conversation_history)
from app.utils.debug_info import DebugContext, debug_info
from app.utils.document import format_document_info
from app.utils.sql_helper import load_sql
from fastapi import Depends
from pydantic import Field

logger = logging.getLogger(__name__)

# Global storage for hint results
hint_results: dict[str, Any] = {}
hint_progress: dict[str, bool] = {}

# Context for socket routing
_hint_sio_instance: Any = None
_hint_chat_id: uuid.UUID | None = None


async def _emit_hint_progress(event_data: dict[str, Any]) -> None:
    """Helper to emit hint generation progress via Socket.IO if available."""
    global _hint_sio_instance, _hint_chat_id

    if _hint_sio_instance and _hint_chat_id:
        try:
            await _hint_sio_instance.emit(
                "hint_generation_progress",
                event_data,
                room=f"simulation_{_hint_chat_id}",
            )
        except Exception as e:
            logger.warning(f"Failed to emit hint progress: {e}")


def create_hint_function(hint_number: int) -> Tool:
    """Create a function tool for providing a specific hint."""

    async def provide_hint(
        hint: str = Field(
            description=(
                f"A concise, practical teaching strategy or communication tip for the GTA. "
                f"This is hint #{hint_number} of 3 required hints. "
                f"Make it distinct from the other hints and focused on a different aspect "
                f"of helping the student (e.g., content explanation, emotional support, pedagogical approach)."
            )
        ),
    ) -> str:
        """Provide a strategic hint for the GTA.

        This hint should help the GTA better address the student's needs or communication style.
        Focus on teaching strategies, clarification techniques, empathy, or encouragement.
        Each hint should cover a different aspect of the interaction.

        Args:
            hint: Practical, actionable hint for the GTA (distinct from other hints)

        Returns:
            Confirmation message indicating the hint was recorded
        """
        hint_results[f"hint_{hint_number}"] = hint
        hint_progress[f"hint_{hint_number}"] = True

        logger.info(f"✓ Hint {hint_number} recorded: {hint[:80]}...")
        return f"Hint {hint_number} recorded successfully. Continue until all 3 hints are provided."

    # Set unique function name
    provide_hint.__name__ = f"provide_hint_{hint_number}"
    return function_tool(provide_hint)


def create_hint_tools() -> list[Tool]:
    """Create all tools needed for hint generation."""
    tools = []

    # Create three separate hint tools
    for i in range(1, 4):  # 1, 2, 3
        tools.append(create_hint_function(i))

    # Add debug_info tool
    tools.append(debug_info)

    logger.info(f"Created {len(tools)} hint tools (3 hints + debug_info)")
    return tools


def _build_hint_agent(context: dict[str, Any]) -> GenericAgent:
    """Create the hint generation agent from context data.

    Args:
        context: Context dict with agent, model, and provider data

    Returns:
        GenericAgent instance configured for hint generation
    """
    # Create hint tools
    hint_tools = create_hint_tools()

    # Create tool use behavior - require all 3 hint tools to be called
    def tool_use_behavior(
        tool_context: Any, tool_results: list[Any]
    ) -> ToolsToFinalOutputResult:
        # Check if all three hint tools have been called
        hint_1_complete = hint_progress.get("hint_1", False)
        hint_2_complete = hint_progress.get("hint_2", False)
        hint_3_complete = hint_progress.get("hint_3", False)

        all_hints_complete = hint_1_complete and hint_2_complete and hint_3_complete

        logger.info(
            f"Tool use behavior check: hint_1={hint_1_complete}, "
            f"hint_2={hint_2_complete}, hint_3={hint_3_complete}, "
            f"all_complete={all_hints_complete}, "
            f"tool_results_count={len(tool_results)}"
        )

        # Return False to continue until all 3 hints are provided
        return ToolsToFinalOutputResult(is_final_output=all_hints_complete)

    return GenericAgent(
        agent_name=context["agent_name"],
        system_prompt=context["system_prompt"],
        temperature=context["temperature"],
        model_name=context["model_name"],
        model_provider=context["provider_name"],
        base_url=context["base_url"],
        api_key=context["api_key"],
        reasoning=context["reasoning"],
        custom_model=context["custom_model"],
        tools=hint_tools,
        parallel_tool_calls=True,  # Enable parallel execution
        tool_use_behavior=tool_use_behavior,
    )


async def run_hint_agent(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    department_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
    sio_instance: Any = None,
) -> list[dict[str, Any]]:
    """
    Generate 3 helpful hints for a GTA based on simulation conversation history.

    Args:
        chat_id: The ID of the simulation chat
        message_id: The ID of the specific message to generate hints for
        department_id: Department ID to get the hint agent from
        conn: Database connection
        sio_instance: Socket.IO instance for progress events

    Returns:
        List of dicts with simulation_message_id and idx (composite PKs, up to 3)
    """
    try:
        # Clear previous results and set up socket context
        global hint_results, hint_progress, _hint_sio_instance, _hint_chat_id
        hint_results.clear()
        hint_progress.clear()
        _hint_sio_instance = sio_instance
        _hint_chat_id = chat_id

        # Get all hint context data using SQL file (replacing deprecated AgentService)
        sql = load_sql("sql/v3/agents/get_hint_run_context.sql")
        context_row = await conn.fetchrow(sql, str(message_id), str(chat_id), str(department_id))
        
        if not context_row:
            raise ValueError(
                f"Message {message_id} in chat {chat_id} not found or "
                f"no hint agent configured for department {department_id}"
            )
        
        # Parse JSON array for documents
        import json
        documents = (
            json.loads(context_row["documents"])
            if isinstance(context_row["documents"], str)
            else context_row["documents"]
        )
        
        # Resolve guest profile if needed
        profile_id = context_row["profile_id"]
        if not profile_id:
            sql_guest = load_sql("sql/v3/profile/get_default_guest_profile.sql")
            guest_row = await conn.fetchrow(sql_guest)
            if guest_row:
                profile_id = guest_row["id"]
        
        context = {
            # Message data
            "message_id": context_row["message_id"],
            "message_created_at": context_row["message_created_at"],
            # Chat data
            "chat_id": context_row["chat_id"],
            "attempt_id": context_row["attempt_id"],
            "scenario_id": context_row["scenario_id"],
            "trace_id": context_row["trace_id"],
            "chat_title": context_row["chat_title"],
            # Attempt data
            "simulation_id": context_row["simulation_id"],
            # Scenario data
            "problem_statement": context_row["problem_statement"],
            # Agent data
            "agent_id": context_row["agent_id"],
            "agent_name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
            "reasoning": context_row["reasoning"],
            # Model data
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "custom_model": context_row["custom_model"],
            # Provider data
            "provider_id": context_row["provider_id"],
            "provider_name": context_row["provider_name"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            # Profile data (resolved to guest if null)
            "profile_id": profile_id,
            # Documents (full document data, not just IDs)
            "documents": documents,
            # Rate limit data
            "req_per_day": context_row["req_per_day"],
            "runs_today_count": context_row["runs_today_count"],
            "earliest_run_created_at": context_row["earliest_run_created_at"],
        }
        
        logger.info(
            f"[HINT TRACE] Found hint agent - agent_id={context['agent_id']}, "
            f"agent_name={context['agent_name']}, "
            f"system_prompt_length={len(context['system_prompt'])}"
        )

        # Extract data from context
        chat = {
            "id": uuid.UUID(context["chat_id"]),
            "attempt_id": uuid.UUID(context["attempt_id"]),
            "scenario_id": uuid.UUID(context["scenario_id"]),
            "trace_id": context["trace_id"],
            "title": context["chat_title"],
        }

        attempt = {
            "id": uuid.UUID(context["attempt_id"]),
            "simulation_id": uuid.UUID(context["simulation_id"]),
        }

        message_created_at = context["message_created_at"]

        logger.info(
            f"Starting hint generation for chat {chat_id}, message {message_id}"
        )

        # Emit start event
        await _emit_hint_progress(
            {
                "type": "start",
                "message": "Starting hint generation",
                "chat_id": str(chat_id),
                "message_id": str(message_id),
            }
        )

        # Build input items
        input_items: list[TResponseInputItem] = []

        # Format document info if documents are available (no images needed for hints)
        if context["documents"]:
            document_info = format_document_info(context["documents"], False)
            input_items.append(document_info)

        # Get all messages for the chat using SQL file
        sql = load_sql("sql/v3/simulations/get_simulation_messages.sql")
        message_rows = await conn.fetch(sql, str(chat_id))
        all_messages = [dict(row) for row in message_rows]

        # Filter messages up to and including the target message
        messages = [
            msg for msg in all_messages if msg["created_at"] <= message_created_at
        ]

        # Build conversation history
        conversation_history = get_simulation_conversation_history(messages)

        # Format scenario from context
        chat_scenario = format_chat_scenario(context["problem_statement"])
        input_items.insert(0, chat_scenario)
        input_items.extend(conversation_history)

        # Check rate limit (already included in context query)
        profile_id_uuid = uuid.UUID(context["profile_id"]) if context["profile_id"] else None
        if not profile_id_uuid:
            raise ValueError("Profile not found. Please contact support.")
        
        req_per_day = context["req_per_day"]
        runs_today_count = context["runs_today_count"]
        
        if req_per_day is not None and runs_today_count >= req_per_day:
            # Rate limit exceeded - format error message
            from datetime import timedelta
            from zoneinfo import ZoneInfo
            earliest_run_created_at = context["earliest_run_created_at"]
            if earliest_run_created_at:
                next_allowed_utc = earliest_run_created_at + timedelta(days=1)
                eastern_tz = ZoneInfo("America/New_York")
                next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                error_message = (
                    f"Daily request limit of {req_per_day} reached. "
                    f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                    f"{next_allowed_et.strftime('%B %d, %Y')}."
                )
            else:
                error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
            raise ValueError(error_message)

        # Build hint agent from context
        hint_agent = _build_hint_agent(context)

        # Create model run with all junction records using SQL file
        sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
        model_run_row = await conn.fetchrow(
            sql_create_run,
            str(department_id),
            context["model_id"],
            context["agent_id"],
            "agent",
            context["profile_id"],
        )
        model_run_id = uuid.UUID(model_run_row["model_run_id"])

        # Run the hint agent
        logger.info("Running hint agent with parallel tool calls...")
        with trace(
            chat["title"], trace_id=chat["trace_id"], group_id=str(attempt["id"])
        ):
            result = await Runner.run(
                hint_agent.agent(),
                input=input_items,
                context=DebugContext(conn=conn, model_run_id=model_run_id),
            )

        # Update token usage using SQL file
        usage = result.context_wrapper.usage
        sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
        await conn.execute(
            sql_update_tokens,
            str(model_run_id),
            usage.input_tokens,
            usage.output_tokens,
        )

        logger.info("Hint agent completed successfully")

        # Extract hints from global storage
        hint_1 = hint_results.get("hint_1", "")
        hint_2 = hint_results.get("hint_2", "")
        hint_3 = hint_results.get("hint_3", "")

        # Log what was generated
        hints_generated = sum([bool(hint_1), bool(hint_2), bool(hint_3)])
        logger.info(f"Generated {hints_generated}/3 hints")

        if hints_generated < 3:
            logger.warning(
                f"Not all hints were generated for message {message_id}. "
                f"Got: hint_1={bool(hint_1)}, hint_2={bool(hint_2)}, hint_3={bool(hint_3)}"
            )

        # Create SimulationHints records using direct SQL (replacing deprecated AgentService)
        hint_ids: list[dict[str, Any]] = []
        for i, hint_text in enumerate([hint_1, hint_2, hint_3], 1):
            if hint_text:  # Only save non-empty hints
                # Get the next idx for this message
                sql_max_idx = """
                    SELECT COALESCE(MAX(idx), -1) + 1 as next_idx
                    FROM simulation_hints
                    WHERE simulation_message_id = $1::uuid
                """
                max_idx_row = await conn.fetchrow(sql_max_idx, str(message_id))
                next_idx = max_idx_row["next_idx"] if max_idx_row else 0
                
                # Insert the hint
                sql_insert = """
                    INSERT INTO simulation_hints (simulation_message_id, idx, hint)
                    VALUES ($1::uuid, $2, $3)
                    RETURNING simulation_message_id::text, idx
                """
                hint_result_row = await conn.fetchrow(
                    sql_insert, str(message_id), next_idx, hint_text
                )
                hint_result = {
                    "simulation_message_id": hint_result_row["simulation_message_id"],
                    "idx": hint_result_row["idx"],
                }
                hint_ids.append(hint_result)
                logger.info(
                    f"Created hint {i} (idx={hint_result['idx']}): {hint_text[:80]}..."
                )

        logger.info(
            f"Successfully generated {len(hint_ids)} hints for message {message_id} "
            f"in chat {chat_id}"
        )

        # Emit completion event
        await _emit_hint_progress(
            {
                "type": "complete",
                "message": "Hint generation completed successfully",
                "chat_id": str(chat_id),
                "message_id": str(message_id),
                "hint_ids": [
                    f"{h['simulation_message_id']}_{h['idx']}" for h in hint_ids
                ],
                "hints_count": len(hint_ids),
            }
        )

        # Clean up socket context
        _hint_sio_instance = None
        _hint_chat_id = None

        return hint_ids

    except Exception as e:
        logger.error(f"Error in run_hint_agent: {str(e)}", exc_info=True)

        # Emit error event
        if sio_instance:
            try:
                await sio_instance.emit(
                    "hint_generation_progress",
                    {
                        "type": "error",
                        "message": f"Hint generation failed: {str(e)}",
                        "error": str(e),
                        "chat_id": str(chat_id),
                        "message_id": str(message_id),
                    },
                    room=f"simulation_{chat_id}",
                )
            except Exception as emit_error:
                logger.warning(f"Failed to emit error event: {emit_error}")

        # Clean up socket context
        _hint_sio_instance = None
        _hint_chat_id = None

        raise
