"""Create a function tool for creating dynamic child documents from template parents."""

import uuid
from typing import Any

from agents import Tool, function_tool
from app.main import get_dynamic_document_storage
from app.utils.logging.db_logger import get_logger
from app.utils.storage.request_storage import build_storage_key
from pydantic import Field

logger = get_logger(__name__)


def create_dynamic_document_function(
    group_id: uuid.UUID | None,
    profile_id: str | None = None,
    primary_id: str | None = None,
) -> Tool:
    """Create a function tool for creating dynamic child documents from template parents.
    
    Args:
        group_id: Optional group ID
        profile_id: Profile ID for tenant isolation
        primary_id: Primary ID for storage key (trace_id, scenario_id, etc.)
    """

    async def create_document(**kwargs: Any) -> str:
        """Create a dynamic child document from the available template document.

        This tool renders the available template document with provided template argument values
        and creates a new child document (not a template) that replaces the parent in the scenario.

        You do not need to specify the parent document ID - it will be automatically inferred.
        Provide the template argument values directly as individual parameters.

        Args:
            **kwargs: Individual template argument values (e.g., student_name='Alex', assignment_number=3, due_date='2024-12-15')
                     The available template arguments are described in the document template info provided to you.

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

        # Collect all kwargs as template_args (excluding any special parameters)
        template_args = {k: v for k, v in kwargs.items()}

        # Get existing dynamic documents list or create new one
        dynamic_documents = await storage.get(storage_key, "dynamic_documents")
        if not dynamic_documents:
            dynamic_documents = []
        
        # Append new document request
        dynamic_documents.append({
            "parent_document_id": parent_document_id,
            "template_args": template_args,
        })
        
        # Store updated list
        await storage.set(storage_key, "dynamic_documents", dynamic_documents)

        logger.info(
            f"✓ Queued dynamic document creation: parent={parent_document_id}, "
            f"args={list(template_args.keys())}"
        )
        return f"Queued dynamic document creation. Child document will be created after scenario generation with provided template values."

    return function_tool(create_document)

