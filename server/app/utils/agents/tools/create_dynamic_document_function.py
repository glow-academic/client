"""Create a function tool for creating dynamic child documents from template parents."""

import uuid
from typing import Any, Type

from agents import Tool, function_tool
from app.main import get_dynamic_document_storage
from app.utils.agents.tools.build_template_model import build_template_model
from app.utils.logging.db_logger import get_logger
from app.utils.storage.request_storage import build_storage_key
from pydantic import BaseModel, Field

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
                        If provided, creates a function with individual parameters for each field.
                        If None, falls back to dict parameter.
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

    # Core implementation function that processes template args
    async def _create_document_impl(template_args_dict: dict[str, Any]) -> str:
        """Internal implementation that processes template args dict."""
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

    # If we have a template schema, create a function with individual parameters
    if template_schema and TemplateArgsModel:
        fields_data = template_schema.get("fields", [])
        if fields_data:
            # Build function signature with individual parameters
            # We'll use exec to create a function with dynamic signature
            param_definitions = []
            param_names = []
            
            for field in fields_data:
                field_name = field.get("name")
                if not field_name:
                    continue
                    
                field_type = field.get("type", "string")
                required = field.get("required", False)
                description = field.get("description", "")
                placeholder = field.get("placeholder", "")
                
                # Build description with placeholder if available
                field_description = description
                if placeholder:
                    field_description = f"{description} (Example: {placeholder})" if description else f"Example: {placeholder}"
                
                # Map field types to Python types for type hints
                python_type_str = "str"
                if field_type == "number":
                    python_type_str = "float"
                elif field_type == "boolean":
                    python_type_str = "bool"
                elif field_type == "array":
                    python_type_str = "list[str]"  # Default to list[str] for arrays
                
                param_names.append(field_name)
                
                # Create Field annotation
                if required:
                    param_def = f"{field_name}: {python_type_str} = Field(..., description={repr(field_description)})"
    else:
                    param_def = f"{field_name}: {python_type_str} | None = Field(default=None, description={repr(field_description)})"
                
                param_definitions.append(param_def)
            
            # Build function code
            params_str = ", ".join(param_definitions)
            
            # Create function body that collects parameters into dict
            # Indent with 4 spaces to match function body indentation
            collect_dict_code = "    template_args_dict = {\n"
            for field_name in param_names:
                collect_dict_code += f"        {repr(field_name)}: {field_name},\n"
            collect_dict_code += "    }\n"
            
            # Remove None values for optional fields
            collect_dict_code += "    # Remove None values for optional fields\n"
            collect_dict_code += "    template_args_dict = {k: v for k, v in template_args_dict.items() if v is not None}\n"
            
            func_code = f"""async def create_document({params_str}) -> str:
    \"\"\"Create a dynamic child document from the available template document.

    This tool renders the available template document with provided template argument values
    and creates a new child document (not a template) that replaces the parent in the scenario.

    You do not need to specify the parent document ID - it will be automatically inferred.
    Provide the template argument values as specified by the template schema.

    Args:
        {chr(10).join(f'        {name}: Template argument value' for name in param_names)}

    Returns:
        Confirmation message
    \"\"\"
{collect_dict_code}
    return await _create_document_impl(template_args_dict)
"""
            
            # Execute in local namespace with access to required imports
            local_namespace = {
                "Field": Field,
                "_create_document_impl": _create_document_impl,
                "str": str,
                "float": float,
                "bool": bool,
                "list": list,
            }
            
            exec(func_code, globals(), local_namespace)
            create_document_func = local_namespace["create_document"]
            
            logger.info(
                f"Created dynamic document function with {len(param_names)} individual parameters"
            )
            return function_tool(create_document_func)  # type: ignore[arg-type]
    
    # Fallback: create function with dict parameter (for backward compatibility)
    async def create_document_fallback(template_args: dict[str, Any]) -> str:
        """Create a dynamic child document from the available template document.

        This tool renders the available template document with provided template argument values
        and creates a new child document (not a template) that replaces the parent in the scenario.

        You do not need to specify the parent document ID - it will be automatically inferred.
        Provide the template argument values as a dictionary matching the template schema.

        Args:
            template_args: Dictionary of template argument values

        Returns:
            Confirmation message
        """
        return await _create_document_impl(template_args)
    
    return function_tool(create_document_fallback)  # type: ignore[arg-type]
