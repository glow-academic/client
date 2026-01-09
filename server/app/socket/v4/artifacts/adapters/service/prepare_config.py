"""Service layer for preparing adapter configurations from database."""

import uuid
from typing import Any, cast

from agents import Tool
from agents.items import TResponseInputItem
from app.main import UPLOAD_FOLDER
from app.sql.types import (
    GetImageGenerationContextAndCreateUploadSqlParams,
    GetImageGenerationContextAndCreateUploadSqlRow,
    GetMessagesByIdsSqlParams,
    GetMessagesByIdsSqlRow,
    GetMessagesByRunIdSqlParams,
    GetMessagesByRunIdSqlRow,
    GetTextRunContextForExistingRunSqlParams,
    GetTextRunContextForExistingRunSqlRow,
    GetVideoRunContextAndCreateRunSqlParams,
    GetVideoRunContextAndCreateRunSqlRow,
)
from app.socket.v4.artifacts.adapters.base.config import AdapterConfig
from app.infra.v4.tools.build_tool_from_config import build_tool_from_config
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import execute_sql_typed

# SQL paths
SQL_PATH_TEXT = "app/sql/v4/generate/text/get_text_run_context_for_existing_run_complete.sql"
SQL_PATH_MESSAGES_BY_IDS = "app/sql/v4/messages/get_messages_by_ids_complete.sql"
SQL_PATH_MESSAGES_BY_RUN = "app/sql/v4/messages/get_messages_by_run_id_complete.sql"
SQL_PATH_IMAGE = "app/sql/v4/images/get_image_generation_context_and_create_upload_complete.sql"
SQL_PATH_VIDEO = "app/sql/v4/videos/get_video_run_context_and_create_run_complete.sql"


