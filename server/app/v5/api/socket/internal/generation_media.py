"""Handle media resource creation events — trigger image/video generation.

Listens on generate_call_complete with event_type == "tool_result" for
resource_type in ("images", "videos"). When an image/video resource is
created by the agentic text loop, this handler resolves the media agent
and emits a secondary generate_artifact with the appropriate modality.
"""

import uuid
from typing import Any, cast

from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.get_db_connection import get_db_connection
from app.globals import get_internal_sio
from app.v5.api.socket.internal.generate_artifact import GenerateArtifactPayload
from app.sql.types import GetAgentModelInfoSqlParams, GetAgentModelInfoSqlRow
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

# Maps resource_type → (modality, metadata key for agent_id)
_MEDIA_RESOURCE_MAP: dict[str, tuple[str, str]] = {
    "images": ("image", "image_agent_id"),
    "videos": ("video", "video_agent_id"),
}


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_media_generation(data: dict[str, Any]) -> None:
    """Intercept tool_result events for media resources and trigger generation."""
    event_type = data.get("event_type")
    if event_type != "tool_result":
        return

    tool_result = data.get("result") or {}
    resource_type = tool_result.get("resource_type")
    if not resource_type or resource_type not in _MEDIA_RESOURCE_MAP:
        return

    sid = data.get("sid", "")
    run_id = data.get("run_id")
    if not sid or not run_id:
        return

    modality, agent_id_key = _MEDIA_RESOURCE_MAP[resource_type]
    metadata = data.get("metadata") or {}

    # Read agent_id from metadata (injected by generate.py)
    agent_id_str = metadata.get(agent_id_key)
    if not agent_id_str:
        logger.debug(
            f"No {agent_id_key} in metadata, skipping {modality} generation "
            f"for resource_type={resource_type}"
        )
        return

    # Extract prompt from the tool result's resource_data
    resource_data = tool_result.get("resource_data") or {}
    prompt = resource_data.get("description") or resource_data.get("name") or ""
    if not prompt:
        logger.warning(
            f"No prompt found in resource_data for {modality} generation, "
            f"resource_type={resource_type}"
        )
        return

    resource_id = tool_result.get("resource_id")
    group_id = data.get("group_id")
    artifact_type = data.get("artifact_type")

    # Resolve profile_id
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        logger.error(f"No profile_id for sid={sid}, skipping {modality} generation")
        return

    # Resolve model config from the media agent
    try:
        agent_id = uuid.UUID(agent_id_str)
        profile_id = uuid.UUID(profile_id_str)

        params = GetAgentModelInfoSqlParams(
            agent_id=agent_id,
            profile_id=profile_id,
        )

        async with get_db_connection() as conn:
            result = cast(
                GetAgentModelInfoSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/queries/agents/get_agent_model_info_complete.sql",
                    params=params,
                ),
            )

        if not result:
            logger.error(f"Agent {agent_id_str} not found for {modality} generation")
            return

        api_key = result.api_key
        if not api_key:
            logger.error(
                f"No API key for agent {agent_id_str}, skipping {modality} generation"
            )
            return

        model_name = result.model_name or ""
        base_url = result.base_url

    except Exception as e:
        logger.exception(f"Failed to resolve {modality} agent config: {e}")
        return

    # Emit generate_artifact with the media modality
    await internal_sio.emit(
        "generate_artifact",
        GenerateArtifactPayload(
            sid=sid,
            run_id=run_id,
            group_id=group_id,
            modality=modality,
            artifact_type=artifact_type,
            resource_type=resource_type,
            resource_id=resource_id,
            messages=[{"role": "user", "content": prompt}],
            llm_config={
                "model": model_name,
                "api_key": api_key,
                "base_url": base_url,
            },
            save=False,
            metadata=metadata,
        ).model_dump(mode="json"),
    )

    logger.info(
        f"Triggered {modality} generation: agent={agent_id_str}, "
        f"model={model_name}, resource_id={resource_id}"
    )
