"""Build Pydantic models dynamically from template schemas."""

import uuid
from typing import Any

import asyncpg
from pydantic import BaseModel, ConfigDict, Field, create_model

from app.utils.schema_helper import get_schema_tree
from utils.logging.db_logger import get_logger

logger = get_logger(__name__)


def build_template_model(schema: dict[str, Any]) -> type[BaseModel]:
    """Build a Pydantic model from a template schema.

    Args:
        schema: Template schema dict with 'name' and 'fields' keys

    Returns:
        A dynamically created Pydantic model class with strict schema (no additionalProperties)
    """
    fields_data = schema.get("fields", [])
    if not fields_data:
        # If no fields, return a simple model with no fields and strict config
        model = create_model(
            "TemplateArgs",
            __base__=BaseModel,
            __config__=ConfigDict(extra="forbid"),  # Disallow extra fields
        )
        return model  # type: ignore[return-value]

    # Build field definitions for the model
    field_definitions: dict[str, Any] = {}

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
            field_description = (
                f"{description} (Example: {placeholder})"
                if description
                else f"Example: {placeholder}"
            )

        # Map field types to Python types
        python_type: Any
        if field_type == "string":
            python_type = str
        elif field_type == "array":
            # Arrays always have an 'item' definition in the schema
            item_def = field.get("item", {})
            if not item_def:
                # Fallback: if no item definition, use list[str] (shouldn't happen in practice)
                logger.warning(
                    f"Array field '{field_name}' has no item definition, defaulting to list[str]"
                )
                python_type = list[str]
            elif item_def.get("type") == "object":
                # Array of objects - always build a proper Pydantic model
                item_fields = item_def.get("fields", [])
                if item_fields:
                    # Build nested model for array items
                    item_schema = {
                        "name": f"{field_name}_item",
                        "fields": item_fields,
                    }
                    item_model = build_template_model(item_schema)
                    # Runtime-created models can't be statically typed, but will generate strict schemas
                    # Assign as Any to avoid type checker issues with dynamic types
                    python_type = list[item_model]  # type: ignore[assignment, misc]
                else:
                    # Empty object - create empty model (shouldn't happen in practice)
                    empty_item_model = create_model(
                        f"{field_name}_item",
                        __base__=BaseModel,
                        __config__=ConfigDict(extra="forbid"),
                    )
                    # Runtime-created models can't be statically typed, but will generate strict schemas
                    python_type = list[empty_item_model]  # type: ignore[assignment, misc]
            else:
                # Array of primitives - item.type should be "string", "number", etc.
                item_type = item_def.get("type", "string")
                if item_type == "string":
                    python_type = list[str]
                elif item_type == "number":
                    python_type = list[float]
                elif item_type == "boolean":
                    python_type = list[bool]
                else:
                    # Default to string for unknown primitive types
                    python_type = list[str]
        elif field_type == "object":
            # Objects always have a 'fields' array in the schema
            nested_fields = field.get("fields", [])
            if nested_fields:
                # Recursively build nested model
                nested_schema = {
                    "name": f"{field_name}_nested",
                    "fields": nested_fields,
                }
                nested_model = build_template_model(nested_schema)
                # Store as Any to avoid type checker issues, but it's actually Type[BaseModel]
                python_type = nested_model  # type: ignore[assignment, misc]
            else:
                # Empty object - create empty model (shouldn't happen in practice)
                logger.warning(
                    f"Object field '{field_name}' has no fields definition, creating empty model"
                )
                empty_model = create_model(
                    f"{field_name}_empty",
                    __base__=BaseModel,
                    __config__=ConfigDict(extra="forbid"),
                )
                python_type = empty_model  # type: ignore[assignment, misc]
        else:
            # Default to str for unknown types (safer than Any)
            python_type = str

        # Create Field with description and required flag
        if required:
            field_definitions[field_name] = (
                python_type,
                Field(..., description=field_description),
            )
        else:
            field_definitions[field_name] = (
                python_type | None,
                Field(default=None, description=field_description),
            )

    # Create the model dynamically with strict config to prevent additionalProperties
    model_name = schema.get("name", "TemplateArgs").replace(" ", "").replace(":", "")
    model = create_model(
        f"{model_name}Args",
        __base__=BaseModel,
        __config__=ConfigDict(
            extra="forbid"
        ),  # Disallow extra fields - critical for strict schemas
        **field_definitions,
    )

    return model  # type: ignore[return-value]


async def build_template_model_from_schema_id(
    conn: asyncpg.Connection, schema_id: uuid.UUID
) -> type[BaseModel]:
    """Build a Pydantic model from a schema_id.

    Args:
        conn: Database connection
        schema_id: UUID of the schema

    Returns:
        A dynamically created Pydantic model class with strict schema (no additionalProperties)
    """
    schema = await get_schema_tree(conn, schema_id)
    return build_template_model(schema)
