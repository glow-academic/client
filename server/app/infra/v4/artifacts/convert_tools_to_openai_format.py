"""Convert database tool configs to OpenAI tool format."""

from typing import Any

from app.sql.types import IGetTextRunContextAndCreateRunV4Tool


def convert_tools_to_openai_format(
    tools: list[IGetTextRunContextAndCreateRunV4Tool],
) -> list[dict[str, Any]]:
    """Convert database tool configs to OpenAI tool format.
    
    Args:
        tools: List of tool configs from database
        
    Returns:
        List of OpenAI tool format dictionaries
    """
    openai_tools: list[dict[str, Any]] = []
    
    for tool in tools:
        if not tool.name or not tool.active:
            continue
            
        # Build properties from arguments JSONB
        properties: dict[str, Any] = {}
        required_fields: list[str] = []
        
        arguments = tool.arguments or {}
        argument_descriptions = tool.argument_descriptions or {}
        
        if isinstance(arguments, dict):
            for field_name, field_spec in arguments.items():
                if not isinstance(field_spec, dict):
                    continue
                    
                field_type = field_spec.get("type", "string")
                field_required = bool(field_spec.get("required", False))
                field_description = argument_descriptions.get(field_name, "")
                
                if field_type == "array":
                    items = field_spec.get("items") or {}
                    item_type = items.get("type", "string") if isinstance(items, dict) else "string"
                    properties[field_name] = {
                        "type": "array",
                        "items": {"type": item_type},
                        "description": field_description,
                    }
                elif field_type == "object":
                    properties[field_name] = {
                        "type": "object",
                        "description": field_description,
                    }
                else:
                    # map primitives
                    json_type = field_type if field_type in ("string", "integer", "number", "boolean") else "string"
                    properties[field_name] = {
                        "type": json_type,
                        "description": field_description,
                    }
                
                if field_required:
                    required_fields.append(field_name)
        
        openai_tools.append(
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description or "",
                    "parameters": {
                        "type": "object",
                        "properties": properties,
                        "required": required_fields,
                    },
                },
            }
        )
    
    return openai_tools
