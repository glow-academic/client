"""Create the internal agent that powers document generation from context data."""

from typing import Any

from agents import FunctionToolResult, RunContextWrapper, ToolsToFinalOutputResult

from app.utils.agents.generic_agent import GenericAgent
from app.utils.agents.tools.create_document_tools import document_progress
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


def build_document_agent(
    context: dict[str, Any], document_tools: list[Any]
) -> GenericAgent:
    """Create the internal agent that powers document generation from context data.

    Args:
        context: Dict containing agent, model, and provider data from service layer
        document_tools: List of document tools to use (created by caller)

    Returns:
        GenericAgent configured for document generation
    """

    # Create tool use behavior to wait for both tools to be called
    def tool_use_behavior(
        tool_context: RunContextWrapper[Any],
        tool_results: list[FunctionToolResult],
    ) -> ToolsToFinalOutputResult:
        # Check if both template HTML and schema tools have been called
        template_html_complete = document_progress.get("template_html", False)
        template_schema_complete = document_progress.get("template_schema", False)
        both_complete = template_html_complete and template_schema_complete

        logger.info(
            f"Tool use behavior check: template_html={template_html_complete}, "
            f"template_schema={template_schema_complete}, both_complete={both_complete}"
        )
        return ToolsToFinalOutputResult(is_final_output=both_complete)

    return GenericAgent(
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
