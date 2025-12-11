"""Create all scenario generation function tools."""

import uuid
from typing import Any

from agents import Tool, function_tool
from pydantic import Field

from app.main import get_image_generation_storage, get_pool, sio
from app.utils.agents.tools.create_dynamic_document_function import (
    create_dynamic_document_function,
)
from app.utils.agents.tools.create_objectives_function import create_objectives_function
from app.utils.agents.tools.create_title_description_function import (
    create_title_description_function,
)
from app.utils.logging.db_logger import get_logger
from app.utils.storage.request_storage import build_storage_key

logger = get_logger(__name__)


def create_scenario_tools(
    group_id: uuid.UUID | None,
    objectives_enabled: bool = True,
    documents_enabled: bool = False,
    images_enabled: bool = False,
    profile_id: str | None = None,
    trace_id: str | None = None,
    document_templates: list[dict[str, Any]] | None = None,
) -> list[Any]:
    """Create all scenario generation function tools.

    Args:
        group_id: Optional group ID for tool coordination
        objectives_enabled: Whether to include objectives tool
        documents_enabled: Whether to include dynamic document creation tool
        images_enabled: Whether to include image generation tool
        profile_id: Profile ID for tenant isolation (required if images_enabled)
        trace_id: Trace ID for request identification (optional)
        document_templates: Optional list of document templates with template_args schemas
                          If provided and documents_enabled, uses schema for strongly typed function
    """
    tools = []

    # Add title and description tool
    tools.append(
        create_title_description_function(
            group_id=group_id,
            profile_id=profile_id,
            primary_id=trace_id or (str(group_id) if group_id else None),
        )
    )
    logger.info("Created title and description tool")

    # Add objectives tool only if enabled
    if objectives_enabled:
        tools.append(
            create_objectives_function(
                group_id=group_id,
                profile_id=profile_id,
                primary_id=trace_id or (str(group_id) if group_id else None),
            )
        )
        logger.info("Created objectives tool")
    else:
        logger.info("Objectives tool skipped (objectives_enabled=False)")

    # Add dynamic document tool only if documents are enabled
    if documents_enabled:
        if not profile_id:
            logger.warning(
                "profile_id required for dynamic document storage, skipping tool"
            )
        else:
            # Extract template schema from document_templates if available
            template_schema: dict[str, Any] | None = None
            if document_templates and len(document_templates) > 0:
                # Use the first template's schema (typically there's only one)
                first_template = document_templates[0]
                template_args_raw = first_template.get("template_args")
                if template_args_raw:
                    # Parse if it's a string, otherwise use as-is
                    if isinstance(template_args_raw, str):
                        import json

                        try:
                            template_schema = json.loads(template_args_raw)
                        except json.JSONDecodeError:
                            logger.warning(
                                "Failed to parse template_args JSON, falling back to untyped function"
                            )
                    elif isinstance(template_args_raw, dict):
                        template_schema = template_args_raw
                    else:
                        logger.warning(
                            f"Unexpected template_args type: {type(template_args_raw)}, falling back to untyped function"
                        )

            tools.append(
                create_dynamic_document_function(
                    group_id=group_id,
                    profile_id=profile_id,
                    primary_id=trace_id or (str(group_id) if group_id else None),
                    template_schema=template_schema,
                )
            )
            if template_schema:
                logger.info(
                    f"Created strongly typed dynamic document tool with schema: {template_schema.get('name', 'Unknown')}"
                )
            else:
                logger.info("Created dynamic document tool (untyped fallback)")
    else:
        logger.info("Dynamic document tool skipped (documents_enabled=False)")

    # Add image generation tool only if images are enabled
    if images_enabled:
        if not profile_id:
            logger.warning("profile_id required for image generation, skipping tool")
        else:
            tools.append(
                _create_scenario_image_generation_function(
                    group_id=group_id,
                    profile_id=profile_id,
                    trace_id=trace_id,
                )
            )
            logger.info("Created image generation tool")
    else:
        logger.info("Image generation tool skipped (images_enabled=False)")

    logger.info(f"Total scenario tools created: {len(tools)}")
    return tools


def _create_scenario_image_generation_function(
    group_id: uuid.UUID | None,
    profile_id: str,
    trace_id: str | None = None,
) -> Tool:
    """Create a function tool for generating images from prompts (scenario-specific).

    Args:
        group_id: Group ID for the generation operation
        profile_id: Profile ID for tenant isolation
        trace_id: Trace ID for request identification (uses group_id if not provided)
    """
    # Determine primary_id for storage key
    primary_id = trace_id or str(group_id) if group_id else str(uuid.uuid4())

    async def generate_image(
        name: str = Field(description="Descriptive name for the generated image"),
        prompt: str = Field(
            description="Detailed, descriptive prompt for image generation"
        ),
    ) -> str:
        """Generate an image from a detailed prompt.

        This tool creates an image using AI image generation based on your detailed prompt.
        The image will be saved and linked to the scenario after generation completes.

        Args:
            name: Descriptive name for the image (required)
            prompt: Detailed, descriptive prompt describing what the image should look like (required)

        Returns:
            Confirmation message
        """
        # Get storage instance
        storage = get_image_generation_storage()

        # Build storage key
        storage_key = build_storage_key(
            operation_type="image_generation",
            profile_id=profile_id,
            primary_id=primary_id,
        )

        # Get context from storage
        agent_id = await storage.get(storage_key, "agent_id")
        department_id = await storage.get(storage_key, "department_id")
        context_profile_id = await storage.get(storage_key, "profile_id")
        room = await storage.get(storage_key, "room")

        if not agent_id:
            return "Error: Image generation context not set. Cannot generate image."

        # Create image record immediately with completed=false
        pool = get_pool()
        if not pool:
            return "Error: Database pool not available. Cannot create image record."

        try:
            async with pool.acquire() as conn:
                from app.utils.sql_helper import load_sql

                # Create image record
                sql_insert_image = load_sql("sql/v3/images/insert_image_complete.sql")
                image_row = await conn.fetchrow(sql_insert_image, name)

                if not image_row:
                    return "Error: Failed to create image record."

                image_id = image_row["id"]

                # Store image generation context for background task
                image_context_key = f"{storage_key}:image:{image_id}"
                await storage.set(image_context_key, "image_id", image_id)
                await storage.set(image_context_key, "name", name)
                await storage.set(image_context_key, "prompt", prompt)
                await storage.set(image_context_key, "agent_id", agent_id)
                await storage.set(image_context_key, "department_id", department_id)
                await storage.set(image_context_key, "profile_id", context_profile_id)
                if room:
                    await storage.set(image_context_key, "room", room)

                # Emit WebSocket event for background image generation
                await sio.emit(
                    "generate_image",
                    {
                        "image_id": image_id,
                        "storage_key": image_context_key,
                    },
                )

                # Track image_id in images list
                images = await storage.get(storage_key, "images")
                if not images:
                    images = []
                images.append(image_id)
                await storage.set(storage_key, "images", images)

                logger.info(
                    f"✓ Started image generation: name={name}, image_id={image_id}, "
                    f"prompt_length={len(prompt)}"
                )
                return f"Image generation started for '{name}'. Image ID: {image_id}"
        except Exception as e:
            logger.error(f"Error creating image record: {e}", exc_info=True)
            return f"Error: Failed to start image generation: {str(e)}"

    return function_tool(generate_image)
