"""Shared logic for running document generation agent."""

import json
import uuid
from typing import Any

import asyncpg  # type: ignore
from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    Tool,
    ToolsToFinalOutputResult,
    function_tool,
    trace,
)
from agents.items import TResponseInputItem
from pydantic import Field

from app.utils.agents.generic_agent import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.logging.db_logger import get_logger
from app.utils.messages.log_run_messages import log_run_messages
from app.utils.sql_helper import load_sql
from app.utils.tools.load_agent_tools import load_agent_tools

# Module-level storage for document generation results (moved from create_document_tools)
document_results: dict[str, Any] = {}
document_progress: dict[str, bool] = {}

logger = get_logger(__name__)


async def run_document_agent(
    context: dict[str, Any],
    conn: asyncpg.Connection,
    department_id: uuid.UUID,
    profile_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """Shared logic for running document generation agent.

    For now, returns hardcoded template HTML and schema JSON.
    This can be replaced with actual AI generation later.

    Args:
        context: Context dict from agent service with all required data
        conn: Database connection
        department_id: Department ID
        profile_id: Optional profile ID (uses default guest if not provided)

    Returns:
        Dict with 'template_html' and 'template_schema' keys
    """
    # Clear previous results
    document_results.clear()
    document_progress.clear()

    # For now, return hardcoded values
    # TODO: Replace with actual agent execution when ready
    hardcoded_template_html = """<!DOCTYPE html>
<html>
<head>
    <title>{{ title }}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
        ul { list-style-type: none; padding: 0; }
        li { padding: 8px; margin: 4px 0; background-color: #f5f5f5; }
    </style>
</head>
<body>
    <h1>{{ customer_name }}</h1>
    <p>Total: ${{ total }}</p>
    <ul>
        {% for item in items %}
        <li>{{ item.description }} - ${{ item.price }}</li>
        {% endfor %}
    </ul>
</body>
</html>"""

    hardcoded_template_schema = {
        "name": "InvoiceContext",
        "fields": [
            {"name": "title", "type": "string", "required": True},
            {"name": "customer_name", "type": "string", "required": True},
            {"name": "total", "type": "number", "required": True},
            {
                "name": "items",
                "type": "array",
                "item": {
                    "type": "object",
                    "fields": [
                        {"name": "description", "type": "string", "required": True},
                        {"name": "price", "type": "number", "required": True},
                    ],
                },
            },
        ],
    }

    # Store hardcoded results in document_results (for consistency with future AI version)
    document_results["template_html"] = hardcoded_template_html
    document_results["template_schema"] = json.dumps(hardcoded_template_schema)
    document_progress["template_html"] = True
    document_progress["template_schema"] = True

    logger.info("Document generation completed (hardcoded)")
    logger.info(f"Template HTML length: {len(hardcoded_template_html)} chars")
    logger.info(f"Template schema: {hardcoded_template_schema['name']}")

    return {
        "template_html": hardcoded_template_html,
        "template_schema": hardcoded_template_schema,
    }


async def run_document_agent_with_ai(
    context: dict[str, Any],
    input_items: list[TResponseInputItem],
    conn: asyncpg.Connection,
    department_id: uuid.UUID,
    profile_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """Run document generation agent with actual AI (future implementation).

    This function is prepared for when we want to use actual AI generation.
    For now, use run_document_agent() which returns hardcoded values.

    Args:
        context: Context dict from agent service with all required data
        input_items: Formatted messages for document generation
        conn: Database connection
        department_id: Department ID
        profile_id: Optional profile ID (uses default guest if not provided)

    Returns:
        Dict with 'template_html' and 'template_schema' keys
    """
    # Clear previous results
    document_results.clear()
    document_progress.clear()

    # Load agent tools from database
    agent_id_uuid = uuid.UUID(context["agent_id"])
    agent_tools_config = await load_agent_tools(conn, agent_id_uuid)
    tool_config_map_doc: dict[str, dict[str, Any]] = {
        tool_config["name"]: tool_config for tool_config in agent_tools_config
    }

    # Build document tools inline
    document_tools: list[Tool] = []
    
    # Generate template HTML tool
    html_config = tool_config_map_doc.get("generate_template_html")
    if html_config:
        html_desc = html_config.get("argument_descriptions", {}).get("template_html", "Jinja template HTML content with placeholders like {{ variable_name }}")
    else:
        html_desc = "Jinja template HTML content with placeholders like {{ variable_name }}"
    
    async def generate_template_html(
        template_html: str = Field(description=html_desc),
    ) -> str:
        """Generate the Jinja template HTML for the document."""
        document_results["template_html"] = template_html
        document_progress["template_html"] = True
        logger.info(f"✓ Generated template HTML ({len(template_html)} chars)")
        return "Generated template HTML successfully"
    
    document_tools.append(function_tool(generate_template_html))
    
    # Generate template schema tool
    schema_config = tool_config_map_doc.get("generate_template_schema")
    if schema_config:
        schema_desc = schema_config.get("argument_descriptions", {}).get("schema_json", "JSON string in TemplateSchema format describing the template context fields and types.")
    else:
        schema_desc = "JSON string in TemplateSchema format describing the template context fields and types."
    
    async def generate_template_schema(
        schema_json: str = Field(description=schema_desc),
    ) -> str:
        """Generate the TemplateSchema JSON for template context."""
        document_results["template_schema"] = schema_json
        document_progress["template_schema"] = True
        logger.info(f"✓ Generated template schema ({len(schema_json)} chars)")
        return "Generated template schema successfully"
    
    document_tools.append(function_tool(generate_template_schema))
    
    # Create tool use behavior
    def tool_use_behavior(
        tool_context: RunContextWrapper[Any],
        tool_results: list[FunctionToolResult],
    ) -> ToolsToFinalOutputResult:
        template_html_complete = document_progress.get("template_html", False)
        template_schema_complete = document_progress.get("template_schema", False)
        both_complete = template_html_complete and template_schema_complete
        logger.info(
            f"Tool use behavior check: template_html={template_html_complete}, "
            f"template_schema={template_schema_complete}, both_complete={both_complete}"
        )
        return ToolsToFinalOutputResult(is_final_output=both_complete)
    
    # Build document agent inline
    document_agent = GenericAgent(
        agent_name=context["agent_name"],
        system_prompt=context["system_prompt"],
        temperature=context["temperature"],
        model_name=context["model_name"],
        provider=context["provider"],
        base_url=context["base_url"],
        api_key=context["api_key"],
        reasoning=context["reasoning"],
        tools=document_tools,
        parallel_tool_calls=False,
        tool_use_behavior=tool_use_behavior,
    )

    # Check rate limit (already included in context query)
    final_profile_id = profile_id or uuid.UUID(context["profile_id"])
    if not final_profile_id:
        raise ValueError("Profile not found. Please contact support.")

    req_per_day = context["req_per_day"]
    runs_today_count = context["runs_today_count"]

    if req_per_day is not None and runs_today_count >= req_per_day:
        # Rate limit exceeded - format error message
        from datetime import timedelta
        from zoneinfo import ZoneInfo

        earliest_run_created_at = context["earliest_run_created_at"]
        if earliest_run_created_at:
            next_allowed_utc = earliest_run_created_at + timedelta(days=1)
            eastern_tz = ZoneInfo("America/New_York")
            next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
            error_message = (
                f"Daily request limit of {req_per_day} reached. "
                f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                f"{next_allowed_et.strftime('%B %d, %Y')}."
            )
        else:
            error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
        raise ValueError(error_message)

    # Create model run using SQL file
    sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
    model_run_row = await conn.fetchrow(
        sql_create_run,
        str(department_id),
        context["model_id"],
        context["agent_id"],
        "agent",
        str(final_profile_id),
        None,  # key_id
        str(context["agent_id"]),  # agent_id
    )
    model_run_id = uuid.UUID(model_run_row["run_id"])

    # Log system and developer messages for this run
    await log_run_messages(
        conn=conn,
        run_id=model_run_id,
        system_prompt=context["system_prompt"],
        input_items=input_items,
        department_id=department_id,
    )

    # Run document generation with tracing
    with trace(
        "Document Agent",
        trace_id=None,
        group_id=None,
    ):
        result = await Runner.run(
            document_agent.agent(),
            input_items,
            context=DebugContext(conn=conn, run_id=model_run_id),
        )

    # Log assistant message (model output)
    assistant_output = getattr(result, "final_output", None) or ""
    if assistant_output:
        await log_run_messages(
            conn=conn,
            run_id=model_run_id,
            system_prompt=None,  # Already logged
            assistant_output=assistant_output,
            department_id=department_id,
        )

    # Update token counts using SQL file
    usage = result.context_wrapper.usage
    sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
    await conn.execute(
        sql_update_tokens,
        str(model_run_id),
        usage.input_tokens,
        usage.output_tokens,
    )

    # Extract results
    template_html = document_results.get("template_html", "")
    template_schema_str = document_results.get("template_schema", "{}")

    # Parse schema JSON
    try:
        template_schema = json.loads(template_schema_str)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Failed to parse template_schema JSON, using empty dict")
        template_schema = {}

    logger.info(
        f"Document generation completed: template_html={len(template_html)} chars"
    )
    logger.info(f"Template schema: {template_schema.get('name', 'Unknown')}")

    return {
        "template_html": template_html,
        "template_schema": template_schema,
    }
