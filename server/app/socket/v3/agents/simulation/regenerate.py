"""Handler for simulation_regenerate WebSocket event."""

import uuid
from typing import Any, cast

from agents import Runner, function_tool, trace
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, Field
from utils.sql_helper import execute_sql_typed

from app.infra.v3.agents.generic_agent import GenericAgent
from app.infra.v3.chat.format_chat_scenario import format_chat_scenario
from app.infra.v3.debug.debug_info import DebugContext
from app.infra.v3.documents.format_document_info import format_document_info
from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_client_event
from app.infra.v3.websocket.openapi_helpers import register_client_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetSimulationRegenerationRunContextAndCreateRunApiRequest,
    GetSimulationRegenerationRunContextAndCreateRunSqlParams,
    GetSimulationRegenerationRunContextAndCreateRunSqlRow,
)

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = (
    "app/sql/v3/simulations/get_simulation_regeneration_run_context_and_create_run_complete.sql"
)

internal_sio = get_internal_sio()


def find_persona_by_name_inline(
    persona_name: str, personas: list[dict[str, Any]]
) -> tuple[uuid.UUID, str] | None:
    """Find persona by name (inlined from utils)."""
    for persona in personas:
        persona_display_name = persona.get("persona_name") or persona.get("name", "")
        if persona_display_name.lower() == persona_name.lower():
            persona_id_str = persona.get("persona_id") or persona.get("id", "")
            if persona_id_str:
                return (uuid.UUID(persona_id_str), persona_display_name)
    return None