async def prepare_text_config(
    conn: Any,
    run_id: uuid.UUID,
    agent_id: uuid.UUID,
    resource_id: uuid.UUID,
    resource_type: str,
    message_ids: list[uuid.UUID] | None = None,
    group_id: uuid.UUID | None = None,
) -> AdapterConfig:
    """Prepare text adapter configuration from database.

    Args:
        conn: Database connection
        run_id: Run ID (already created)
        agent_id: Agent ID
        resource_id: Resource ID
        resource_type: Resource type
        message_ids: Optional list of message IDs
        group_id: Optional group ID

    Returns:
        AdapterConfig with all necessary data for text generation
    """
    # Query SQL for agent config
    params = GetTextRunContextForExistingRunSqlParams(
        run_id=run_id,
        agent_id=agent_id,
        resource_id=resource_id,
        resource_type=resource_type,
        message_ids=message_ids,
        group_id=group_id,
    )
    result = cast(
        GetTextRunContextForExistingRunSqlRow,
        await execute_sql_typed(conn, SQL_PATH_TEXT, params=params),
    )

    if not result:
        raise ValueError("Run not found or no agent configured")

    # Decrypt API key
    if not result.api_key:
        raise ValueError(f"API key not found for agent {agent_id}")

    try:
        decrypted_api_key = decrypt_api_key(result.api_key)
    except Exception as e:
        raise ValueError(f"Failed to decrypt API key: {str(e)}")

    # Build tools from database configs
    agent_tools_config = [
        tool for tool in (result.tools or []) if tool.name is not None
    ]

    text_tools: list[Tool] = []
    for tool in agent_tools_config:
        if tool.name is None:
            continue
        try:
            tool_config = {
                "id": str(tool.id),
                "name": tool.name,
                "description": tool.description or "",
                "tool_type": tool.tool_type or "",
                "agent_role": tool.agent_role or "",
                "arguments": tool.arguments,
                "argument_descriptions": tool.argument_descriptions,
                "argument_defaults": tool.argument_defaults,
                "active": tool.active,
            }
            built_tool = build_tool_from_config(tool_config)
            text_tools.append(built_tool)
        except Exception:
            # Log warning but continue
            import logging
            logging.getLogger(__name__).warning(f"Failed to build tool {tool.name}")

    # Construct input items for the agent
    input_items: list[TResponseInputItem] = []

    # Handle audio input if upload_id is provided
    if result.upload_id and result.file_path:
        audio_file_path = UPLOAD_FOLDER / result.file_path
        if audio_file_path.exists():
            audio_input: TResponseInputItem = {
                "role": "user",
                "content": f"Audio file to process: {audio_file_path}",
            }
            input_items.append(audio_input)

    # Get all messages linked to the run (system/developer messages from previous runs)
    try:
        run_messages_params = GetMessagesByRunIdSqlParams(run_id=run_id)
        run_messages_result = cast(
            GetMessagesByRunIdSqlRow,
            await execute_sql_typed(conn, SQL_PATH_MESSAGES_BY_RUN, params=run_messages_params),
        )
        if run_messages_result.messages:
            for msg in run_messages_result.messages:
                if msg.role in ("system", "developer"):
                    input_items.append({
                        "role": msg.role,
                        "content": msg.content or "",
                    })
    except Exception:
        import logging
        logging.getLogger(__name__).warning(f"Failed to fetch run messages")

    # Get messages from message_ids (user regeneration message + context messages)
    if message_ids:
        try:
            messages_params = GetMessagesByIdsSqlParams(message_ids=message_ids)
            messages_result = cast(
                GetMessagesByIdsSqlRow,
                await execute_sql_typed(conn, SQL_PATH_MESSAGES_BY_IDS, params=messages_params),
            )
            if messages_result.messages:
                for msg in messages_result.messages:
                    if msg.role not in ("system", "developer"):
                        input_items.append({
                            "role": msg.role,
                            "content": msg.content or "",
                        })
        except Exception:
            import logging
            logging.getLogger(__name__).warning(f"Failed to fetch messages by IDs")

    # Track completed tool names for verification
    required_tool_names: set[str] = {
        tool.name for tool in agent_tools_config if tool.name is not None
    }
    tool_name_to_type: dict[str, str] = {
        tool.name: tool.tool_type
        for tool in agent_tools_config
        if tool.name is not None and tool.tool_type is not None
    }

    return AdapterConfig(
        api_key=decrypted_api_key,
        model_name=result.model_name or "",
        provider=result.provider or "",
        base_url=result.base_url,
        custom_model=getattr(result, "custom_model", None),
        agent_name=result.agent_name or "",
        system_prompt=result.system_prompt or "",
        temperature=result.temperature or 0.0,
        reasoning=result.reasoning,
        tools=text_tools,
        input_items=input_items,
        run_id=run_id,
        trace_id=result.trace_id,
        group_id=result.group_id,
        upload_id=result.upload_id,
        file_path=result.file_path,
        tool_name_to_type=tool_name_to_type,
        required_tool_names=required_tool_names,
        resource_id=resource_id,
        resource_type=resource_type,
    )


async def prepare_image_config(
    conn: Any,
    image_id: uuid.UUID,
    agent_id: uuid.UUID,
    profile_id: uuid.UUID,
    department_id: uuid.UUID | None = None,
    prompt: str = "",
) -> AdapterConfig:
    """Prepare image adapter configuration from database.

    Args:
        conn: Database connection
        image_id: Image ID
        agent_id: Agent ID
        profile_id: Profile ID
        department_id: Optional department ID
        prompt: Image generation prompt

    Returns:
        AdapterConfig with all necessary data for image generation
    """
    # Query SQL for agent config
    params = GetImageGenerationContextAndCreateUploadSqlParams(
        image_id=image_id,
        agent_id=agent_id,
        profile_id=profile_id,
        department_id=department_id,
    )
    result = cast(
        GetImageGenerationContextAndCreateUploadSqlRow,
        await execute_sql_typed(conn, SQL_PATH_IMAGE, params=params),
    )

    if not result:
        raise ValueError(f"Agent {agent_id} not found or inactive")

    if not result.api_key:
        raise ValueError(f"API key not found for agent {agent_id}")

    # Decrypt API key
    try:
        decrypted_api_key = decrypt_api_key(result.api_key)
    except Exception as e:
        raise ValueError(f"Failed to decrypt API key: {str(e)}")

    return AdapterConfig(
        api_key=decrypted_api_key,
        model_name=result.model_name or "",
        provider=result.provider or "",
        base_url=result.base_url,
        custom_model=getattr(result, "custom_model", None),
        agent_name="",  # Not used for image
        system_prompt="",  # Not used for image
        temperature=0.0,  # Not used for image
        reasoning=None,
        tools=[],
        input_items=[],
        run_id=uuid.UUID(result.run_id),
        trace_id=None,
        group_id=None,
        prompt=prompt,
        image_id=image_id,
        department_id=department_id,
        resource_id=image_id,
        resource_type="images",
    )


