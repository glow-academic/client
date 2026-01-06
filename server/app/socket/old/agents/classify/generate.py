"""Handler for classify_upload WebSocket event."""

import json
import uuid
import zipfile
from typing import Any, cast

from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    Tool,
    ToolsToFinalOutputResult,
    function_tool,
    trace,
)
from agents.items import TResponseInputItem
from fastapi import APIRouter
from jinja2 import Template
from pydantic import BaseModel, Field, ValidationError
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import TUS_UPLOADS_DIR, get_internal_sio, sio
from app.sql.types import (
    GetClassificationContextSqlParams,
    GetClassificationContextSqlRow,
    GetDeveloperInstructionSqlParams,
    GetDeveloperInstructionSqlRow,
    GetFirstDepartmentForProfileSqlParams,
    GetFirstDepartmentForProfileSqlRow,
    GetUploadClassificationRunContextAndCreateRunSqlParams,
    GetUploadClassificationRunContextAndCreateRunSqlRow,
    LinkDeveloperMessageToRunSqlParams,
    LinkDeveloperMessageToRunSqlRow,
    LinkSystemDeveloperMessagesToRunSqlParams,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class ClassifyUploadProgressPayload(BaseModel):
    """Response indicating progress in upload classification."""

    type: str  # "start", "complete"
    message: str | None = None


class ClassifyUploadCompletePayload(BaseModel):
    """Response indicating upload classification completed successfully."""

    success: bool
    message: str
    suggestedParameterItemIds: dict[str, list[str]]  # file_name -> [parameter_item_ids]


class ClassifyUploadErrorPayload(BaseModel):
    """Response indicating an error occurred in upload classification."""

    success: bool
    message: str


# Pydantic model for client-to-server event
class ClassifyUploadPayload(BaseModel):
    """Request to classify an uploaded file."""

    uploadId: str
    # profileId removed - retrieved via find_profile_by_socket(sid)
    parameterIds: list[str] | None = None  # Optional filter for specific parameters


# Emit helper functions
async def classify_upload_progress(
    payload: ClassifyUploadProgressPayload, room: str
) -> None:
    await sio.emit(
        "uploads_classification_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def classify_upload_complete(
    payload: ClassifyUploadCompletePayload, room: str
) -> None:
    await sio.emit("uploads_classification_complete", payload.model_dump(), room=room)


async def classify_upload_error(payload: ClassifyUploadErrorPayload, room: str) -> None:
    await sio.emit("uploads_classification_error", payload.model_dump(), room=room)


async def _classify_upload_impl(sid: str, data: ClassifyUploadPayload) -> None:
    """Handle upload classification requests via WebSocket."""
    try:
        upload_id = data.uploadId

        # Get profile_id from socket lookup
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await classify_upload_error(
                ClassifyUploadErrorPayload(
                    success=False,
                    message="Profile not found for socket",
                ),
                room=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)

        async with get_db_connection() as conn:
            # Emit start event
            await classify_upload_progress(
                ClassifyUploadProgressPayload(
                    type="start",
                    message="Starting upload classification",
                ),
                room=sid,
            )

            # Get user's department for agent selection (use first department or None)
            SQL_PATH_DEPT = (
                "app/sql/v4/profile/get_first_department_for_profile_complete.sql"
            )
            dept_params = GetFirstDepartmentForProfileSqlParams(profile_id=profile_id)
            dept_result = cast(
                GetFirstDepartmentForProfileSqlRow,
                await execute_sql_typed(conn, SQL_PATH_DEPT, params=dept_params),
            )
            department_id = dept_result.department_id if dept_result else None

            # Get all context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            # Pattern: All AI operations use atomic context+run creation SQL files
            # See WEBSOCKET_STANDARDS.md for details
            SQL_PATH_CONTEXT = "app/sql/v4/uploads/get_upload_classification_run_context_and_create_run_complete.sql"
            try:
                context_params = GetUploadClassificationRunContextAndCreateRunSqlParams(
                    department_id=department_id,
                    profile_id=profile_id,
                )
                context_result = cast(
                    GetUploadClassificationRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(
                        conn, SQL_PATH_CONTEXT, params=context_params
                    ),
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
                    await classify_upload_error(
                        ClassifyUploadErrorPayload(
                            success=False,
                            message=user_msg,
                        ),
                        room=sid,
                    )
                    return
                await classify_upload_error(
                    ClassifyUploadErrorPayload(
                        success=False,
                        message=f"Failed to initialize classification: {str(e)}",
                    ),
                    room=sid,
                )
                return

            if not context_result:
                await classify_upload_error(
                    ClassifyUploadErrorPayload(
                        success=False,
                        message="Classification agent not found",
                    ),
                    room=sid,
                )
                return

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(context_result.run_id)

            context = {
                "agent_id": context_result.agent_id,
                "agent_name": context_result.agent_name,
                "system_prompt": context_result.system_prompt,
                "temperature": float(context_result.temperature),
                "reasoning": context_result.reasoning,
                "model_id": context_result.model_id,
                "model_name": context_result.model_name,
                "provider": context_result.provider,
                "base_url": context_result.base_url or None,
                "api_key": context_result.api_key,
                "profile_id": context_result.profile_id,
            }

            # Find the upload directory
            upload_dir = TUS_UPLOADS_DIR / upload_id

            if not upload_dir.exists():
                await classify_upload_error(
                    ClassifyUploadErrorPayload(
                        success=False,
                        message=f"Upload with uploadId {upload_id} not found",
                    ),
                    room=sid,
                )
                return

            # Read metadata
            metadata_path = upload_dir / "metadata.json"
            metadata = {}
            if metadata_path.exists():
                with open(metadata_path) as f:
                    metadata = json.load(f)

            # Get the uploaded file path
            file_path = upload_dir / "file"

            if not file_path.exists() or file_path.stat().st_size == 0:
                await classify_upload_error(
                    ClassifyUploadErrorPayload(
                        success=False,
                        message="Upload file is missing or empty",
                    ),
                    room=sid,
                )
                return

            filename = metadata.get("filename", "unknown")
            is_zip = filename.lower().endswith(".zip")

            # Get parameter items for classification
            parameter_ids_filter: list[uuid.UUID] | None = None
            if data.parameterIds:
                parameter_ids_filter = [uuid.UUID(pid) for pid in data.parameterIds]

            SQL_PATH_PARAM_ITEMS = (
                "app/sql/v4/uploads/get_classification_context_complete.sql"
            )
            param_items_params = GetClassificationContextSqlParams(
                parameter_ids=parameter_ids_filter if parameter_ids_filter else [],
                profile_id=profile_id,
            )
            param_items_results = cast(
                list[GetClassificationContextSqlRow],
                await execute_sql_typed(
                    conn, SQL_PATH_PARAM_ITEMS, params=param_items_params
                ),
            )

            parameter_items = [
                {
                    "id": row.id,
                    "name": row.name,
                    "description": row.description,
                    "parameter_id": row.parameter_id,
                    "parameter_name": row.parameter_name,
                }
                for row in param_items_results
            ]

            if not parameter_items:
                await classify_upload_error(
                    ClassifyUploadErrorPayload(
                        success=False,
                        message="No parameter items available for classification",
                    ),
                    room=sid,
                )
                return

            # Extract file names from upload
            file_names: list[str] = []
            if is_zip:
                try:
                    with zipfile.ZipFile(file_path, "r") as zip_ref:
                        file_names = sorted(
                            name
                            for name in zip_ref.namelist()
                            if name and not name.endswith("/")
                        )
                except Exception as e:
                    # Removed logger call - Socket.IO handles logging
                    await classify_upload_error(
                        ClassifyUploadErrorPayload(
                            success=False,
                            message=f"Error reading ZIP file: {str(e)}",
                        ),
                        room=sid,
                    )
                    return
            else:
                file_names = [filename]

            # Function-scoped classification results storage
            classification_results: dict[str, list[str]] = {}
            invalid_file_numbers: list[str] = []

            # Load agent tools from database
            from app.sql.types import GetAgentToolsSqlRow

            agent_id_uuid = uuid.UUID(context["agent_id"])
            # Function returns multiple rows, so we call it directly with fetch()
            function_call_sql = 'SELECT * FROM "public"."socket_get_agent_tools_v4"($1)'
            rows = await conn.fetch(function_call_sql, agent_id_uuid)
            agent_tools_config = [
                GetAgentToolsSqlRow.model_validate(dict(row)).model_dump()
                for row in rows
            ]
            tool_config_map_classify: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Get base classification tool config
            base_classification_config = tool_config_map_classify.get("classification")

            # Create classification tools inline for each parameter item
            classification_tools: list[Tool] = []
            for item in parameter_items:
                # Get descriptions from database config if available
                if base_classification_config:
                    file_names_desc = base_classification_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "file_names",
                        f"List of file numbers (from the file list above) that match the parameter item '{item['name']}'",
                    )
                else:
                    file_names_desc = f"List of file numbers (from the file list above) that match the parameter item '{item['name']}'"

                # Create function with proper closure capture
                def make_classification_function(
                    item_dict: dict[str, Any],
                    file_names_descr: str,
                    file_names_count: int,
                ):
                    async def classify_parameter_item(
                        file_numbers: list[str] = Field(description=file_names_descr),
                    ) -> str:
                        """Classify files by matching them to the parameter item: {item_name}

                        Args:
                            file_numbers: List of file numbers (from the file list above) that match this parameter item

                        Returns:
                            Confirmation message
                        """.format(item_name=item_dict["name"])
                        # Store classification result in function-scoped dict
                        valid_file_numbers: list[str] = []
                        for file_number in file_numbers:
                            try:
                                file_index = int(file_number) - 1
                                if 0 <= file_index < file_names_count:
                                    valid_file_numbers.append(file_number)
                                else:
                                    invalid_file_numbers.append(file_number)
                            except (TypeError, ValueError):
                                invalid_file_numbers.append(str(file_number))

                        if item_dict["id"] not in classification_results:
                            classification_results[item_dict["id"]] = []
                        classification_results[item_dict["id"]].extend(
                            valid_file_numbers
                        )
                        return f"Classified {len(valid_file_numbers)} file(s) for {item_dict['name']}"

                    # Set unique function name
                    safe_name = "".join(
                        c if c.isalnum() or c == "_" else "_"
                        for c in item_dict["name"].lower()
                    )
                    classify_parameter_item.__name__ = f"classify_{safe_name}"
                    return classify_parameter_item

                classify_func = make_classification_function(
                    item, file_names_desc, len(file_names)
                )
                classification_tools.append(function_tool(classify_func))

            # Removed logger call - Socket.IO handles logging

            # Create tool use behavior - allow agent to finish after tool calls
            classification_progress_tracker: dict[str, bool] = {}

            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                # Track that tools have been called
                for result in tool_results:
                    if hasattr(result, "name"):
                        classification_progress_tracker[result.name] = True

                # Allow agent to finish after making tool calls
                # The agent will naturally finish when it's done classifying
                return ToolsToFinalOutputResult(is_final_output=False)

            # Build classification agent
            classification_agent = GenericAgent(
                agent_name=context["agent_name"],
                system_prompt=context["system_prompt"],
                temperature=context["temperature"],
                model_name=context["model_name"],
                provider=context["provider"],
                base_url=context["base_url"],
                api_key=context["api_key"],
                reasoning=context["reasoning"],
                tools=classification_tools,
                parallel_tool_calls=True,
                tool_use_behavior=tool_use_behavior,
            )

            # Format file list for agent input
            file_list_text = "\n".join(
                [f"{i + 1}. {name}" for i, name in enumerate(file_names)]
            )

            # Format parameter items for agent input
            parameter_items_text = "\n".join(
                [
                    f"- {item['name']} (ID: {item['id']}): {item['description']} [Parameter: {item['parameter_name']}]"
                    for item in parameter_items
                ]
            )

            # Get developer instruction template from database
            agent_input: str | None = None
            try:
                classify_instruction_params = GetDeveloperInstructionSqlParams(
                    instruction_type="classify",
                    agent_role_val="classify",
                )
                classify_instruction_result = cast(
                    GetDeveloperInstructionSqlRow,
                    await execute_sql_typed(
                        conn,
                        "app/sql/v4/developer_instructions/get_developer_instruction_complete.sql",
                        params=classify_instruction_params,
                    ),
                )
                if classify_instruction_result and classify_instruction_result.template:
                    # Render Jinja template with file and parameter context
                    template = Template(classify_instruction_result.template)
                    agent_input = template.render(
                        file_list_text=file_list_text,
                        parameter_items_text=parameter_items_text,
                    )
            except Exception:
                # Fallback to hardcoded message if developer instruction not found
                agent_input = f"""You need to classify the following files by matching them to appropriate parameter items.

Files:
{file_list_text}

Available Parameter Items:
{parameter_items_text}

Analyze each file name and classify it by selecting the most appropriate parameter item IDs. A file can be linked to multiple parameter items if relevant.

Use the provided classification tools to indicate which files match each parameter item. Call the tool for each parameter item that has matching files."""

            # Run classification agent
            # Convert to developer message (non-simulation handlers use developer, not user)
            input_items: list[TResponseInputItem] = [
                {"role": "developer", "content": agent_input or ""}
            ]  # type: ignore[assignment]

            # Log system and developer messages for this run
            # Link system message (and scenario developer message if chat_id provided)
            if context["system_prompt"]:
                SQL_PATH_LINK_SYS_DEV = "app/sql/v4/model_runs/link_system_developer_messages_to_run_complete.sql"
                link_sys_dev_params = LinkSystemDeveloperMessagesToRunSqlParams(
                    run_id=model_run_id,
                    department_id=department_id,
                    chat_id=None,  # chat_id not provided for upload classification
                )
                await execute_sql_typed(
                    conn, SQL_PATH_LINK_SYS_DEV, params=link_sys_dev_params
                )

            # Link developer messages from input_items if provided
            developer_contents: list[str] = []
            if input_items:
                developer_messages = [
                    item
                    for item in input_items
                    if item
                    and isinstance(item, dict)
                    and item.get("role") == "developer"
                ]
                for dev_msg in developer_messages:
                    content = dev_msg.get("content", "")
                    if isinstance(content, str):
                        stripped = content.strip()
                        if stripped:
                            developer_contents.append(stripped)

            # Link each developer message to the run
            SQL_PATH_LINK_DEV = (
                "app/sql/v4/simulations/link_developer_message_to_run_complete.sql"
            )
            developer_message_ids: list[uuid.UUID] = []
            for content in developer_contents:
                link_dev_params = LinkDeveloperMessageToRunSqlParams(
                    content=content,
                    run_id=model_run_id,
                )
                result = cast(
                    LinkDeveloperMessageToRunSqlRow,
                    await execute_sql_typed(
                        conn, SQL_PATH_LINK_DEV, params=link_dev_params
                    ),
                )
                if result and result.message_id:
                    developer_message_ids.append(result.message_id)

            # Rate limit validation and run creation are now handled in SQL
            # (get_upload_classification_run_context_and_create_run.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Run agent (message logging and token updates happen async via log_run event)
            with trace(
                "Classification Agent",
                trace_id=None,
                group_id=None,
            ):
                result = await Runner.run(
                    classification_agent.agent(),
                    input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            usage = result.context_wrapper.usage
            assistant_output = getattr(result, "final_output", None) or ""

            # Emit async pricing event via internal bus (non-blocking)
            # This handles token updates and message logging in background
            # Pattern: All AI operations must emit log_run event after completion
            # See WEBSOCKET_STANDARDS.md for details
            await internal_sio.emit(
                "log_run",
                {
                    "run_id": str(model_run_id),
                    "operation_type": "upload_classification",
                    "input_text_tokens": usage.input_tokens,
                    "output_text_tokens": usage.output_tokens,
                    "system_prompt": context.get("system_prompt"),
                    "input_items": input_items,  # Serialized TResponseInputItem list
                    "assistant_output": assistant_output,
                    "department_id": str(department_id) if department_id else None,
                },
            )

            if invalid_file_numbers:
                await classify_upload_error(
                    ClassifyUploadErrorPayload(
                        success=False,
                        message=(
                            "Invalid file numbers in classification results: "
                            f"{', '.join(sorted(set(invalid_file_numbers)))}"
                        ),
                    ),
                    room=sid,
                )
                return

            # Map results: file_name -> [parameter_item_ids]
            suggested_items: dict[str, list[str]] = {}
            for file_name in file_names:
                suggested_items[file_name] = []

            # Process classification_results to map to file names
            for param_item_id, file_numbers in classification_results.items():
                for file_num_str in file_numbers:
                    try:
                        file_index = int(file_num_str) - 1
                        if 0 <= file_index < len(file_names):
                            file_name = file_names[file_index]
                            if file_name not in suggested_items:
                                suggested_items[file_name] = []
                            if param_item_id not in suggested_items[file_name]:
                                suggested_items[file_name].append(param_item_id)
                    except (ValueError, IndexError):
                        # Invalid file number - skip
                        pass

            # Emit completion event
            await classify_upload_complete(
                ClassifyUploadCompletePayload(
                    success=True,
                    message="Classification completed successfully",
                    suggestedParameterItemIds=suggested_items,
                ),
                room=sid,
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="uploads.classified",
                    template="{{ actor.name }} classified upload",
                    context={"upload_id": upload_id},
                    endpoint="/socket/v4/uploads/classify",
                    error=False,
                )
            except Exception:
                # Error logging activity - Socket.IO handles logging
                pass

    except Exception as e:
        # Removed logger call - Socket.IO handles logging
        await classify_upload_error(
            ClassifyUploadErrorPayload(success=False, message=str(e)), room=sid
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="uploads.classified",
                template="{{ actor.name }} failed to classify upload",
                context={"error": str(e)},
                endpoint="/socket/v4/uploads/classify",
                error=True,
            )
        except Exception:
            # Error logging activity - Socket.IO handles logging
            pass


@sio.event  # type: ignore
async def classify_upload(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = ClassifyUploadPayload(**data)
        await _classify_upload_impl(sid, validated)
    except ValidationError as e:
        # Removed logger call - Socket.IO handles logging
        await classify_upload_error(
            ClassifyUploadErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/classify", response_model=dict[str, bool])
async def classify_upload_api(request: ClassifyUploadPayload) -> dict[str, bool]:
    """Client-to-server event: Classify an uploaded file."""
    return {"success": True}


@server_router.post("/classification_progress", response_model=dict[str, bool])
async def classify_upload_progress_api(
    request: ClassifyUploadProgressPayload,
) -> dict[str, bool]:
    """Server-to-client event: Upload classification progress update."""
    return {"success": True}


@server_router.post("/classification_complete", response_model=dict[str, bool])
async def classify_upload_complete_api(
    request: ClassifyUploadCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Upload classification completed successfully."""
    return {"success": True}


@server_router.post("/classification_error", response_model=dict[str, bool])
async def classify_upload_error_api(
    request: ClassifyUploadErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred during upload classification."""
    return {"success": True}