async def _simulation_regenerate_impl(
    sid: str,
    data: GetSimulationRegenerationRunContextAndCreateRunApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle simulation regeneration requests via WebSocket."""
    trace_id: str | None = None
    group_id: uuid.UUID | None = None

    try:
        # data fields are already validated as UUIDs by GetSimulationRegenerationRunContextAndCreateRunApiRequest
        # (Pydantic auto-converts strings to UUIDs)
        chat_id = data.chat_id
        group_id_param = data.group_id  # REQUIRED for regeneration
        user_instructions = data.user_instructions

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            # This validates rate limits, creates run, gets all previous messages,
            # and links existing system/developer messages atomically
            try:
                # Use execute_sql_typed() - auto-detects function
                params = GetSimulationRegenerationRunContextAndCreateRunSqlParams(
                    chat_id=chat_id,
                    profile_id=profile_id,  # From sid lookup
                    group_id=group_id_param,  # REQUIRED for regeneration (uses existing group)
                    user_instructions=user_instructions,
                )
                result = cast(
                    GetSimulationRegenerationRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    # Extract the user-friendly message (everything after "RATE_LIMIT_EXCEEDED: ")
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await emit_to_internal(
                        "simulation_text_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": user_msg,
                        },
                    )
                    return
                await emit_to_internal(
                    "simulation_text_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Failed to initialize simulation regeneration: {str(e)}",
                    },
                )
                return

            if not result:
                await emit_to_internal(
                    "simulation_text_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"No simulation agent configured for chat {chat_id}",
                    },
                )
                return

            # result.group_id and result.trace_id come from groups table
            trace_id = (
                result.trace_id or ""
            )  # From groups.trace_id (never NULL due to DEFAULT)
            if not result.group_id:
                await emit_to_internal(
                    "simulation_text_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Failed to retrieve group information",
                    },
                )
                return
            group_id = result.group_id  # Uses existing group

            # Extract run_id from result (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            # Get previous messages from result (already properly typed as composite types)
            previous_messages: list[TResponseInputItem] = []
            if result.previous_messages:
                previous_messages = [
                    cast(
                        TResponseInputItem,
                        {
                            "role": msg.role or "",
                            "content": msg.content or "",
                        },
                    )
                    for msg in result.previous_messages
                ]

            # Emit start event via internal bus
            # trace_id comes from groups table via SQL, not passed in payload
            await internal_sio.emit(
                "simulation_text_progress",
                {
                    "sid": sid,
                    "chat_id": str(chat_id),
                    "progress_type": "start",
                    "message": "Starting simulation regeneration",
                },
            )

            # Build context dict from result
            context = {
                "chat_id": result.chat_id,
                "chat_title": result.chat_title,
                "trace_id": result.trace_id,
                "attempt_id": result.attempt_id,
                "simulation_id": result.simulation_id,
                "scenario_id": result.scenario_id,
                "department_id": result.department_id,
                "problem_statement": result.problem_statement,
                "persona_id": result.persona_id,
                "persona_name": result.persona_name,
                "system_prompt": result.system_prompt,
                "temperature": float(result.temperature)
                if result.temperature is not None
                else 0.0,
                "reasoning": result.reasoning,
                "model_id": result.model_id,
                "model_name": result.model_name,
                "provider": result.provider,
                "base_url": result.base_url,
                "api_key": result.api_key,
                "custom_model": result.custom_model,
                "provider_id": result.provider_id,
                "provider_name": result.provider_name,
                "agent_id": result.agent_id,
                "voice_system_prompt": result.voice_system_prompt,
                "voice_temperature": float(result.voice_temperature)
                if result.voice_temperature is not None
                else 0.0,
                "voice_reasoning": result.voice_reasoning,
                "voice_model_id": result.voice_model_id,
                "voice_model_name": result.voice_model_name,
                "voice_provider": result.voice_provider,
                "voice_base_url": result.voice_base_url,
                "voice_api_key": result.voice_api_key,
                "voice_custom_model": result.voice_custom_model,
                "voice_provider_name": result.voice_provider_name,
                "voice_agent_id": result.voice_agent_id,
                "image_input_enabled": result.image_input_enabled,
                "copy_paste_allowed": result.copy_paste_allowed,
                "profile_id": result.profile_id,
                "documents": result.documents,
            }

            # Build input items
            input_items: list[TResponseInputItem] = []

            # Add previous messages first (conversation history from all runs)
            input_items.extend(previous_messages)

            # Format chat scenario (problem statement)
            chat_scenario = format_chat_scenario(context["problem_statement"])
            input_items.insert(0, chat_scenario)

            # Format document info if documents are available
            if context["documents"]:
                # Convert composite type documents to dict format for format_document_info
                documents_dict = [
                    {
                        "id": doc.id,
                        "name": doc.name,
                        "file_path": doc.file_path,
                        "mime_type": doc.mime_type,
                    }
                    for doc in context["documents"]
                ]
                document_info = format_document_info(
                    documents_dict, context["image_input_enabled"]
                )
                input_items.insert(1, document_info)  # Insert after chat_scenario

            # Get all personas for this scenario and create persona tools
            from utils.sql_helper import load_sql

            sql_personas = load_sql("app/sql/v3/voice/get_chat_personas.sql")
            persona_rows = await conn.fetch(sql_personas, str(chat_id))
            personas = [dict(row) for row in persona_rows]

            # Create persona tools if personas exist
            persona_tools = []
            if personas:
                # Load agent tools from database
                simulation_agent_id_uuid = uuid.UUID(context["agent_id"])
                sql_get_agent_tools = load_sql("app/sql/v3/agents/get_agent_tools.sql")
                rows = await conn.fetch(
                    sql_get_agent_tools, str(simulation_agent_id_uuid)
                )
                agent_tools_config = [dict(row) for row in rows]
                tool_config_map_persona: dict[str, dict[str, Any]] = {
                    tool_config["name"]: tool_config
                    for tool_config in agent_tools_config
                }

                # Build speak tool inline
                speak_config = tool_config_map_persona.get("speak")
                if speak_config:
                    persona_desc = speak_config.get("argument_descriptions", {}).get(
                        "persona", "The name of the persona that should speak"
                    )
                    message_desc = speak_config.get("argument_descriptions", {}).get(
                        "message",
                        "The message content that the persona should say",
                    )
                else:
                    persona_names = []
                    for persona in personas:
                        persona_name = persona.get("persona_name") or persona.get(
                            "name", ""
                        )
                        if persona_name:
                            persona_names.append(persona_name)

                    if persona_names:
                        persona_names_str = ", ".join(
                            f'"{name}"' for name in persona_names
                        )
                        persona_desc = f"The name of the persona that should speak. Must be one of: {persona_names_str}."
                    else:
                        persona_desc = "The name of the persona that should speak"
                    message_desc = "The message content that the persona should say"

                async def speak(
                    persona: str = Field(description=persona_desc),
                    message: str = Field(description=message_desc),
                ) -> str:
                    """Make a persona speak by calling this tool with the persona name and message."""

                    persona_match = find_persona_by_name_inline(
                        persona.strip() if persona else "", personas
                    )
                    if not persona_match:
                        available_list = "\n".join(
                            f"  - {p.get('persona_name') or p.get('name', '')}"
                            for p in personas
                        )
                        error_msg = f"Persona '{persona}' not found. Available personas:\n{available_list}"
                        return f"Error: {error_msg}"

                    persona_id, persona_display_name = persona_match

                    return f"Tool call confirmed for {persona_display_name}"

                persona_tools.append(function_tool(speak))

                # Get persona instructions for developer message
                sql_get_persona_instructions = load_sql(
                    "app/sql/v3/voice/get_persona_instructions.sql"
                )
                persona_instruction_rows = await conn.fetch(
                    sql_get_persona_instructions, str(chat_id)
                )

                persona_instructions_map: dict[str, str] = {}
                for row in persona_instruction_rows:
                    persona_name = row.get("persona_name", "")
                    instructions = row.get("instructions", "")
                    if persona_name:
                        persona_instructions_map[persona_name] = instructions or ""

                persona_names = [
                    p.get("persona_name") or p.get("name", "Unknown") for p in personas
                ]
                persona_descriptions = []
                for persona_name in persona_names:
                    instructions = persona_instructions_map.get(persona_name, "")
                    if instructions:
                        persona_descriptions.append(f"- {persona_name}: {instructions}")
                    else:
                        persona_descriptions.append(f"- {persona_name}")

                persona_names_list = [f'"{name}"' for name in persona_names]

                developer_message_personas: TResponseInputItem = {
                    "role": "developer",
                    "content": f"""Available personas and their personalities:
{chr(10).join(persona_descriptions)}

Tool Usage Instructions:
- You MUST use the `speak` tool to respond as a persona
- The `speak` tool takes two parameters:
  * `persona`: The name of the persona that should speak (must be one of: {", ".join(persona_names_list)})
  * `message`: The message content that the persona should say
- Call exactly one tool per user message
- Never respond directly - always use the `speak` tool
- The persona name must match exactly one of the available personas listed above""",
                }
                input_items.append(developer_message_personas)

                # Add debug_info tool
                from app.infra.v3.debug.debug_info import debug_info

                persona_tools.append(debug_info)

            # Create agent instance
            agent_instance = GenericAgent(
                agent_name=context["persona_name"],
                system_prompt=context["system_prompt"],
                temperature=context["temperature"],
                model_name=context["model_name"],
                provider=context["provider_name"],
                base_url=context["base_url"],
                reasoning=context["reasoning"],
                api_key=context["api_key"],
                tools=persona_tools,
            )

            # Append user instructions on top (most recent instruction goes last)
            if user_instructions and user_instructions.strip():
                input_items.append(
                    {
                        "role": "user",
                        "content": user_instructions,
                    }
                )

            # Rate limit validation and run creation are now handled in SQL
            # (get_simulation_regeneration_run_context_and_create_run.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Run simulation regeneration with tracing
            # ⚠️ NOTE: trace() function's group_id parameter is the resource ID (attempt_id),
            # not the database group_id. This is for OpenAI implementation compatibility.
            with trace(
                context["chat_title"],
                trace_id=trace_id,  # From groups table
                group_id=context["attempt_id"],
            ):
                run_result = await Runner.run(
                    agent_instance.agent(),
                    input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            usage = run_result.context_wrapper.usage
            assistant_output = getattr(run_result, "final_output", None) or ""
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "simulation",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": input_items,  # Serialized TResponseInputItem list
                    "assistantOutput": assistant_output,
                },
            )

            # Emit completion event via internal bus
            # trace_id comes from groups table via SQL, not passed in payload
            await internal_sio.emit(
                "simulation_text_complete",
                {
                    "sid": sid,
                    "chat_id": str(chat_id),
                    "type": "run_complete",
                    "message": "Simulation regeneration completed successfully",
                },
            )

    except RuntimeError:
        # Pool not initialized - emit error event
        # trace_id comes from groups table via SQL, not passed in payload
        await internal_sio.emit(
            "simulation_text_error",
            {
                "sid": sid,
                "success": False,
                "message": "Database connection pool not available",
            },
        )
    except Exception as e:
        # trace_id comes from groups table via SQL, not passed in payload
        await internal_sio.emit(
            "simulation_text_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@sio.event  # type: ignore
async def simulation_regenerate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GetSimulationRegenerationRunContextAndCreateRunApiRequest,
        handler=_simulation_regenerate_impl,  # type: ignore[arg-type]
        error_event_name="simulation_text_error",
        error_response_type=None,  # Simulation uses dict payload, not typed response
    )


register_client_endpoint(
    client_router,
    "/regenerate",
    GetSimulationRegenerationRunContextAndCreateRunApiRequest,
    "Regenerate simulation response using AI",
)

