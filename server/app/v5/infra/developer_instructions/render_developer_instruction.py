"""Render developer instruction templates with resource-schema-based context."""

import uuid
from typing import Any, cast

import asyncpg
from jinja2 import Environment, TemplateError
from jinja2.environment import Template as JinjaTemplate

from app.v5.sql.types import (
    InfrastructureDeveloperInstructionsGetDomainArtifactSqlParams,
    InfrastructureDeveloperInstructionsGetDomainArtifactSqlRow,
)
from app.v5.utils.logging.db_logger import get_logger
from app.v5.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

SQL_PATH = "app/v5/sql/queries/infrastructure/developer_instructions/get_domain_artifact_complete.sql"


async def render_developer_instruction(
    conn: asyncpg.Connection,
    agent_id: uuid.UUID,
    scenario_id: uuid.UUID | None = None,
) -> str | None:
    """Render developer instruction template with resource-schema-based context.

    Fetches the developer instruction template for the agent and renders it
    with context containing whitelisted fields from resources (parameters,
    fields, documents, times) based on resource_schemas definitions.

    Args:
        conn: Database connection
        agent_id: UUID of the agent
        scenario_id: Optional UUID of the scenario (for scenario-specific context)

    Returns:
        Rendered developer instruction string, or None if no template found

    Raises:
        TemplateError: If template rendering fails (logged but not raised)
    """
    try:
        # Step 1: Get developer instruction template
        # Get agent's artifact from domains to query the right developer instruction
        from app.v5.sql.types import GetDeveloperInstructionSqlParams

        # Get agent's artifact from domains
        params = InfrastructureDeveloperInstructionsGetDomainArtifactSqlParams(
            agent_id=agent_id
        )
        result = cast(
            InfrastructureDeveloperInstructionsGetDomainArtifactSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        agent_artifact = result.artifact if result else None

        if not agent_artifact:
            logger.warning(
                f"Agent {agent_id} has no artifact/domain, skipping developer instruction"
            )
            return None

        # Get developer instruction template
        dev_instruction_params = GetDeveloperInstructionSqlParams(
            instruction_type="",  # Not used, kept for compatibility
            agent_role_val=agent_artifact,
        )

        # Note: get_developer_instruction_complete.sql expects instruction_type and agent_role_val
        # But it actually uses agent_role_val to match domains.artifact
        dev_instruction_result = await execute_sql_typed(
            conn,
            "app/v5/sql/queries/developer_instructions/get_developer_instruction_complete.sql",
            params=dev_instruction_params,
        )

        if not dev_instruction_result or not dev_instruction_result.template:
            logger.debug(
                f"No developer instruction template found for agent {agent_id}"
            )
            return None

        template_str = dev_instruction_result.template

        # Step 2: Get context with whitelisted fields
        from app.v5.sql.types import GetDeveloperInstructionContextSqlParams

        context_params = GetDeveloperInstructionContextSqlParams(
            agent_id=agent_id,
            scenario_id=scenario_id,
        )

        context_result = await execute_sql_typed(
            conn,
            "app/v5/sql/queries/developer_instructions/get_developer_instruction_context_complete.sql",
            params=context_params,
        )

        if not context_result:
            logger.warning(
                f"Could not get context for agent {agent_id}, scenario {scenario_id}"
            )
            # Still try to render template without context
            context_data: dict[str, Any] = {
                "parameters": [],
                "fields": [],
                "documents": [],
                "times": [],
            }
        else:
            # asyncpg automatically converts JSONB to Python dict/list
            # But we need to handle the case where it might be a string or already converted
            import json

            def safe_jsonb_to_list(value: Any) -> list[Any]:
                """Safely convert JSONB to list."""
                if value is None:
                    return []
                if isinstance(value, list):
                    return value
                if isinstance(value, str):
                    try:
                        parsed = json.loads(value)
                        return parsed if isinstance(parsed, list) else []
                    except (json.JSONDecodeError, TypeError):
                        return []
                if isinstance(value, dict):
                    # If it's a dict, wrap in list (shouldn't happen but be safe)
                    return [value]
                return []

            context_data = {
                "parameters": safe_jsonb_to_list(context_result.parameters),
                "fields": safe_jsonb_to_list(context_result.fields),
                "documents": safe_jsonb_to_list(context_result.documents),
                "times": safe_jsonb_to_list(context_result.times),
            }

        # Step 3: Render Jinja template
        env = Environment(
            autoescape=True,
            trim_blocks=True,
            lstrip_blocks=True,
        )

        template: JinjaTemplate = env.from_string(template_str)
        rendered_content = template.render(**context_data)

        if not rendered_content or not rendered_content.strip():
            logger.debug(
                f"Rendered developer instruction is empty for agent {agent_id}"
            )
            return None

        logger.info(
            f"Successfully rendered developer instruction for agent {agent_id} "
            f"({len(rendered_content)} chars)"
        )

        return rendered_content.strip()

    except TemplateError as e:
        logger.error(
            f"Jinja template error rendering developer instruction for agent {agent_id}: {str(e)}"
        )
        # Don't raise - return None to allow flow to continue
        return None
    except Exception as e:
        logger.error(
            f"Unexpected error rendering developer instruction for agent {agent_id}: {str(e)}"
        )
        # Don't raise - return None to allow flow to continue
        return None
