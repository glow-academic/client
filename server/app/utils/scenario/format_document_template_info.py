"""Format document template information for scenario agent input."""

import json
from typing import Any

from agents.items import TResponseInputItem
from app.utils.logging.db_logger import get_logger
from app.utils.agents.tools.create_dynamic_document_function import available_templates

logger = get_logger(__name__)


def format_document_template_info(
    document_templates: list[dict[str, Any]],
) -> TResponseInputItem | None:
    """
    Format document template information as TResponseInputItem.

    Args:
        document_templates: List of dicts with keys: document_id, document_name,
                           template_args (schema JSON), template_upload_id

    Returns:
        Dict with role="developer" and content formatted for agent input, or None if no templates
    """
    if not document_templates:
        return None

    formatted_templates = []
    for template in document_templates:
        document_id = template.get("document_id", "")
        document_name = template.get("document_name", "Unknown Document")
        template_args = template.get("template_args", {})
        
        # Parse template_args if it's a string
        if isinstance(template_args, str):
            try:
                template_args = json.loads(template_args)
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse template_args for document {document_id}")
                template_args = {}

        # Format template schema info
        schema_name = template_args.get("name", "Template")
        fields = template_args.get("fields", [])
        
        # Build field descriptions
        field_descriptions = []
        for field in fields:
            field_name = field.get("name", "")
            field_type = field.get("type", "string")
            required = field.get("required", False)
            description = field.get("description", "")
            placeholder = field.get("placeholder", "")
            required_str = " (required)" if required else " (optional)"
            
            field_desc = f"  - {field_name}: {field_type}{required_str}"
            if description:
                field_desc += f"\n    Description: {description}"
            if placeholder:
                field_desc += f"\n    Example: {placeholder}"
            
            field_descriptions.append(field_desc)

        fields_text = "\n".join(field_descriptions) if field_descriptions else "  (no fields defined)"

        template_info = f"""Document Template: {document_name}
  Document ID: {document_id}
  Template Schema: {schema_name}
  Required Template Arguments:
{fields_text}
"""
        formatted_templates.append(template_info)

    # Store available templates for tool to access
    available_templates.clear()
    available_templates.update({
        "templates": document_templates,
        "template_schemas": {}
    })
    
    # Store schema info for each template
    for template in document_templates:
        document_id = template.get("document_id", "")
        template_args = template.get("template_args", {})
        
        # Parse template_args if it's a string
        if isinstance(template_args, str):
            try:
                template_args = json.loads(template_args)
            except json.JSONDecodeError:
                template_args = {}
        
        available_templates["template_schemas"][document_id] = template_args

    # Build field list for easier reference
    field_names = []
    for template in document_templates:
        template_args = template.get("template_args", {})
        if isinstance(template_args, str):
            try:
                template_args = json.loads(template_args)
            except json.JSONDecodeError:
                template_args = {}
        fields = template_args.get("fields", [])
        for field in fields:
            field_name = field.get("name", "")
            if field_name:
                field_names.append(field_name)
    
    fields_list = ", ".join(field_names) if field_names else "(see template schema above)"

    content = (
        "The following document template is available for dynamic creation. "
        "You can use the create_document tool to create a customized child document "
        "by providing the template argument values directly as individual parameters.\n\n"
        + "\n".join(formatted_templates) +
        f"\n\nTo create a dynamic document, call create_document with the individual "
        f"template argument values. Available arguments:\n{fields_list}\n"
        f"Example: create_document({', '.join([f'{f}=value' for f in field_names[:3]]) if field_names else 'arg1=value1, arg2=value2'})"
    )

    return {
        "role": "developer",
        "content": content,
    }

