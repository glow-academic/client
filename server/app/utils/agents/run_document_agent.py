"""Shared logic for running document generation agent."""

import json
import uuid
from typing import Any

import asyncpg  # type: ignore
from agents import Runner, trace
from agents.items import TResponseInputItem

from app.utils.agents.build_document_agent import build_document_agent
from app.utils.agents.tools.create_document_tools import (
    create_document_tools,
    document_progress,
    document_results,
)
from app.utils.debug_info import DebugContext
from app.utils.logging.db_logger import get_logger
from app.utils.messages.log_run_messages import log_run_messages
from app.utils.sql_helper import load_sql

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

    # Build document agent from context
    document_tools = create_document_tools()
    document_agent = build_document_agent(context, document_tools)

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
