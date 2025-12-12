"""Document template rendering endpoint - v3 API following DHH principles."""

import json
import os
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v3.settings.active import (
    SettingsActiveRequest,
    get_active_settings,
)
from app.main import UPLOAD_FOLDER, get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.jinja_renderer import render_template
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql


class RenderTemplateRequest(BaseModel):
    """Request to render document template."""

    documentId: str
    templateArgs: dict[str, Any]
    profileId: str
    departmentIds: list[str] | None = (
        None  # Optional department IDs for department-specific theme
    )


class RenderTemplateResponse(BaseModel):
    """Response from template rendering."""

    success: bool
    message: str
    rendered_html: str


router = APIRouter()

logger = get_logger(__name__)


@router.post("/render", response_model=RenderTemplateResponse)
async def render_document_template(
    request: RenderTemplateRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RenderTemplateResponse:
    """Render Jinja2 template with template args and theme injection."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Convert string ID to UUID
        document_id = uuid.UUID(request.documentId)
        profile_id = uuid.UUID(request.profileId)

        # Get template upload info and template args
        # SQL uses INNER JOIN so it only returns rows if document exists and has active template
        sql_query = load_sql("sql/v3/documents/render_template_complete.sql")
        sql_params = (str(document_id),)
        template_row = await conn.fetchrow(sql_query, *sql_params)

        if not template_row:
            raise HTTPException(
                status_code=404,
                detail=f"Document {request.documentId} not found or has no active template",
            )

        file_path = template_row.get("file_path")
        if not file_path:
            raise HTTPException(
                status_code=404,
                detail="Template upload file not found",
            )

        # Read template HTML file
        full_path = os.path.join(UPLOAD_FOLDER, file_path)
        if not os.path.exists(full_path):
            raise HTTPException(
                status_code=404,
                detail=f"Template file not found at {file_path}",
            )

        with open(full_path, encoding="utf-8") as f:
            template_html = f.read()

        settings_request = SettingsActiveRequest(profileId=request.profileId)
        # Create a dummy response object for get_active_settings
        dummy_response = Response()
        settings_response = await get_active_settings(
            settings_request, http_request, dummy_response, conn
        )
        theme_tokens = settings_response.tokens

        # Get template schema (dtu.args contains the schema with placeholder/description metadata)
        template_schema_raw = template_row.get("template_args") or {}
        if isinstance(template_schema_raw, str):
            template_schema_raw = json.loads(template_schema_raw)

        # Extract placeholders from schema and build default values structure
        def extract_placeholders(
            schema: dict[str, Any], path: list[str] = []
        ) -> dict[str, Any]:
            """Extract placeholder values from schema to use as defaults.

            Args:
                schema: Schema dict with 'fields' key
                path: Current path in schema (for nested structures)

            Returns:
                Dict with placeholder values matching schema structure
            """
            defaults: dict[str, Any] = {}

            if not isinstance(schema, dict) or "fields" not in schema:
                return defaults

            for field in schema.get("fields", []):
                field_name = field.get("name")
                if not field_name:
                    continue

                current_path = path + [field_name]
                placeholder = field.get("placeholder")
                field_type = field.get("type")

                if field_type == "array" and "item" in field:
                    item_field = field.get("item", {})
                    # For arrays, create empty list - items will be populated dynamically
                    # But we can extract placeholder for array item structure
                    if isinstance(item_field, dict):
                        if (
                            item_field.get("type") == "object"
                            and "fields" in item_field
                        ):
                            # Array of objects - extract placeholders for object structure
                            item_defaults = extract_placeholders(
                                {"fields": item_field.get("fields", [])}, current_path
                            )
                            # Store as a template for array items (will be used when items are added)
                            defaults[f"_{field_name}_item_template"] = item_defaults
                        elif item_field.get("type") == "string" and placeholder:
                            # Array of strings with placeholder
                            defaults[f"_{field_name}_item_template"] = placeholder
                    defaults[field_name] = []
                elif field_type == "object" and "fields" in field:
                    # For objects, recursively extract placeholders
                    nested_defaults = extract_placeholders(
                        {"fields": field.get("fields", [])}, current_path
                    )
                    if nested_defaults:
                        defaults[field_name] = nested_defaults
                    elif placeholder:
                        defaults[field_name] = placeholder
                elif placeholder:
                    # For simple fields, use placeholder as default
                    defaults[field_name] = placeholder

            return defaults

        # Get placeholder defaults from schema
        placeholder_defaults = extract_placeholders(template_schema_raw)

        # Deep merge: placeholder defaults -> request args (request takes precedence)
        # But ensure all placeholder values are always present (even if override is empty)
        def deep_merge_with_defaults(
            base: dict[str, Any], override: dict[str, Any]
        ) -> dict[str, Any]:
            """Deep merge two dictionaries, ensuring base defaults are always present.

            Strategy:
            - Start with base (placeholders) as the foundation
            - Override with request args, but only if they have actual values
            - For arrays: if override has items, use them; otherwise keep base structure
            - For nested objects: recursively merge, ensuring defaults are preserved
            """
            result = base.copy()

            for key, value in override.items():
                if (
                    key in result
                    and isinstance(result[key], dict)
                    and isinstance(value, dict)
                ):
                    # Both are dicts - deep merge recursively
                    result[key] = deep_merge_with_defaults(result[key], value)
                elif isinstance(value, list):
                    if len(value) > 0:
                        # Non-empty array - use override, but ensure items have defaults
                        # For each item in the array, merge with item template defaults if available
                        item_template_key = f"_{key}_item_template"
                        if item_template_key in result:
                            item_template = result[item_template_key]
                            # Merge each item with template defaults
                            merged_items = []
                            for item in value:
                                if isinstance(item, dict) and isinstance(
                                    item_template, dict
                                ):
                                    merged_items.append(
                                        deep_merge_with_defaults(
                                            item_template.copy(), item
                                        )
                                    )
                                else:
                                    merged_items.append(item)
                            result[key] = merged_items
                        else:
                            result[key] = value
                    # If empty array, keep base (which might be empty list or have template)
                elif value is not None and value != "":
                    # Non-empty value - use override
                    result[key] = value
                # If value is None, "", or empty list, keep base (placeholder/default)

            return result

        # Merge placeholders as defaults with request args
        # This ensures placeholders are always present in the context
        merged_args = deep_merge_with_defaults(
            placeholder_defaults, request.templateArgs
        )

        # Recursively clean up item template keys (they're internal, not for templates)
        def remove_template_keys(obj: Any) -> Any:
            """Recursively remove keys that start with '_' and end with '_item_template'."""
            if isinstance(obj, dict):
                cleaned = {}
                for key, value in obj.items():
                    if not (key.startswith("_") and key.endswith("_item_template")):
                        cleaned[key] = remove_template_keys(value)
                return cleaned
            elif isinstance(obj, list):
                return [remove_template_keys(item) for item in obj]
            else:
                return obj

        merged_args = remove_template_keys(merged_args)

        # Validate and sanitize array variables to ensure they are always lists
        def get_array_field_names(
            schema: dict[str, Any], path: list[str] = []
        ) -> set[str]:
            """Extract all array field names from schema.

            Args:
                schema: Schema dict with 'fields' key
                path: Current path in schema (for nested structures)

            Returns:
                Set of field names that should be arrays
            """
            array_fields: set[str] = set()

            if not isinstance(schema, dict) or "fields" not in schema:
                return array_fields

            for field in schema.get("fields", []):
                field_name = field.get("name")
                if not field_name:
                    continue

                field_type = field.get("type")

                if field_type == "array":
                    # Add the full path if nested, or just the name if top-level
                    if path:
                        array_fields.add(".".join(path + [field_name]))
                    else:
                        array_fields.add(field_name)
                elif field_type == "object" and "fields" in field:
                    # Recursively check nested objects
                    nested_path = path + [field_name]
                    nested_arrays = get_array_field_names(
                        {"fields": field.get("fields", [])}, nested_path
                    )
                    array_fields.update(nested_arrays)

            return array_fields

        def validate_and_sanitize_arrays(
            context: dict[str, Any], array_fields: set[str]
        ) -> dict[str, Any]:
            """Ensure all array fields are actually lists.

            Args:
                context: Template context dictionary
                array_fields: Set of field names that should be arrays (from schema only)

            Returns:
                Sanitized context with all array fields guaranteed to be lists
            """
            sanitized = context.copy()

            for field_name in array_fields:
                # Handle nested paths (e.g., "objectives.items", "milestones.deliverables")
                if "." in field_name:
                    parts = field_name.split(".")
                    # Navigate to the nested location
                    current: Any = sanitized
                    path_valid = True
                    for part in parts[:-1]:
                        if not isinstance(current, dict) or part not in current:
                            # Path doesn't exist, skip this field
                            path_valid = False
                            break
                        current = current.get(part)  # Use .get() to avoid type issues

                    # Validate the final nested array field
                    if path_valid and isinstance(current, dict) and len(parts) > 0:
                        final_key = parts[-1]
                        value = current.get(final_key)
                        if callable(value) or (
                            value is not None and not isinstance(value, list)
                        ):
                            current[final_key] = []
                            if value is not None:
                                value_type = type(value).__name__
                                if callable(value):
                                    logger.warning(
                                        f"Nested array field '{field_name}' was callable, converted to empty list"
                                    )
                                else:
                                    logger.warning(
                                        f"Nested array field '{field_name}' had non-list value type {value_type}, "
                                        f"converted to empty list"
                                    )
                else:
                    # Top-level array field
                    value = sanitized.get(field_name)
                    if callable(value) or (
                        value is not None and not isinstance(value, list)
                    ):
                        sanitized[field_name] = []
                        if value is not None:
                            value_type = type(value).__name__
                            if callable(value):
                                logger.warning(
                                    f"Array field '{field_name}' was callable (function/method), "
                                    f"converted to empty list"
                                )
                            else:
                                logger.warning(
                                    f"Array field '{field_name}' had non-list value type {value_type}, "
                                    f"converted to empty list"
                                )

            return sanitized

        # Ensure objects with nested arrays are properly initialized
        # This prevents Jinja2 from accessing Python dict methods (like .items()) instead of keys
        def ensure_nested_arrays(
            obj: Any, schema: dict[str, Any], path: list[str] = []
        ) -> Any:
            """Ensure objects with nested arrays have their arrays initialized.

            This prevents issues where accessing .items on a dict without an 'items' key
            resolves to the .items() method instead of a key.
            """
            if not isinstance(schema, dict) or "fields" not in schema:
                return obj

            if not isinstance(obj, dict):
                return obj

            result = obj.copy()

            for field in schema.get("fields", []):
                field_name = field.get("name")
                if not field_name:
                    continue

                field_type = field.get("type")

                if field_type == "object" and "fields" in field:
                    # This is an object field - check if it has nested arrays
                    nested_fields = field.get("fields", [])

                    # Ensure the object field exists and is a dict
                    if field_name not in result:
                        result[field_name] = {}
                    elif not isinstance(result[field_name], dict):
                        # If it's not a dict, initialize as empty dict
                        result[field_name] = {}

                    # Now process nested arrays - this ensures 'items' key always exists
                    for nested_field in nested_fields:
                        nested_field_name = nested_field.get("name")
                        nested_field_type = nested_field.get("type")

                        if nested_field_type == "array":
                            # This object should have a nested array - ALWAYS ensure it exists
                            # This prevents Jinja2 from accessing dict.items() method
                            if nested_field_name not in result[field_name]:
                                result[field_name][nested_field_name] = []
                            elif not isinstance(
                                result[field_name][nested_field_name], list
                            ):
                                result[field_name][nested_field_name] = []

                            # Recursively ensure nested structure if array items are objects
                            if "item" in nested_field:
                                item_schema = nested_field.get("item", {})
                                if (
                                    item_schema.get("type") == "object"
                                    and "fields" in item_schema
                                ):
                                    # Recursively process nested object arrays
                                    for item in result[field_name][nested_field_name]:
                                        if isinstance(item, dict):
                                            ensure_nested_arrays(
                                                item,
                                                {
                                                    "fields": item_schema.get(
                                                        "fields", []
                                                    )
                                                },
                                                path + [field_name, nested_field_name],
                                            )

                    # Recursively ensure nested objects
                    if field_name in result and isinstance(result[field_name], dict):
                        nested_schema = {"fields": nested_fields}
                        result[field_name] = ensure_nested_arrays(
                            result[field_name], nested_schema, path + [field_name]
                        )

            return result

        # Ensure nested arrays are initialized before validation
        merged_args = ensure_nested_arrays(merged_args, template_schema_raw)

        # Get all array field names from schema - this is the single source of truth
        # Schema detection handles both top-level arrays and nested arrays within objects
        array_field_names = get_array_field_names(template_schema_raw)

        # Validate and sanitize array variables based on schema only (no hardcoded names)
        merged_args = validate_and_sanitize_arrays(merged_args, array_field_names)

        # Render template
        rendered_html = render_template(
            html=template_html,
            context=merged_args,
            theme_tokens=theme_tokens,
        )

        return RenderTemplateResponse(
            success=True,
            message="Template rendered successfully",
            rendered_html=rendered_html,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="render_template",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to render template: {str(e)}",
        )
