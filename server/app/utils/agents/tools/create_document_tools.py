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
            description="JSON string in TemplateSchema format describing the template context fields and types. Must have structure: { 'name': string, 'fields': [{ 'name': string, 'type': 'string'|'number'|'boolean'|'array'|'object', 'required': bool (optional), 'item': {...} (optional for arrays), 'fields': [...] (optional for objects) }] }"
        ),
    ) -> str:
        """Generate the TemplateSchema JSON for template context.

        The schema must follow the TemplateSchema format (NOT standard JSON Schema):
        - Top-level object with "name" (string) and "fields" (array)
        - Each field in "fields" must have "name" (string) and "type" (one of: string, number, boolean, array, object)
        - Optional "required" boolean field
        - For array types: include "item" field describing the array element structure
        - For object types: include "fields" array describing nested object structure

        Args:
            schema_json: JSON string in TemplateSchema format describing template context

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
