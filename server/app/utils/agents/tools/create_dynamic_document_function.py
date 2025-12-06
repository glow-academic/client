"""Create a function tool for creating dynamic child documents from template parents."""

import uuid
from typing import Any

from agents import Tool, function_tool
from pydantic import Field

from app.utils.logging.db_logger import get_logger
from app.main import scenario_results

logger = get_logger(__name__)

# Module-level storage for dynamic document results
dynamic_document_results: dict[str, Any] = {}

# Module-level storage for available templates (set by format_document_template_info)
available_templates: dict[str, Any] = {}


def create_dynamic_document_function(group_id: uuid.UUID | None) -> Tool:
    """Create a function tool for creating dynamic child documents from template parents."""

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
        # Get available templates
        templates = available_templates.get("templates", [])
        if not templates:
            return "Error: No template documents are available for dynamic creation."

        # Use the first available template (typically there will be only one)
        parent_template = templates[0]
        parent_document_id = parent_template.get("document_id", "")
        
        if not parent_document_id:
            return "Error: Could not determine parent template document ID."

        # Collect all kwargs as template_args (excluding any special parameters)
        template_args = {k: v for k, v in kwargs.items()}

        # Store the request for processing after agent execution
        if "dynamic_documents" not in dynamic_document_results:
            dynamic_document_results["dynamic_documents"] = []

        dynamic_document_results["dynamic_documents"].append({
            "parent_document_id": parent_document_id,
            "template_args": template_args,
        })

        logger.info(
            f"✓ Queued dynamic document creation: parent={parent_document_id}, "
            f"args={list(template_args.keys())}"
        )
        return f"Queued dynamic document creation. Child document will be created after scenario generation with provided template values."

    return function_tool(create_document)

