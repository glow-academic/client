"""Create all document generation function tools."""

from typing import Any

from agents import Tool, function_tool
from pydantic import Field

from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

# Module-level storage for document generation results (similar to scenario_results)
document_results: dict[str, Any] = {}
document_progress: dict[str, bool] = {}


def create_generate_template_html_function() -> Tool:
    """Create a function tool for generating Jinja template HTML."""

    async def generate_template_html(
        template_html: str = Field(
            description="Jinja template HTML content with placeholders like {{ variable_name }}"
        ),
    ) -> str:
        """Generate the Jinja template HTML for the document.

        The template should use Jinja2 syntax with:
        - Variables: {{ variable_name }}
        - Loops: {% for item in items %} ... {% endfor %}
        - Conditionals: {% if condition %} ... {% endif %}

        Args:
            template_html: Complete Jinja template HTML content

        Returns:
            Confirmation message
        """
        document_results["template_html"] = template_html
        document_progress["template_html"] = True

        logger.info(f"✓ Generated template HTML ({len(template_html)} chars)")
        return "Generated template HTML successfully"

    return function_tool(generate_template_html)


def create_generate_template_schema_function() -> Tool:
    """Create a function tool for generating template schema JSON."""

    async def generate_template_schema(
        schema_json: str = Field(
            description="JSON schema string describing the template context fields and types"
        ),
    ) -> str:
        """Generate the JSON schema for template context.

        The schema should describe all fields needed for the template, including:
        - Field names and types (string, number, boolean, date, array, object)
        - Required fields
        - Nested structures for arrays and objects

        Args:
            schema_json: JSON schema string describing template context

        Returns:
            Confirmation message
        """
        document_results["template_schema"] = schema_json
        document_progress["template_schema"] = True

        logger.info(f"✓ Generated template schema ({len(schema_json)} chars)")
        return "Generated template schema successfully"

    return function_tool(generate_template_schema)


def create_document_tools() -> list[Any]:
    """Create all tools needed for document generation."""
    tools = []

    # Add template HTML generation tool
    tools.append(create_generate_template_html_function())
    logger.info("Created template HTML generation tool")

    # Add template schema generation tool
    tools.append(create_generate_template_schema_function())
    logger.info("Created template schema generation tool")

    logger.info(f"Created {len(tools)} document tools")
    return tools

