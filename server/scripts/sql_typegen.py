"""Type generator for SQL introspection results.

Generates Pydantic models from SQL metadata for request/response types.
"""

from typing import Any

from scripts.sql_introspect import ColumnMetadata, SQLMetadata


def _to_pydantic_field_type(python_type: str, is_optional: bool = False) -> str:
    """Convert Python type string to Pydantic field type.

    Args:
        python_type: Python type string (e.g., "str", "list[str]")
        is_optional: Whether the field is optional

    Returns:
        Pydantic-compatible type string
    """
    if is_optional:
        return f"{python_type} | None"
    return python_type


def _sanitize_field_name(name: str) -> str:
    """Sanitize field name for Python identifier.

    Args:
        name: Field name (may contain $, -, etc.)

    Returns:
        Valid Python identifier
    """
    # Remove $ prefix for parameters
    if name.startswith("$"):
        return f"param_{name[1:]}"
    # Replace invalid characters
    name = name.replace("-", "_")
    # Ensure it starts with a letter
    if name and not name[0].isalpha():
        name = f"field_{name}"
    return name


def _to_class_name(route_name: str, suffix: str) -> str:
    """Generate class name from route name.

    Args:
        route_name: Route name (e.g., "create_agent")
        suffix: Suffix (e.g., "SqlParams", "SqlRow")

    Returns:
        Class name (e.g., "CreateAgentSqlParams")
    """
    # Convert snake_case to PascalCase
    parts = route_name.split("_")
    pascal = "".join(word.capitalize() for word in parts)
    return f"{pascal}{suffix}"


def generate_request_model(
    metadata: SQLMetadata, route_name: str
) -> str:
    """Generate Pydantic request model from SQL metadata.

    Args:
        metadata: SQL metadata with parameter information
        route_name: Route name for class naming (e.g., "create_agent")

    Returns:
        Python code string for Pydantic model
    """
    class_name = _to_class_name(route_name, "SqlParams")

    lines = [
        '"""SQL parameter model generated from SQL introspection.',
        "",
        f"Generated from: {metadata.sql_path}",
        '"""',
        "",
        "from typing import Any",
        "",
        "from pydantic import BaseModel",
        "",
        "",
        f"class {class_name}(BaseModel):",
        '    """SQL parameters for query execution.',
        "",
        "    Parameters are ordered $1, $2, ...",
        '    """',
        "",
    ]

    # Add fields for each parameter
    for param in metadata.parameters:
        field_name = _sanitize_field_name(param.name)
        field_type = _to_pydantic_field_type(param.python_type)
        # Parameters are typically required unless they can be NULL
        # We'll make them all required for now - can be enhanced later
        lines.append(f"    {field_name}: {field_type}")

    # Add to_tuple() method
    lines.append("")
    lines.append("    def to_tuple(self) -> tuple[Any, ...]:")
    lines.append('        """Convert model to tuple in parameter order ($1, $2, ...)."""')
    lines.append("        return (")
    for param in metadata.parameters:
        field_name = _sanitize_field_name(param.name)
        lines.append(f"            self.{field_name},")
    lines.append("        )")

    return "\n".join(lines)


def generate_response_model(
    metadata: SQLMetadata, route_name: str
) -> str:
    """Generate Pydantic response model from SQL metadata.

    Args:
        metadata: SQL metadata with return column information
        route_name: Route name for class naming (e.g., "create_agent")

    Returns:
        Python code string for Pydantic model
    """
    class_name = _to_class_name(route_name, "SqlRow")

    lines = [
        '"""SQL response row model generated from SQL introspection.',
        "",
        f"Generated from: {metadata.sql_path}",
        '"""',
        "",
        "from typing import Any",
        "",
        "from pydantic import BaseModel",
        "",
        "",
        f"class {class_name}(BaseModel):",
        '    """SQL query result row.',
        "",
        "    Columns returned by the SQL query.",
        '    """',
        "",
    ]

    # Add fields for each return column
    for col in metadata.returns:
        field_name = _sanitize_field_name(col.name)
        field_type = _to_pydantic_field_type(col.python_type)
        # Return columns are typically required (SQL returns them)
        lines.append(f"    {field_name}: {field_type}")

    return "\n".join(lines)


def generate_types_file(
    metadata: SQLMetadata, route_name: str
) -> str:
    """Generate complete types file with request and response models.

    Args:
        metadata: SQL metadata
        route_name: Route name (e.g., "create_agent")

    Returns:
        Complete Python file content
    """
    request_model = generate_request_model(metadata, route_name)
    response_model = generate_response_model(metadata, route_name)

    return f"{request_model}\n\n\n{response_model}\n"

