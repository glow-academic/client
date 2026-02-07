"""Render tool templates using Jinja2 to map tool arguments to schema output fields."""

import uuid
from typing import Any, cast

import asyncpg
from jinja2 import Environment, TemplateError, TemplateSyntaxError
from jinja2.environment import Template as JinjaTemplate

from app.sql.types import (
    GetResourceOutputSchemaFieldsSqlParams,
    GetResourceOutputSchemaFieldsSqlRow,
    InfraToolsGetToolCallResultV4SqlParams,
    InfraToolsGetToolCallResultV4SqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# Use the output schema fields directly - this queries args_outputs_resource via tool_args_outputs_junction
GET_OUTPUT_SCHEMA_FIELDS_SQL_PATH = "app/sql/v4/queries/infra/artifacts/discovery/get_resource_output_schema_fields_complete.sql"
GET_TOOL_CALL_RESULT_SQL_PATH = (
    "app/sql/v4/queries/infrastructure/tools/get_tool_call_result_v4_complete.sql"
)


def validate_jinja_template(template_expr: str) -> tuple[bool, str | None]:
    """Validate Jinja template syntax.

    Args:
        template_expr: Jinja template expression string

    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if template is valid, False otherwise
        - error_message: Error message if invalid, None if valid
    """
    if not template_expr or template_expr.strip() == "":
        # Empty templates are valid (no transformation)
        return True, None

    try:
        env = Environment(
            autoescape=True,
            trim_blocks=True,
            lstrip_blocks=True,
        )
        env.parse(template_expr)
        return True, None
    except TemplateSyntaxError as e:
        return False, f"Template syntax error: {str(e)}"
    except Exception as e:
        return False, f"Template validation error: {str(e)}"


async def render_tool_template(
    conn: asyncpg.Connection,
    tool_id: uuid.UUID,
    tool_arguments: dict[str, Any],
) -> dict[str, Any]:
    """Render Jinja templates for a tool's output schema fields using tool arguments.

    Gets the tool's output schema fields (from args_outputs_resource via
    tool_args_outputs_junction), and renders each template using Jinja2
    with tool_arguments as context.

    Args:
        conn: Database connection
        tool_id: UUID of the tool
        tool_arguments: Dictionary of tool call arguments (context for Jinja rendering)

    Returns:
        Dictionary of rendered values keyed by schema field name.
        Empty dictionary if tool has no output schema fields.

    Raises:
        TemplateError: If template rendering fails (logged but not raised)
    """
    # Get output schema fields directly from args_outputs_resource
    # This queries tool_args_outputs_junction → args_outputs_resource
    output_params = GetResourceOutputSchemaFieldsSqlParams(tool_id=tool_id)
    output_fields_rows = cast(
        list[GetResourceOutputSchemaFieldsSqlRow],
        await execute_sql_typed(
            conn,
            GET_OUTPUT_SCHEMA_FIELDS_SQL_PATH,
            params=output_params,
            multi_row=True,
        ),
    )

    if not output_fields_rows:
        logger.warning(
            f"Tool {tool_id} has no output schema fields, skipping template rendering"
        )
        return {}

    schema_fields = [
        {
            "name": row.name,
            "field_type": row.field_type or "string",
            "template": row.template,
        }
        for row in output_fields_rows
        if row.name  # Skip rows without a name
    ]

    # Create Jinja2 environment with autoescape enabled for security
    env = Environment(
        autoescape=True,
        trim_blocks=True,
        lstrip_blocks=True,
    )

    # Render each template
    rendered_values: dict[str, Any] = {}

    for field in schema_fields:
        field_name = field["name"]
        field_type = field["field_type"]
        template_expr = field["template"]

        # Skip empty templates (no transformation needed)
        if not template_expr or template_expr.strip() == "":
            continue

        try:
            # Render Jinja template using tool_arguments as context
            template: JinjaTemplate = env.from_string(template_expr)
            rendered_value = template.render(**tool_arguments)

            # Convert to appropriate type based on field_type
            if field_type == "number":
                try:
                    rendered_values[field_name] = float(rendered_value)
                except (ValueError, TypeError):
                    logger.warning(
                        f"Could not convert rendered value '{rendered_value}' to number for field '{field_name}', keeping as string"
                    )
                    rendered_values[field_name] = rendered_value
            elif field_type == "boolean":
                # Convert string "true"/"false" or boolean values
                if isinstance(rendered_value, bool):
                    rendered_values[field_name] = rendered_value
                elif isinstance(rendered_value, str):
                    rendered_values[field_name] = rendered_value.lower() in (
                        "true",
                        "1",
                        "yes",
                    )
                else:
                    rendered_values[field_name] = bool(rendered_value)
            else:
                # String type (default)
                rendered_values[field_name] = str(rendered_value)

            logger.debug(
                f"Rendered template for field '{field_name}': '{template_expr}' -> '{rendered_value}'"
            )

        except TemplateError as e:
            logger.error(
                f"Jinja template error for field '{field_name}' with template '{template_expr}': {str(e)}"
            )
            # Continue with other fields even if one fails
            continue
        except Exception as e:
            logger.error(
                f"Unexpected error rendering template for field '{field_name}': {str(e)}"
            )
            # Continue with other fields even if one fails
            continue

    logger.info(f"Rendered {len(rendered_values)} fields for tool {tool_id}")

    return rendered_values


async def get_rendered_template_values(
    conn: asyncpg.Connection,
    tool_call_id: uuid.UUID,
) -> dict[str, Any] | None:
    """Get rendered template values from tool_call_results for a tool call.

    This is useful for on-demand retrieval of rendered template values
    that were stored during tool call completion.

    Args:
        conn: Database connection
        tool_call_id: UUID of the tool call

    Returns:
        Dictionary of rendered values if found, None otherwise
    """
    result_params = InfraToolsGetToolCallResultV4SqlParams(tool_call_id=tool_call_id)
    result_result = cast(
        InfraToolsGetToolCallResultV4SqlRow,
        await execute_sql_typed(
            conn, GET_TOOL_CALL_RESULT_SQL_PATH, params=result_params
        ),
    )
    result_record = {
        "result_json": result_result.result_json if result_result else None
    }

    if result_record and result_record["result_json"]:
        result_json = result_record["result_json"]
        if isinstance(result_json, dict):
            return dict(result_json)  # type: ignore[return-value]
        elif isinstance(result_json, str):
            import json

            parsed = json.loads(result_json)
            if isinstance(parsed, dict):
                return parsed  # type: ignore[return-value]

    return None
