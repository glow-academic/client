"""Create a function tool for creating dynamic child documents from template parents."""

import uuid
from typing import Any, Type

from agents import Tool, function_tool
from app.main import get_dynamic_document_storage
from app.utils.agents.tools.build_template_model import build_template_model
from app.utils.logging.db_logger import get_logger
from app.utils.storage.request_storage import build_storage_key
from pydantic import BaseModel

logger = get_logger(__name__)


def create_dynamic_document_function(
    group_id: uuid.UUID | None,
    profile_id: str | None = None,
    primary_id: str | None = None,
    template_schema: dict[str, Any] | None = None,
) -> Tool:
    """Create a function tool for creating dynamic child documents from template parents.

    Args:
        group_id: Optional group ID
        profile_id: Profile ID for tenant isolation
        primary_id: Primary ID for storage key (trace_id, scenario_id, etc.)
        template_schema: Optional template schema dict from database (templates.args JSONB)
                        If provided, creates a strongly typed function. If None, falls back to dict parameter.
    """
    # Build Pydantic model from template schema if provided
    TemplateArgsModel: Type[BaseModel] | None = None
    if template_schema:
        try:
            TemplateArgsModel = build_template_model(template_schema)
            logger.info(
                f"Built strongly typed template model: {TemplateArgsModel.__name__}"
            )
        except Exception as e:
            logger.warning(
                f"Failed to build template model, falling back to dict: {e}",
                exc_info=True,
            )
            TemplateArgsModel = None

    # Create function with consistent signature - use Any for parameter to allow both types
    async def create_document(template_args: Any) -> str:
        """Create a dynamic child document from the available template document.

        This tool renders the available template document with provided template argument values
        and creates a new child document (not a template) that replaces the parent in the scenario.

        You do not need to specify the parent document ID - it will be automatically inferred.
        Provide the template argument values as specified by the template schema.

        Args:
            template_args: Template argument values matching the template schema (Pydantic model if typed, dict if untyped)

        Returns:
            Confirmation message
        """
        if not profile_id or not primary_id:
            return "Error: Storage configuration missing"

        storage = get_dynamic_document_storage()
        storage_key = build_storage_key(
            operation_type="dynamic_document",
            profile_id=profile_id,
            primary_id=primary_id,
        )

        # Get available templates from storage
        templates = await storage.get(storage_key, "templates")
        if not templates:
            return "Error: No template documents are available for dynamic creation."

        # Use the first available template (typically there will be only one)
        parent_template = templates[0]
        parent_document_id = parent_template.get("document_id", "")

        if not parent_document_id:
            return "Error: Could not determine parent template document ID."

        # Convert template_args to dict
        if TemplateArgsModel and isinstance(template_args, BaseModel):
            # Pydantic model - convert to dict
            if hasattr(template_args, "model_dump"):
                template_args_dict = template_args.model_dump(exclude_none=True)  # type: ignore[attr-defined]
            elif hasattr(template_args, "dict"):
                template_args_dict = template_args.dict(exclude_none=True)  # type: ignore[attr-defined]
            else:
                template_args_dict = dict(template_args)  # type: ignore[arg-type]
        elif isinstance(template_args, dict):
            # Already a dict
            template_args_dict = template_args
        else:
            # Fallback: try to convert to dict
            template_args_dict = dict(template_args) if hasattr(template_args, "__dict__") else {}  # type: ignore[arg-type]

        # Get existing dynamic documents list or create new one
        dynamic_documents = await storage.get(storage_key, "dynamic_documents")
        if not dynamic_documents:
            dynamic_documents = []

        # Append new document request
        dynamic_documents.append(
            {
                "parent_document_id": parent_document_id,
                "template_args": template_args_dict,
            }
        )

        # Store updated list
        await storage.set(storage_key, "dynamic_documents", dynamic_documents)

        logger.info(
            f"✓ Queued dynamic document creation: parent={parent_document_id}, "
            f"args={list(template_args_dict.keys())}"
        )
        return "Queued dynamic document creation. Child document will be created after scenario generation with provided template values."

    # Create function tool with proper type annotation if we have a model
    if TemplateArgsModel:
        # Use the model type for the function signature
        import inspect
        from typing import get_type_hints

        # Create a wrapper that has the proper type annotation
        async def typed_create_document(template_args: TemplateArgsModel) -> str:  # type: ignore[valid-type]
            return await create_document(template_args)
        
        return function_tool(typed_create_document)
    else:
        return function_tool(create_document)