async def prepare_video_config(
    conn: Any,
    video_id: uuid.UUID,
    profile_id: uuid.UUID,
    prompt: str = "",
    image_reference_id: str | None = None,
    upload_id: uuid.UUID | None = None,
) -> AdapterConfig:
    """Prepare video adapter configuration from database.

    Args:
        conn: Database connection
        video_id: Video ID
        profile_id: Profile ID
        prompt: Video generation prompt
        image_reference_id: Optional image reference ID

    Returns:
        AdapterConfig with all necessary data for video generation
    """
    # Query SQL for agent config
    params = GetVideoRunContextAndCreateRunSqlParams(
        video_id=video_id,
        profile_id=profile_id,
    )
    result = cast(
        GetVideoRunContextAndCreateRunSqlRow,
        await execute_sql_typed(conn, SQL_PATH_VIDEO, params=params),
    )

    if not result:
        raise ValueError(f"No video agent configured for video {video_id}")

    if not result.api_key:
        agent_name = result.agent_name or "video agent"
        model_name = result.model_name or "unknown model"
        raise ValueError(f"API key not found for {agent_name} (model: {model_name})")

    # Decrypt API key
    try:
        decrypted_api_key = decrypt_api_key(result.api_key)
    except ValueError as e:
        raise ValueError(f"Failed to decrypt API key for {result.agent_name or 'video agent'}: {str(e)}")

    return AdapterConfig(
        api_key=decrypted_api_key,
        model_name=result.model_name or "",
        provider=result.provider or "",
        base_url=result.base_url,
        custom_model=getattr(result, "custom_model", None),
        agent_name=result.agent_name or "",
        system_prompt="",  # Not used for video
        temperature=0.0,  # Not used for video
        reasoning=None,
        tools=[],
        input_items=[],
        run_id=uuid.UUID(result.run_id),
        trace_id=None,
        group_id=None,
        prompt=prompt,
        video_id=video_id,
        department_id=result.department_id,
        resource_id=video_id,
        resource_type="videos",
        image_reference_id=image_reference_id,
        upload_id=upload_id,
    )


async def prepare_audio_config(
    conn: Any,
    agent_config: Any,  # AgentConfig from types
    resource_id: uuid.UUID,
    resource_type: str,
    run_id: uuid.UUID,
) -> AdapterConfig:
    """Prepare audio adapter configuration from database.

    Args:
        conn: Database connection
        agent_config: AgentConfig from SQL result
        resource_id: Resource ID (chat_id for voice, upload_id for audio)
        resource_type: Resource type ("voice" | "audio")
        run_id: Run ID (already created)

    Returns:
        AdapterConfig with all necessary data for audio generation
    """
    # Decrypt API key
    if not agent_config.api_key:
        raise ValueError(f"API key not found for agent {agent_config.agent_id}")

    try:
        decrypted_api_key = decrypt_api_key(agent_config.api_key)
    except ValueError as e:
        raise ValueError(f"Failed to decrypt API key: {str(e)}")

    return AdapterConfig(
        api_key=decrypted_api_key,
        model_name=agent_config.model_name or "",
        provider=agent_config.provider or "",
        base_url=agent_config.base_url,
        custom_model=agent_config.custom_model,
        agent_name=agent_config.agent_name or "",
        system_prompt=agent_config.system_prompt or "",
        temperature=agent_config.temperature or 0.0,
        reasoning=agent_config.reasoning,
        tools=[],  # Audio tools handled separately
        input_items=[],
        run_id=run_id,
        trace_id=None,
        group_id=None,
        upload_id=resource_id if resource_type == "audio" else None,
        resource_id=resource_id,
        resource_type=resource_type,
    )
