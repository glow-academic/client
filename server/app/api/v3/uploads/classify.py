"""Upload classification endpoint - v3 API following DHH principles."""

import json
import uuid
import zipfile
from typing import Annotated, Any

import asyncpg  # type: ignore
from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    ToolsToFinalOutputResult,
    trace,
)
from agents.items import TResponseInputItem
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import TUS_UPLOADS_DIR, classification_results, get_db
from app.utils.activity.audit import audit_activity, audit_set
from app.infra.agents.generic_agent import GenericAgent
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.tools.build_pydantic_fields import build_function_signature_string
from agents import Tool, function_tool
from pydantic import Field
from app.utils.debug_info import DebugContext
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

router = APIRouter()


class ClassifyUploadRequest(BaseModel):
    """Request body for upload classification."""

    # profileId removed - comes from X-Profile-Id header
    parameterIds: list[str] | None = None  # Optional filter for specific parameters


class ClassifyUploadResponse(BaseModel):
    """Response from upload classification."""

    success: bool
    message: str
    suggestedParameterItemIds: dict[str, list[str]]  # file_name -> [parameter_item_ids]
    newParameterItems: list[dict[str, Any]] = []  # For future use - new items to create


@router.post(
    "/upload/{upload_id}/classify",
    response_model=ClassifyUploadResponse,
    dependencies=[
        audit_activity(
            "upload.classified", "{{ actor.name }} classified upload '{{ upload.id }}'"
        )
    ],
)
async def classify_upload(
    upload_id: str,
    request_body: ClassifyUploadRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ClassifyUploadResponse:
    """Classify an uploaded file and suggest parameter items."""
    tags = ["uploads"]

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        profile_id_uuid = uuid.UUID(profile_id)

        # Find the upload directory
        upload_dir = TUS_UPLOADS_DIR / upload_id

        if not upload_dir.exists():
            return ClassifyUploadResponse(
                success=False,
                message=f"Upload with uploadId {upload_id} not found",
                suggestedParameterItemIds={},
            )

        # Read metadata
        metadata_path = upload_dir / "metadata.json"
        metadata = {}
        if metadata_path.exists():
            with open(metadata_path) as f:
                metadata = json.load(f)

        # Get the uploaded file path
        file_path = upload_dir / "file"

        if not file_path.exists() or file_path.stat().st_size == 0:
            return ClassifyUploadResponse(
                success=False,
                message="Upload file is missing or empty",
                suggestedParameterItemIds={},
            )

        filename = metadata.get("filename", "unknown")
        is_zip = filename.lower().endswith(".zip")

        # Get parameter items for classification
        parameter_ids_filter: list[uuid.UUID] | None = None
        if request_body.parameterIds:
            parameter_ids_filter = [uuid.UUID(pid) for pid in request_body.parameterIds]

        sql_param_items = load_sql("sql/v3/uploads/get_classification_context.sql")
        rows = await conn.fetch(
            sql_param_items,
            parameter_ids_filter if parameter_ids_filter else [],
            profile_id_uuid,
        )

        parameter_items = [
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "value": row["value"],
                "parameter_id": row["parameter_id"],
                "parameter_name": row["parameter_name"],
            }
            for row in rows
        ]

        if not parameter_items:
            return ClassifyUploadResponse(
                success=False,
                message="No parameter items available for classification",
                suggestedParameterItemIds={},
            )

        # Extract file names from upload
        file_names: list[str] = []
        if is_zip:
            try:
                with zipfile.ZipFile(file_path, "r") as zip_ref:
                    file_names = sorted(zip_ref.namelist())
            except Exception as e:
                logger.error(f"Error reading ZIP file: {str(e)}")
                return ClassifyUploadResponse(
                    success=False,
                    message=f"Error reading ZIP file: {str(e)}",
                    suggestedParameterItemIds={},
                )
        else:
            file_names = [filename]

        # Clear previous classification results
        classification_results.clear()

        # Get user's department for agent selection (use first department or None)
        user_dept_rows = await conn.fetch(
            "SELECT department_id FROM profile_departments WHERE profile_id = $1 AND active = true LIMIT 1",
            profile_id_uuid,
        )
        department_id = user_dept_rows[0]["department_id"] if user_dept_rows else None

        # Get classification agent context
        sql_context = load_sql(
            "sql/v3/agents/get_upload_classification_run_context.sql"
        )
        context_row = await conn.fetchrow(
            sql_context,
            department_id,
            profile_id_uuid,
        )

        if not context_row:
            return ClassifyUploadResponse(
                success=False,
                message="Classification agent not found",
                suggestedParameterItemIds={},
            )

        context = {
            "agent_id": context_row["agent_id"],
            "agent_name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"]),
            "reasoning": context_row["reasoning"],
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "provider": context_row["provider"],
            "base_url": context_row["base_url"] or None,
            "api_key": context_row["api_key"],
            "profile_id": context_row["profile_id"],
            "req_per_day": context_row["req_per_day"],
            "runs_today_count": int(context_row["runs_today_count"]),
        }

        # Check rate limit
        if (
            context["req_per_day"] is not None
            and context["runs_today_count"] >= context["req_per_day"]
        ):
            return ClassifyUploadResponse(
                success=False,
                message=f"Daily request limit of {context['req_per_day']} reached. Please try again tomorrow.",
                suggestedParameterItemIds={},
            )

        # Load agent tools from database
        agent_id_uuid = uuid.UUID(context["agent_id"])
        sql_get_agent_tools = load_sql("sql/v3/agents/get_agent_tools.sql")
        rows = await conn.fetch(sql_get_agent_tools, str(agent_id_uuid))
        agent_tools_config = [dict(row) for row in rows]
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
                file_names_desc = base_classification_config.get("argument_descriptions", {}).get("file_names", f"List of file names (from the file list above) that match the parameter item '{item['name']}'")
            else:
                file_names_desc = f"List of file names (from the file list above) that match the parameter item '{item['name']}'"
            
            # Create function with proper closure capture
            def make_classification_function(item_dict: dict[str, Any], file_names_descr: str):
                async def classify_parameter_item(
                    file_names: list[str] = Field(description=file_names_descr),
                ) -> str:
                    """Classify files by matching them to the parameter item: {item_name}

                    Args:
                        file_names: List of file names that match this parameter item

                    Returns:
                        Confirmation message
                    """.format(item_name=item_dict["name"])
                    # Store classification result
                    if item_dict["id"] not in classification_results:
                        classification_results[item_dict["id"]] = []
                    classification_results[item_dict["id"]].extend(file_names)
                    logger.info(f"✓ Classified {len(file_names)} files for {item_dict['name']}")
                    return f"Classified {len(file_names)} file(s) for {item_dict['name']}"
                
                # Set unique function name
                safe_name = "".join(c if c.isalnum() or c == "_" else "_" for c in item_dict["name"].lower())
                classify_parameter_item.__name__ = f"classify_{safe_name}"
                return classify_parameter_item
            
            classify_func = make_classification_function(item, file_names_desc)
            classification_tools.append(function_tool(classify_func))
        
        logger.info(f"Created {len(classification_tools)} classification tools")

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

        # Create input for agent
        agent_input = f"""You need to classify the following files by matching them to appropriate parameter items.

Files:
{file_list_text}

Available Parameter Items:
{parameter_items_text}

Analyze each file name and classify it by selecting the most appropriate parameter item IDs. A file can be linked to multiple parameter items if relevant.

Use the provided classification tools to indicate which files match each parameter item. Call the tool for each parameter item that has matching files."""

        # Create model run
        sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
        model_run_row = await conn.fetchrow(
            sql_create_run,
            str(department_id) if department_id else None,
            context["model_id"],
            context["agent_id"],
            "agent",
            context["profile_id"],
            None,  # key_id
            context["agent_id"],  # agent_id
        )
        model_run_id = uuid.UUID(model_run_row["run_id"])

        # Run classification agent
        # Convert to developer message (non-simulation handlers use developer, not user)
        input_items: list[TResponseInputItem] = [
            {"role": "developer", "content": agent_input}
        ]  # type: ignore[assignment]

        # Log system and developer messages for this run
        # Link system message (and scenario developer message if chat_id provided)
        if context["system_prompt"]:
            sql_link_sys_dev = load_sql(
                "sql/v3/model_runs/link_system_developer_messages_to_run.sql"
            )
            await conn.fetchrow(
                sql_link_sys_dev,
                str(model_run_id),
                str(department_id) if department_id else None,
                None,  # chat_id
            )

        # Link developer messages from input_items if provided
        developer_contents: list[str] = []
        if input_items:
            developer_messages = [
                item
                for item in input_items
                if item and isinstance(item, dict) and item.get("role") == "developer"
            ]
            for dev_msg in developer_messages:
                content = dev_msg.get("content", "")
                if isinstance(content, str):
                    stripped = content.strip()
                    if stripped:
                        developer_contents.append(stripped)

        # Link each developer message to the run
        sql_link_dev = load_sql("sql/v3/simulations/link_developer_message_to_run.sql")
        developer_message_ids: list[uuid.UUID] = []
        for content in developer_contents:
            result = await conn.fetchrow(
                sql_link_dev,
                content,
                str(model_run_id),
            )
            if result and result.get("message_id"):
                message_id = result["message_id"]
                if isinstance(message_id, uuid.UUID):
                    developer_message_ids.append(message_id)
                else:
                    developer_message_ids.append(uuid.UUID(str(message_id)))

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

        # Log assistant message (model output)
        assistant_output = getattr(result, "final_output", None) or ""
        if assistant_output and assistant_output.strip():
            # Get the parent message ID (developer if exists, otherwise system)
            parent_message_id: uuid.UUID | None = None

            # Try to get developer message ID (use the last one if multiple)
            if developer_message_ids:
                parent_message_id = developer_message_ids[-1]
            else:
                # Get system message ID from the run
                sys_dev_result = await conn.fetchrow(
                    load_sql("sql/v3/model_runs/link_system_developer_messages_to_run.sql"),
                    str(model_run_id),
                    str(department_id) if department_id else None,
                    None,  # chat_id
                )
                if sys_dev_result and sys_dev_result.get("system_message_id"):
                    system_msg_id = sys_dev_result["system_message_id"]
                    if isinstance(system_msg_id, uuid.UUID):
                        parent_message_id = system_msg_id
                    else:
                        parent_message_id = uuid.UUID(str(system_msg_id))

            # Create assistant message with branch
            sql_create_assistant = load_sql(
                "sql/v3/messages/create_assistant_message_with_branch.sql"
            )
            await conn.fetchrow(
                sql_create_assistant,
                assistant_output.strip(),
                str(model_run_id),
                str(parent_message_id) if parent_message_id else None,
            )

        # Update token counts
        usage = result.context_wrapper.usage
        sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
        await conn.execute(
            sql_update_tokens,
            str(model_run_id),
            usage.input_tokens,
            usage.output_tokens,
        )

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
                    logger.warning(
                        f"Invalid file number in classification results: {file_num_str}"
                    )

        result_data = ClassifyUploadResponse(
            success=True,
            message="Classification completed successfully",
            suggestedParameterItemIds=suggested_items,
        )

        # Fetch actor_name separately
        actor_name_row = await conn.fetchrow(
            "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
            profile_id_uuid,
        )
        actor_name = actor_name_row["actor_name"] if actor_name_row else None

        # Set audit context
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                upload={"id": upload_id},
            )

        # Invalidate cache after classification
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data

    except Exception as e:
        logger.error(f"Error classifying upload: {str(e)}")
        return ClassifyUploadResponse(
            success=False,
            message=f"Failed to classify upload: {str(e)}",
            suggestedParameterItemIds={},
        )
