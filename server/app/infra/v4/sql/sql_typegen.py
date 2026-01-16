"""Type generator for SQL introspection results.

Generates Pydantic models from SQL metadata for request/response types.
"""

import re
from typing import Any

from app.infra.v4.sql.sql_introspect import ColumnMetadata, SQLMetadata
from app.utils.sql_nest import nest


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


def _parse_sql_default_value(sql_default: str, field_type: str) -> str:
    """Parse SQL default value expression and convert to Python expression.

    Args:
        sql_default: SQL default expression (e.g., "NULL::uuid", "ARRAY[]::uuid[]")
        field_type: Python field type (e.g., "str | None", "list[UUID]")

    Returns:
        Python expression for default value (e.g., "None", "Field(default_factory=list)")
    """
    sql_default = sql_default.strip()

    # Handle NULL::type patterns
    if sql_default.upper().startswith("NULL::"):
        return "None"

    # Handle ARRAY[]::type[] patterns
    if sql_default.upper().startswith("ARRAY[]::"):
        if "list" in field_type:
            return "Field(default_factory=list)"  # type: ignore[arg-type]
        else:
            return "None"

    # Handle empty string defaults
    if sql_default == "{}":
        if "list" in field_type:
            return "Field(default_factory=list)"  # type: ignore[arg-type]
        elif "dict" in field_type:
            return "Field(default_factory=dict)"  # type: ignore[arg-type]
        else:
            return "None"

    # Handle None/null strings
    if sql_default.lower() in ("none", "null"):
        return "None"

    # For other literals, try to use as-is (but this might fail for complex expressions)
    # In that case, fall back to None
    try:
        # Try to evaluate simple literals
        if sql_default.startswith("'") and sql_default.endswith("'"):
            # String literal
            return sql_default
        elif sql_default.replace(".", "").replace("-", "").isdigit():
            # Numeric literal
            return sql_default
        elif sql_default.lower() in ("true", "false"):
            # Boolean literal
            return sql_default.capitalize()
        else:
            # Unknown expression - default to None for safety
            return "None"
    except Exception:
        return "None"


def _sanitize_field_name(name: str) -> str:
    """Sanitize field name for Python identifier.

    Args:
        name: Field name (may contain $, -, etc.)

    Returns:
        Valid Python identifier
    """
    if not name:
        return "field_unknown"
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


def _composite_type_to_class_name(composite_type: str) -> str:
    """Convert PostgreSQL composite type name to Python class name.

    Examples:
        types.q_list_agents_v3_agent -> QListAgentsV3Agent
        types.q_get_agent_detail_v3_model -> QGetAgentDetailV3Model

    Args:
        composite_type: Full composite type name (e.g., "types.q_list_agents_v3_agent")

    Returns:
        Python class name (e.g., "QListAgentsV3Agent")
    """
    # Remove schema prefix if present
    if "." in composite_type:
        _, type_name = composite_type.split(".", 1)
    else:
        type_name = composite_type

    # Split by underscores and capitalize each part
    parts = re.split(r"[_\W]+", type_name)
    return "".join(p[:1].upper() + p[1:] for p in parts if p)


async def generate_composite_model(
    conn: Any, full_type_name: str, generated_types: dict[str, str]
) -> tuple[str, str]:
    """Generate Pydantic model for a PostgreSQL composite type.

    Args:
        conn: Database connection (asyncpg.Connection)
        full_type_name: Full type name (e.g., "types.q_list_agents_v3_agent")
        generated_types: Dict mapping type names to class names (for recursion)

    Returns:
        Tuple of (class_name, model_code)
    """
    from app.infra.v4.sql.sql_introspect import fetch_composite_fields

    # Fetch composite type fields
    fields = await fetch_composite_fields(conn, full_type_name)

    class_name = _composite_type_to_class_name(full_type_name)
    generated_types[full_type_name] = class_name

    # First pass: detect nested composite types and generate them recursively
    nested_composite_types: set[str] = set()
    for field_name, pg_type, not_null in fields:
        python_type = _pg_type_to_python_type(pg_type, generated_types)
        # Check for Composite(...) markers indicating nested composite types
        composite_match = re.match(r"Composite\((.+)\)", python_type)
        if composite_match:
            nested_type_name = composite_match.group(1)
            nested_composite_types.add(nested_type_name)
        # Also check for Composite(...) inside list[...]
        array_match = re.match(r"list\[Composite\((.+)\)\]", python_type)
        if array_match:
            nested_type_name = array_match.group(1)
            nested_composite_types.add(nested_type_name)

    # Generate nested composite types first (recursively)
    nested_model_code = []
    for nested_type in sorted(nested_composite_types):
        if nested_type not in generated_types:
            try:
                nested_class_name, nested_code = await generate_composite_model(
                    conn, nested_type, generated_types
                )
                nested_model_code.append(nested_code)
            except Exception as e:
                # Log but continue - will use Any as fallback
                import sys

                print(
                    f"Warning: Failed to generate nested composite model for {nested_type}: {e}",
                    file=sys.stderr,
                )

    # Check what imports we need
    needs_uuid = False
    needs_datetime = False

    lines = [
        '"""Composite type model generated from PostgreSQL.',
        "",
        f"Generated from: {full_type_name}",
        '"""',
        "",
        "from typing import Any",
    ]

    # Generate field types and check imports
    field_defs = []
    for field_name, pg_type, not_null in fields:
        python_type = _pg_type_to_python_type(pg_type, generated_types)

        # Resolve Composite(...) placeholders to actual class names
        composite_match = re.match(r"Composite\((.+)\)", python_type)
        if composite_match:
            nested_type_name = composite_match.group(1)
            if nested_type_name in generated_types:
                python_type = generated_types[nested_type_name]
            else:
                python_type = "Any"  # Fallback if generation failed

        # Resolve Composite(...) inside list[...]
        array_match = re.match(r"list\[Composite\((.+)\)\]", python_type)
        if array_match:
            nested_type_name = array_match.group(1)
            if nested_type_name in generated_types:
                python_type = f"list[{generated_types[nested_type_name]}]"
            else:
                python_type = "list[Any]"  # Fallback if generation failed

        if "UUID" in python_type:
            needs_uuid = True
        if "datetime" in python_type:
            needs_datetime = True

        if not not_null:
            python_type = f"{python_type} | None"

        field_defs.append((field_name, python_type))

    if needs_uuid:
        lines.append("from uuid import UUID")
    if needs_datetime:
        lines.append("from datetime import datetime")

    lines.append("")
    lines.append("from pydantic import BaseModel")
    lines.append("")

    # Add nested composite type models first
    if nested_model_code:
        lines.append("")
        lines.append("\n\n".join(nested_model_code))
        lines.append("")

    lines.append("")
    lines.append(f"class {class_name}(BaseModel):")
    lines.append('    """Composite type from PostgreSQL.')
    lines.append("")
    lines.append(f"    Generated from: {full_type_name}")
    lines.append('    """')
    lines.append("")

    if not field_defs:
        lines.append("    pass")
    else:
        for field_name, field_type in field_defs:
            lines.append(f"    {field_name}: {field_type}")

    return class_name, "\n".join(lines)


def _pg_type_to_python_type(pg_type: str, generated_types: dict[str, str]) -> str:
    """Convert PostgreSQL type string to Python type string.

    Handles arrays and composite types recursively.

    Args:
        pg_type: PostgreSQL type (e.g., "uuid", "text[]", "types.q_list_agents_v3_agent[]")
        generated_types: Dict mapping composite type names to class names

    Returns:
        Python type string (e.g., "UUID", "list[str]", "list[QListAgentsV3Agent]")
    """
    # Check for array: type[]
    array_match = re.match(r"^(.+)\[\]$", pg_type.strip())
    if array_match:
        base_type = array_match.group(1).strip()
        base_python = _pg_type_to_python_type(base_type, generated_types)
        return f"list[{base_python}]"

    # Check for composite type (schema.type format)
    if "." in pg_type and pg_type not in ("timestamp with time zone",):
        # Check if we've generated this type
        if pg_type in generated_types:
            return generated_types[pg_type]
        # Return placeholder - will be resolved during generation
        return f"Composite({pg_type})"

    # Map base PostgreSQL types
    pg_type_lower = pg_type.lower()
    type_map = {
        "uuid": "UUID",
        "text": "str",
        "varchar": "str",
        "char": "str",
        "boolean": "bool",
        "bool": "bool",
        "timestamptz": "str",  # ISO string
        "timestamp with time zone": "str",
        "timestamp": "str",
        "date": "str",
        "time": "str",
        "integer": "int",
        "int4": "int",
        "int8": "int",
        "bigint": "int",
        "smallint": "int",
        "float4": "float",
        "float8": "float",
        "real": "float",
        "double precision": "float",
        "numeric": "float",
        "json": "Any",  # JSON can be dict or list
        "jsonb": "Any",  # JSONB can be dict or list
    }

    return type_map.get(pg_type_lower, "Any")


async def generate_request_model(
    metadata: SQLMetadata, route_name: str, conn: Any | None = None
) -> tuple[str, dict[str, str]]:
    """Generate Pydantic request model from SQL metadata.

    Also handles composite types by generating models for them.

    Args:
        metadata: SQL metadata with parameter information
        route_name: Route name for class naming (e.g., "create_agent")
        conn: Database connection (optional, needed for composite type introspection)

    Returns:
        Tuple of (Python code string for Pydantic model, generated_composite_models dict)
    """

    class_name = _to_class_name(route_name, "SqlParams")

    # Detect composite types in parameters
    composite_types: set[str] = set()
    generated_composite_models: dict[str, str] = {}  # type_name -> class_name

    if conn:
        for param in metadata.parameters:
            # Check if parameter type is a composite type or composite array
            python_type = param.python_type

            # Check for Composite(...) marker
            composite_match = re.match(r"Composite\((.+)\)", python_type)
            if composite_match:
                type_name = composite_match.group(1)
                composite_types.add(type_name)

            # Check for CompositeArray(...) marker
            array_match = re.match(r"CompositeArray\((.+)\)", python_type)
            if array_match:
                # The group contains the full type name (e.g., "types.i_create_parameter_v3_field_connection")
                type_name = array_match.group(1)
                composite_types.add(type_name)

    # Generate composite type models
    composite_model_code = []
    for comp_type in sorted(composite_types):
        try:
            if not conn:
                raise ValueError(
                    f"Database connection is None - cannot generate composite model for {comp_type}"
                )
            comp_class_name, comp_code = await generate_composite_model(
                conn, comp_type, generated_composite_models
            )
            generated_composite_models[comp_type] = comp_class_name
            composite_model_code.append(comp_code)
        except Exception as e:
            # Log the error for debugging
            import sys

            print(
                f"Warning: Failed to generate composite model for {comp_type}: {e}",
                file=sys.stderr,
            )
            # If we can't generate composite model, skip it
            # The type will be marked as Any
            pass

    # Check if we need UUID import
    needs_uuid = any("UUID" in param.python_type for param in metadata.parameters)

    # Check if we need Field import (for defaults)
    needs_field = any(param.default_value is not None for param in metadata.parameters)

    lines = [
        '"""SQL parameter model generated from SQL introspection.',
        "",
        f"Generated from: {metadata.sql_path}",
        '"""',
        "",
        "from typing import Any",
    ]

    if needs_uuid:
        lines.append("from uuid import UUID")

    lines.append("")
    lines.append("from pydantic import BaseModel")

    if needs_field:
        lines.append("from pydantic import Field")

    lines.append("")

    # Add composite type models first
    if composite_model_code:
        lines.append("")
        lines.append("\n\n".join(composite_model_code))
        lines.append("")

    lines.append("")
    lines.append(f"class {class_name}(BaseModel):")
    lines.append('    """SQL parameters for query execution.')
    lines.append("")
    lines.append("    Parameters are ordered $1, $2, ...")
    lines.append('    """')
    lines.append("")

    # Add fields for each parameter
    if not metadata.parameters:
        # No parameters - add pass statement
        lines.append("    pass")
    else:
        for param in metadata.parameters:
            field_name = _sanitize_field_name(param.name)
            field_type = param.python_type

            # Resolve composite types
            composite_match = re.match(r"Composite\((.+)\)", field_type)
            if composite_match:
                type_name = composite_match.group(1)
                if type_name in generated_composite_models:
                    field_type = generated_composite_models[type_name]
                else:
                    field_type = "Any"  # Fallback if not generated

            # Resolve composite arrays
            array_match = re.match(r"CompositeArray\((.+)\)", field_type)
            if array_match:
                type_name = array_match.group(1)
                if type_name in generated_composite_models:
                    field_type = f"list[{generated_composite_models[type_name]}]"
                else:
                    field_type = "list[Any]"  # Fallback if not generated

            field_type = _to_pydantic_field_type(field_type, param.is_optional)

            # Handle defaults
            if param.default_value is not None:
                # Parse SQL default value to Python expression
                default_expr = _parse_sql_default_value(param.default_value, field_type)
                # Add type ignore comment for Field(default_factory=list) if needed
                if (
                    "Field(default_factory=list)" in default_expr
                    or "Field(default_factory=dict)" in default_expr
                ):
                    lines.append(
                        f"    {field_name}: {field_type} = {default_expr}  # type: ignore[arg-type]"
                    )
                else:
                    lines.append(f"    {field_name}: {field_type} = {default_expr}")
            elif param.is_optional:
                lines.append(f"    {field_name}: {field_type} = None")
            else:
                lines.append(f"    {field_name}: {field_type}")

        # Add to_tuple() method
        lines.append("")
        lines.append("    def to_tuple(self) -> tuple[Any, ...]:")
        lines.append(
            '        """Convert model to tuple in parameter order ($1, $2, ...)."""'
        )

        # Track composite array parameters that need conversion
        composite_array_conversions = {}
        if conn:
            from app.infra.v4.sql.sql_introspect import fetch_composite_fields

            for param in metadata.parameters:
                field_name = _sanitize_field_name(param.name)
                python_type = param.python_type

                # Check if this parameter is a composite array
                array_match = re.match(r"CompositeArray\((.+)\)", python_type)
                if array_match:
                    type_name = array_match.group(1)
                    if type_name in generated_composite_models:
                        # Fetch composite type fields to know the tuple structure
                        try:
                            fields = await fetch_composite_fields(conn, type_name)
                            field_names = [
                                f[0] for f in fields
                            ]  # Get field names in order
                            # Store conversion info
                            composite_array_conversions[field_name] = field_names
                        except Exception as e:
                            # If we can't fetch fields, skip conversion (will use as-is)
                            import sys

                            print(
                                f"Warning: Failed to fetch composite fields for {type_name}: {e}",
                                file=sys.stderr,
                            )

        # Add conversion code before return if needed
        if composite_array_conversions:
            for field_name, field_names in composite_array_conversions.items():
                field_accessors = ", ".join([f"conn.{fn}" for fn in field_names])
                lines.append(
                    f"        # Convert {field_name} composite array to tuples for asyncpg"
                )
                lines.append(f"        {field_name}_tuples = [")
                lines.append(f"            ({field_accessors})")
                lines.append(f"            for conn in (self.{field_name} or [])")
                lines.append("        ]")

        lines.append("        return (")
        for param in metadata.parameters:
            field_name = _sanitize_field_name(param.name)
            python_type = param.python_type

            # Check if this is a composite array that needs conversion
            array_match = re.match(r"CompositeArray\((.+)\)", python_type)
            if array_match and field_name in composite_array_conversions:
                # Use the converted tuple list
                lines.append(f"            {field_name}_tuples,")
            else:
                # Regular parameter or composite array without conversion - use as-is
                lines.append(f"            self.{field_name},")
        lines.append("        )")

    return "\n".join(lines), generated_composite_models


def detect_dict_prefixes_universal(columns: list[ColumnMetadata]) -> dict[str, str]:
    """Detect dict prefixes from column naming convention.

    Detects patterns like `prefix__key_field` and `prefix__key_field__field_name`
    to identify dict collections and their key fields.

    Args:
        columns: List of column metadata

    Returns:
        Dict mapping prefix to key field name (e.g., {"agents": "agent_id", "model_mapping": "id"})
    """
    dict_prefixes: dict[str, str] = {}
    sep = "__"
    all_column_names = {col.name for col in columns}

    # Step 1: Find all prefix__key_field patterns (key fields)
    key_field_columns: dict[str, str] = {}  # prefix -> key_field

    for col in columns:
        parts = col.name.split(sep)
        if len(parts) == 2:
            prefix = parts[0]
            field = parts[1]

            # Check if there are prefix__key_field__field_name columns
            has_nested_fields = any(
                other_col.startswith(f"{prefix}__{field}__")
                for other_col in all_column_names
            )

            if has_nested_fields:
                # This is a key field: prefix__key_field
                key_field_columns[prefix] = field

    # Step 2: Also check for prefix__key_field__field_name patterns directly
    # (in case key_field column is missing but nested fields exist)
    for col in columns:
        parts = col.name.split(sep)
        if len(parts) >= 3:
            prefix = parts[0]
            key_field = parts[1]

            # If we haven't seen this prefix yet, add it
            if prefix not in key_field_columns:
                key_field_columns[prefix] = key_field

    return key_field_columns


# Keep old functions for backward compatibility (deprecated)
def detect_list_prefixes(columns: list[ColumnMetadata]) -> set[str]:
    """Deprecated: Use detect_dict_prefixes_universal instead."""
    dict_prefixes = detect_dict_prefixes_universal(columns)
    return set(dict_prefixes.keys())


def detect_dict_prefixes(
    columns: list[ColumnMetadata], list_prefixes: set[str] | None = None
) -> dict[str, str]:
    """Deprecated: Use detect_dict_prefixes_universal instead."""
    return detect_dict_prefixes_universal(columns)


def _python_type_to_sample_value(python_type: str) -> Any:
    """Convert Python type string to a sample value for nest.

    Args:
        python_type: Python type string (e.g., "str", "list[str]", "int")

    Returns:
        Sample value of appropriate type
    """
    # Handle optional types
    if "| None" in python_type:
        python_type = python_type.split("|")[0].strip()

    # Handle list types
    if python_type.startswith("list["):
        return []

    # Handle dict types
    if python_type.startswith("dict["):
        return {}

    # Handle basic types
    if python_type == "str":
        return "sample"
    if python_type == "int":
        return 1
    if python_type == "float":
        return 1.0
    if python_type == "bool":
        return True
    if python_type == "Any":
        return None

    # Default to None for unknown types
    return None


def create_sample_rows(
    columns: list[ColumnMetadata], dict_prefixes: set[str], num_samples: int = 3
) -> list[dict[str, Any]]:
    """Generate sample row dictionaries from column metadata.

    Creates sample rows with appropriate types for use with nest.
    Multiple rows are created to simulate dict aggregation, with different
    values for dict prefix columns to ensure proper aggregation.

    Args:
        columns: List of column metadata
        dict_prefixes: Set of prefixes that should become dicts
        num_samples: Number of sample rows to generate

    Returns:
        List of sample row dictionaries
    """
    rows: list[dict[str, Any]] = []

    for i in range(num_samples):
        row: dict[str, Any] = {}
        for col in columns:
            # Generate sample values
            value = _python_type_to_sample_value(col.python_type)

            # Check if this column belongs to a dict prefix
            is_dict_prefix_col = False
            for prefix in dict_prefixes:
                if col.name.startswith(prefix + "__"):
                    is_dict_prefix_col = True
                    break

            if is_dict_prefix_col:
                # For list prefix columns, vary values to simulate multiple items
                if isinstance(value, str):
                    # Create unique values for each row to simulate aggregation
                    value = f"{value}_{i}"
                elif isinstance(value, (int, float)):
                    value = value + i
                elif isinstance(value, bool):
                    # Alternate boolean values
                    value = i % 2 == 0
            elif "__" in col.name:
                # Nested field but not a list prefix - use consistent value
                pass
            else:
                # Scalar field - use consistent value (from first row)
                if i > 0:
                    # Use same value as first row for scalar fields
                    value = rows[0].get(col.name, value)

            row[col.name] = value

        rows.append(row)

    return rows


def _generate_type_from_value(
    value: Any,
    field_name: str = "",
    generated_classes: dict[str, str] | None = None,
    route_name: str = "",
) -> str:
    """Generate Python type string from a sample value.

    Args:
        value: Sample value to analyze
        field_name: Optional field name for context
        generated_classes: Dictionary of generated class names for referencing
        route_name: Route name for generating class references

    Returns:
        Python type string
    """
    if value is None:
        return "Any | None"

    if isinstance(value, dict):
        # For dicts, try to infer structure
        if not value:
            return "dict[str, Any]"
        # Check if it's a dict of objects (like model_mapping)
        first_key = next(iter(value.keys()))
        first_val = value[first_key]
        if isinstance(first_val, dict):
            # It's a dict of dicts - generate a generic type
            return "dict[str, Any]"
        return "dict[str, Any]"

    if isinstance(value, list):
        if not value:
            return "list[Any]"
        # Check first item to infer list item type
        first_item = value[0]
        if isinstance(first_item, dict):
            # Try to find a generated class for this nested list
            if generated_classes and route_name and field_name:
                nested_class_name = _to_class_name(
                    f"{route_name}_{field_name}_item", ""
                )
                if nested_class_name in generated_classes:
                    return f"list[{nested_class_name}]"
            # Fall back to dict
            return "list[dict[str, Any]]"
        item_type = _generate_type_from_value(
            first_item, "", generated_classes, route_name
        )
        # Remove | None from item type for list items
        item_type = item_type.replace(" | None", "").strip()
        return f"list[{item_type}]"

    if isinstance(value, str):
        return "str"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, bool):
        return "bool"

    return "Any"


def _find_nested_class_name(
    key: str, parent_class_name: str, generated_classes: dict[str, str]
) -> str | None:
    """Find the generated class name for a nested list field.

    Args:
        key: Field name (e.g., "temperature_levels")
        parent_class_name: Parent class name (e.g., "GetAgentNewModelMappingItem")
        generated_classes: Dictionary of generated classes

    Returns:
        Class name if found, None otherwise
    """
    import re

    # Convert parent class name to base path
    # "GetAgentNewModelMappingItem" -> "get_agent_new_model_mapping"
    base_path = re.sub(
        r"(?<!^)(?=[A-Z])", "_", parent_class_name.replace("Item", "")
    ).lower()
    # Build expected class name: base_path + key + "Item"
    expected_path = f"{base_path}_{key}_item"
    expected_class_name = _to_class_name(expected_path, "")

    if expected_class_name in generated_classes:
        return expected_class_name

    # Fallback: search for class names containing the key
    key_parts = key.split("_")
    for gen_class_name in generated_classes.keys():
        # Check if class name contains all key parts and ends with Item
        if gen_class_name.endswith("Item"):
            class_lower = gen_class_name.lower()
            if all(part.lower() in class_lower for part in key_parts):
                # Check if it's likely the right class by checking the parent path
                if base_path.replace("_", "") in class_lower.replace("_", ""):
                    return gen_class_name

    return None


def _generate_nested_model_class(
    nested_data: dict[str, Any],
    class_name: str,
    indent: int = 0,
    generated_classes: dict[str, str] | None = None,
    route_name: str = "",
    column_type_map: dict[str, str] | None = None,
    column_optional_map: dict[str, bool] | None = None,
) -> tuple[str, dict[str, str]]:
    """Generate a Pydantic model class from nested data structure.

    Args:
        nested_data: Nested dictionary structure
        class_name: Name for the generated class
        indent: Indentation level
        generated_classes: Dictionary to track already-generated classes
        route_name: Route name for generating nested class references

    Returns:
        Tuple of (class_code, generated_classes_dict)
    """
    if generated_classes is None:
        generated_classes = {}

    # Check if we've already generated this class
    if class_name in generated_classes:
        return "", generated_classes

    indent_str = "    " * indent
    lines: list[str] = []

    # Generate class definition
    lines.append(f"{indent_str}class {class_name}(BaseModel):")
    lines.append(f'{indent_str}    """Generated nested model."""')
    lines.append("")

    # Track if any fields were added
    fields_added = False

    # Generate fields
    for key, value in nested_data.items():
        # Build the full field path for nested class lookup
        # Extract base path from class name if it's a nested class
        import re

        if class_name.endswith("Item"):
            # Convert PascalCase to snake_case: "GetAgentNewModelMappingItem" -> "get_agent_new_model_mapping"
            base_path = re.sub(
                r"(?<!^)(?=[A-Z])", "_", class_name.replace("Item", "")
            ).lower()
            full_field_path = f"{base_path}_{key}"
        else:
            full_field_path = f"{route_name}_{key}" if route_name else key

        # First, try to use PostgreSQL type from column metadata if available
        field_type: str | None = None
        if column_type_map:
            # Try to find the column type - column_type_map has both full paths and field names
            # Column names are like "model_mapping__temperature_lower"
            # After nesting, field names are like "temperature_lower"
            # We need to reconstruct the column name format: "prefix__field_name"

            # Extract the list prefix from class name (e.g., "GetAgentNewModelMappingItem" -> "model_mapping")
            list_prefix = ""
            if class_name.endswith("Item"):
                # Convert "GetAgentNewModelMappingItem" -> "get_agent_new_model_mapping" -> "model_mapping"
                import re

                base_name = class_name.replace("Item", "")
                snake_case = re.sub(r"(?<!^)(?=[A-Z])", "_", base_name).lower()
                # Extract the last part which should be the prefix (e.g., "model_mapping")
                parts = snake_case.split("_")
                if len(parts) >= 2:
                    list_prefix = "_".join(
                        parts[-2:]
                    )  # Take last 2 parts for "model_mapping"

            # Try different path formats - column_type_map has both "model_mapping__temperature_lower" and "temperature_lower"
            possible_paths = [
                key,  # Just the field name (e.g., "temperature_lower") - column_type_map has this
            ]

            # Try with list prefix if we have it (this is the actual column name format)
            if list_prefix:
                possible_paths.insert(
                    0, f"{list_prefix}__{key}"
                )  # "model_mapping__temperature_lower" - try this first!

            # Try full field path variations
            possible_paths.extend(
                [
                    full_field_path,  # Full path from route
                ]
            )

            # Try reconstructing from full_field_path if it contains "__"
            if "__" in full_field_path:
                parts = full_field_path.split("__")
                if len(parts) >= 2:
                    possible_paths.append(f"{parts[-2]}__{parts[-1]}")

            for path in possible_paths:
                if path in column_type_map:
                    pg_type = column_type_map[path]
                    # Check if field is optional from column_optional_map or if value is None
                    is_optional = False
                    if column_optional_map and path in column_optional_map:
                        is_optional = column_optional_map[path]
                    elif value is None:
                        # Fallback: if value is None in sample data, mark as optional
                        is_optional = True

                    if is_optional:
                        # Remove any existing | None and add it back
                        base_type = pg_type.replace(" | None", "").strip()
                        field_type = f"{base_type} | None"
                    else:
                        field_type = pg_type
                    break

        # Fall back to value inference if no PostgreSQL type found
        if field_type is None:
            field_type = _generate_type_from_value(
                value, full_field_path, generated_classes, route_name
            )

        # If it's a list of dicts, check if we have a generated class for it
        if isinstance(value, list) and value:
            first_item = value[0]
            if isinstance(first_item, dict):
                # Try to find the nested class name
                nested_class_name = None
                if generated_classes:
                    nested_class_name = _find_nested_class_name(
                        key, class_name, generated_classes
                    )

                if nested_class_name:
                    field_type = f"list[{nested_class_name}]"

        # Check if field is optional (from column_optional_map or value is None)
        is_field_optional = False
        if column_optional_map:
            # Try to find optional flag for this field
            for path in possible_paths if "possible_paths" in locals() else [key]:
                if path in column_optional_map:
                    is_field_optional = column_optional_map[path]
                    break
        if not is_field_optional and value is None:
            is_field_optional = True

        # Sanitize field name
        sanitized_key = _sanitize_field_name(key)
        if is_field_optional and "| None" in field_type:
            lines.append(f"{indent_str}    {sanitized_key}: {field_type} = None")
        else:
            lines.append(f"{indent_str}    {sanitized_key}: {field_type}")
        fields_added = True

    # If no fields were generated, add pass statement
    if not fields_added:
        lines.append(f"{indent_str}    pass")

    class_code = "\n".join(lines)
    generated_classes[class_name] = class_code

    return class_code, generated_classes


def generate_nested_types(
    nested_data: dict[str, Any],
    route_name: str,
    prefix: str = "",
    column_type_map: dict[str, str] | None = None,
    column_optional_map: dict[str, bool] | None = None,
) -> tuple[str, dict[str, str]]:
    """Recursively generate Pydantic model classes from nested structure.

    Analyzes the output of nest and generates appropriate Pydantic
    model classes for nested objects, handling nested lists within lists.

    Args:
        nested_data: Nested dictionary from nest output
        route_name: Route name for class naming
        prefix: Prefix for generated class names

    Returns:
        Tuple of (generated_classes_code, class_name_to_code_dict)
    """
    generated_classes: dict[str, str] = {}
    all_class_code: list[str] = []

    def _process_value(value: Any, key: str, parent_prefix: str = "") -> None:
        """Recursively process nested values."""
        if isinstance(value, list) and value:
            # Check if list contains dicts
            first_item = value[0]
            if isinstance(first_item, dict):
                # Generate class name - build full path
                if parent_prefix:
                    full_path = f"{route_name}_{parent_prefix}_{key}_item"
                else:
                    full_path = f"{route_name}_{key}_item"
                item_class_name = _to_class_name(full_path, "")

                if item_class_name not in generated_classes:
                    # First, recursively process nested structures within the item
                    # This ensures nested classes are generated before the parent class references them
                    nested_item_data = first_item.copy()
                    for nested_key, nested_val in nested_item_data.items():
                        if isinstance(nested_val, list) and nested_val:
                            # Nested list - process it first
                            nested_parent = (
                                f"{parent_prefix}_{key}" if parent_prefix else key
                            )
                            _process_value(nested_val, nested_key, nested_parent)

                    # Now generate the class for this item (nested classes are already generated)
                    item_code, updated_classes = _generate_nested_model_class(
                        first_item,
                        item_class_name,
                        indent=0,
                        generated_classes=generated_classes,
                        route_name=route_name,
                        column_type_map=column_type_map,
                        column_optional_map=column_optional_map,
                    )
                    generated_classes.update(updated_classes)
                    if item_code:
                        all_class_code.append(item_code)
                        generated_classes[item_class_name] = item_code

        elif isinstance(value, dict) and value:
            # Check if it's a dict of objects (nest returns dicts)
            first_val = next(iter(value.values()))
            if isinstance(first_val, dict):
                # Generate class for the item type
                item_class_name = _to_class_name(
                    f"{route_name}_{parent_prefix}_{key}_item"
                    if parent_prefix
                    else f"{route_name}_{key}_item",
                    "",
                )
                if item_class_name not in generated_classes:
                    item_code, _ = _generate_nested_model_class(
                        first_val,
                        item_class_name,
                        indent=0,
                        generated_classes=generated_classes,
                        column_type_map=column_type_map,
                        column_optional_map=column_optional_map,
                    )
                    if item_code:
                        all_class_code.append(item_code)
                        generated_classes[item_class_name] = item_code

    # Process top-level structure
    for key, value in nested_data.items():
        _process_value(value, key, prefix)

    return "\n\n".join(all_class_code), generated_classes


async def generate_response_model(
    metadata: SQLMetadata, route_name: str, conn: Any | None = None
) -> tuple[str, dict[str, str]]:
    """Generate Pydantic response model from SQL metadata with nesting support.

    Uses nest to determine the nested structure, then generates
    types that match what routes actually use.

    Also handles composite types by generating models for them.

    Args:
        metadata: SQL metadata with return column information
        route_name: Route name for class naming (e.g., "create_agent")
        conn: Database connection (optional, needed for composite type introspection)

    Returns:
        Python code string for Pydantic model
    """
    class_name = _to_class_name(route_name, "SqlRow")

    # Detect composite types in return columns
    composite_types: set[str] = set()
    generated_composite_models: dict[str, str] = {}  # type_name -> class_name

    if conn:
        for col in metadata.returns:
            # Check if column type is a composite type or composite array
            python_type = col.python_type

            # Check for Composite(...) marker
            composite_match = re.match(r"Composite\((.+)\)", python_type)
            if composite_match:
                type_name = composite_match.group(1)
                composite_types.add(type_name)

            # Check for CompositeArray(...) marker
            array_match = re.match(r"CompositeArray\((.+)\)", python_type)
            if array_match:
                # The group contains the full type name (e.g., "types.q_list_agents_v3_agent")
                type_name = array_match.group(1)
                composite_types.add(type_name)

    # Generate composite type models
    composite_model_code = []
    for comp_type in sorted(composite_types):
        try:
            if not conn:
                raise ValueError(
                    f"Database connection is None - cannot generate composite model for {comp_type}"
                )
            comp_class_name, comp_code = await generate_composite_model(
                conn, comp_type, generated_composite_models
            )
            generated_composite_models[comp_type] = comp_class_name
            composite_model_code.append(comp_code)
        except Exception as e:
            # Log the error for debugging
            import sys

            print(
                f"Warning: Failed to generate composite model for {comp_type}: {e}",
                file=sys.stderr,
            )
            # If we can't generate composite model, skip it
            # The type will be marked as Any
            pass

    # Detect dict prefixes from column naming convention
    dict_prefixes = detect_dict_prefixes_universal(metadata.returns)

    # If no dict prefixes detected, fall back to flat structure
    if not dict_prefixes:
        # Original flat generation
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
        ]

        # Add composite type models first
        if composite_model_code:
            lines.append("")
            lines.append("\n\n".join(composite_model_code))
            lines.append("")

        lines.append("")
        lines.append(f"class {class_name}(BaseModel):")
        lines.append('    """SQL query result row.')
        lines.append("")
        lines.append("    Columns returned by the SQL query.")
        lines.append('    """')
        lines.append("")

        # Add fields for each return column
        if not metadata.returns:
            # No return columns - add pass statement
            lines.append("    pass")
        else:
            for col in metadata.returns:
                field_name = _sanitize_field_name(col.name)
                field_type = col.python_type

                # Resolve composite types
                composite_match = re.match(r"Composite\((.+)\)", field_type)
                if composite_match:
                    type_name = composite_match.group(1)
                    if type_name in generated_composite_models:
                        field_type = generated_composite_models[type_name]
                    else:
                        field_type = "Any"  # Fallback if not generated

                # Resolve composite arrays
                array_match = re.match(r"CompositeArray\((.+)\)", field_type)
                if array_match:
                    type_name = array_match.group(1)
                    if type_name in generated_composite_models:
                        field_type = f"list[{generated_composite_models[type_name]}]"
                    else:
                        field_type = "list[Any]"  # Fallback if not generated

                field_type = _to_pydantic_field_type(field_type, col.is_optional)
                if col.is_optional:
                    lines.append(f"    {field_name}: {field_type} = None")
                else:
                    lines.append(f"    {field_name}: {field_type}")

        return "\n".join(lines), generated_composite_models

    # Generate nested structure using nest

    sample_rows = create_sample_rows(
        metadata.returns, set(dict_prefixes.keys()), num_samples=3
    )
    nested_data = nest(sample_rows)

    # Create a mapping from field name to PostgreSQL type for top-level fields
    top_level_type_map: dict[str, str] = {}
    top_level_optional_map: dict[str, bool] = {}
    for col in metadata.returns:
        # Top-level fields don't have dict prefixes
        if not any(
            col.name.startswith(prefix + "__") for prefix in dict_prefixes.keys()
        ):
            field_name = _sanitize_field_name(col.name)
            top_level_type_map[field_name] = col.python_type
            top_level_optional_map[field_name] = col.is_optional

    # Create column type map for nested fields (includes optional info)
    column_type_map: dict[str, str] = {}
    column_optional_map: dict[str, bool] = {}
    for col in metadata.returns:
        # Map column names (like "model_mapping__input_modalities") to their PostgreSQL types
        for prefix in dict_prefixes.keys():
            if col.name.startswith(prefix + "__"):
                field_path = col.name  # e.g., "model_mapping__input_modalities"
                field_name = col.name[len(prefix) + 2 :]  # e.g., "input_modalities"
                column_type_map[field_path] = col.python_type  # Full path lookup
                column_type_map[field_name] = col.python_type  # Field name lookup
                column_optional_map[field_path] = col.is_optional
                column_optional_map[field_name] = col.is_optional
                break

    # Generate nested model classes
    nested_classes_code, generated_classes = generate_nested_types(
        nested_data,
        route_name,
        column_type_map=column_type_map,
        column_optional_map=column_optional_map,
    )

    # Build the main response model
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
    ]

    # Add composite type models first (before nested classes)
    if composite_model_code:
        lines.append("")
        lines.append("\n\n".join(composite_model_code))
        lines.append("")

    # Add nested class definitions if any
    if nested_classes_code:
        lines.append("")
        lines.append(nested_classes_code)
        lines.append("")

    lines.append("")
    lines.append(f"class {class_name}(BaseModel):")
    lines.append('    """SQL query result row after nesting.')
    lines.append("")
    lines.append("    Structure matches nest output.")
    lines.append('    """')
    lines.append("")

    # Generate fields based on nested structure
    if not nested_data:
        # No return columns - add pass statement
        lines.append("    pass")
    else:
        for key, value in nested_data.items():
            # Try to use PostgreSQL type from column metadata for top-level fields
            sql_field_type: str | None = None
            is_field_optional = False
            if top_level_type_map and key in top_level_type_map:
                sql_field_type = top_level_type_map[key]
                if top_level_optional_map and key in top_level_optional_map:
                    is_field_optional = top_level_optional_map[key]

                # Resolve composite types
                composite_match = re.match(r"Composite\((.+)\)", sql_field_type)
                if composite_match:
                    type_name = composite_match.group(1)
                    if (
                        generated_composite_models
                        and type_name in generated_composite_models
                    ):
                        sql_field_type = generated_composite_models[type_name]

                # Resolve composite arrays
                array_match = re.match(r"CompositeArray\((.+)\)", sql_field_type)
                if array_match:
                    type_name = array_match.group(1)
                    if (
                        generated_composite_models
                        and type_name in generated_composite_models
                    ):
                        sql_field_type = (
                            f"list[{generated_composite_models[type_name]}]"
                        )
                    else:
                        sql_field_type = "list[Any]"  # Fallback if not generated

                # Resolve composite types
                composite_match = re.match(r"Composite\((.+)\)", sql_field_type)
                if composite_match:
                    type_name = composite_match.group(1)
                    if type_name in generated_composite_models:
                        sql_field_type = generated_composite_models[type_name]

                # Resolve composite arrays
                array_match = re.match(r"CompositeArray\((.+)\)", sql_field_type)
                if array_match:
                    type_name = array_match.group(
                        1
                    )  # e.g., "types.q_get_agent_detail_v3_department"
                    if type_name in generated_composite_models:
                        sql_field_type = (
                            f"list[{generated_composite_models[type_name]}]"
                        )
                    else:
                        # Fallback: use Any if composite model wasn't generated
                        sql_field_type = "list[Any]"

            # Fall back to value inference
            if sql_field_type is None:
                sql_field_type = _generate_type_from_value(
                    value, key, generated_classes, route_name
                )
                # If value is None, mark as optional
                if value is None:
                    is_field_optional = True

            # If it's a dict of objects, use the generated class
            if isinstance(value, dict) and value:
                first_val = next(iter(value.values()))
                if isinstance(first_val, dict):
                    # Find the corresponding generated class
                    item_class_name = _to_class_name(f"{route_name}_{key}_item", "")
                    if item_class_name in generated_classes:
                        sql_field_type = f"dict[str, {item_class_name}]"

            # If it's a list of dicts (legacy support), use the generated class
            elif isinstance(value, list) and value:
                first_item = value[0]
                if isinstance(first_item, dict):
                    item_class_name = _to_class_name(f"{route_name}_{key}_item", "")
                    if item_class_name in generated_classes:
                        sql_field_type = f"list[{item_class_name}]"

            sanitized_key = _sanitize_field_name(key)
            # Apply optional type if needed
            if is_field_optional and "| None" not in sql_field_type:
                sql_field_type = f"{sql_field_type} | None"

            if is_field_optional:
                lines.append(f"    {sanitized_key}: {sql_field_type} = None")
            else:
                lines.append(f"    {sanitized_key}: {sql_field_type}")

    return "\n".join(lines), generated_composite_models


def generate_api_request_model(
    metadata: SQLMetadata,
    route_name: str,
    generated_composite_models: dict[str, str] | None = None,
) -> str:
    """Generate Pydantic API request model from SQL metadata.

    Creates an API request model identical to SqlParams but excludes profile_id.
    This allows routes to accept requests without profile_id in the body,
    while SQL queries still receive profile_id from the request header.

    Args:
        metadata: SQL metadata with parameter information
        route_name: Route name for class naming (e.g., "create_agent")
        generated_composite_models: Dict mapping composite type names to class names

    Returns:
        Python code string for Pydantic model
    """
    class_name = _to_class_name(route_name, "ApiRequest")

    # Filter out profile_id parameter
    api_params = [p for p in metadata.parameters if p.name != "profile_id"]

    # Check if we need UUID import (excluding profile_id)
    needs_uuid = any("UUID" in param.python_type for param in api_params)

    # Check if we need Field import (for defaults)
    needs_field = any(param.default_value is not None for param in api_params)

    lines = [
        '"""API request model generated from SQL introspection.',
        "",
        f"Generated from: {metadata.sql_path}",
        "",
        "API request model excludes profile_id (obtained from request header).",
        '"""',
        "",
        "from typing import Any",
    ]

    if needs_uuid:
        lines.append("from uuid import UUID")

    lines.append("")
    lines.append("from pydantic import BaseModel")

    if needs_field:
        lines.append("from pydantic import Field")

    lines.append("")
    lines.append("")
    lines.append(f"class {class_name}(BaseModel):")
    lines.append('    """API request parameters.')
    lines.append("")
    lines.append("    Excludes profile_id (obtained from request header).")
    lines.append('    """')
    lines.append("")

    # Add fields for each parameter (excluding profile_id)
    if not api_params:
        # No parameters (or only profile_id which was filtered out) - add pass statement
        lines.append("    pass")
    else:
        for param in api_params:
            field_name = _sanitize_field_name(param.name)
            field_type = param.python_type

            # Resolve composite types
            composite_match = re.match(r"Composite\((.+)\)", field_type)
            if composite_match:
                type_name = composite_match.group(1)
                if (
                    generated_composite_models
                    and type_name in generated_composite_models
                ):
                    field_type = generated_composite_models[type_name]
                else:
                    field_type = "Any"  # Fallback if not generated

            # Resolve composite arrays
            array_match = re.match(r"CompositeArray\((.+)\)", field_type)
            if array_match:
                type_name = array_match.group(1)
                if (
                    generated_composite_models
                    and type_name in generated_composite_models
                ):
                    field_type = f"list[{generated_composite_models[type_name]}]"
                else:
                    field_type = "list[Any]"  # Fallback if not generated

            field_type = _to_pydantic_field_type(field_type, param.is_optional)

            # Handle defaults
            if param.default_value is not None:
                # Parse SQL default value to Python expression
                default_expr = _parse_sql_default_value(param.default_value, field_type)
                # Add type ignore comment for Field(default_factory=list) if needed
                if (
                    "Field(default_factory=list)" in default_expr
                    or "Field(default_factory=dict)" in default_expr
                ):
                    lines.append(
                        f"    {field_name}: {field_type} = {default_expr}  # type: ignore[arg-type]"
                    )
                else:
                    lines.append(f"    {field_name}: {field_type} = {default_expr}")
            elif param.is_optional:
                lines.append(f"    {field_name}: {field_type} = None")
            else:
                lines.append(f"    {field_name}: {field_type}")

    return "\n".join(lines)


def generate_api_response_model(
    metadata: SQLMetadata,
    route_name: str,
    generated_composite_models: dict[str, str] | None = None,
) -> str:
    """Generate Pydantic API response model from SQL metadata.

    For now, generates identical structure to SqlRow. Can be customized later
    to exclude sensitive fields or add computed properties.

    Args:
        metadata: SQL metadata with return column information
        route_name: Route name for class naming (e.g., "create_agent")

    Returns:
        Python code string for Pydantic model
    """
    class_name = _to_class_name(route_name, "ApiResponse")

    # Detect dict prefixes from column naming convention
    dict_prefixes = detect_dict_prefixes_universal(metadata.returns)

    # If no dict prefixes detected, fall back to flat structure
    if not dict_prefixes:
        # Original flat generation
        lines = [
            '"""API response model generated from SQL introspection.',
            "",
            f"Generated from: {metadata.sql_path}",
            "",
            "For now, identical to SQL response structure.",
            '"""',
            "",
            "from typing import Any",
            "",
            "from pydantic import BaseModel",
            "",
            "",
            f"class {class_name}(BaseModel):",
            '    """API response data.',
            "",
            "    Structure matches SQL query result.",
            '    """',
            "",
        ]

        # Add fields for each return column
        if not metadata.returns:
            # No return columns - add pass statement
            lines.append("    pass")
        else:
            for col in metadata.returns:
                field_name = _sanitize_field_name(col.name)
                field_type = col.python_type

                # Resolve composite types
                composite_match = re.match(r"Composite\((.+)\)", field_type)
                if composite_match:
                    type_name = composite_match.group(1)
                    if (
                        generated_composite_models
                        and type_name in generated_composite_models
                    ):
                        field_type = generated_composite_models[type_name]
                    else:
                        field_type = "Any"  # Fallback if not generated

                # Resolve composite arrays
                array_match = re.match(r"CompositeArray\((.+)\)", field_type)
                if array_match:
                    type_name = array_match.group(1)
                    if (
                        generated_composite_models
                        and type_name in generated_composite_models
                    ):
                        field_type = f"list[{generated_composite_models[type_name]}]"
                    else:
                        field_type = "list[Any]"  # Fallback if not generated

                field_type = _to_pydantic_field_type(field_type, col.is_optional)
                if col.is_optional:
                    lines.append(f"    {field_name}: {field_type} = None")
                else:
                    lines.append(f"    {field_name}: {field_type}")

        return "\n".join(lines)

    # Generate nested structure using nest for API responses

    sample_rows = create_sample_rows(
        metadata.returns, set(dict_prefixes.keys()), num_samples=3
    )
    nested_data = nest(sample_rows)

    # Create a mapping from field name to PostgreSQL type for top-level fields
    top_level_type_map: dict[str, str] = {}
    top_level_optional_map: dict[str, bool] = {}
    for col in metadata.returns:
        # Top-level fields don't have dict prefixes
        if not any(
            col.name.startswith(prefix + "__") for prefix in dict_prefixes.keys()
        ):
            field_name = _sanitize_field_name(col.name)
            top_level_type_map[field_name] = col.python_type
            top_level_optional_map[field_name] = col.is_optional

    # Create column type map for nested fields (includes optional info)
    column_type_map: dict[str, str] = {}
    column_optional_map: dict[str, bool] = {}
    for col in metadata.returns:
        # Map column names (like "model_mapping__input_modalities") to their PostgreSQL types
        for prefix in dict_prefixes.keys():
            if col.name.startswith(prefix + "__"):
                field_path = col.name  # e.g., "model_mapping__input_modalities"
                field_name = col.name[len(prefix) + 2 :]  # e.g., "input_modalities"
                column_type_map[field_path] = col.python_type  # Full path lookup
                column_type_map[field_name] = col.python_type  # Field name lookup
                column_optional_map[field_path] = col.is_optional
                column_optional_map[field_name] = col.is_optional
                break

    # Generate nested model classes
    nested_classes_code, generated_classes = generate_nested_types(
        nested_data,
        route_name,
        column_type_map=column_type_map,
        column_optional_map=column_optional_map,
    )

    # Build the main response model
    lines = [
        '"""API response model generated from SQL introspection.',
        "",
        f"Generated from: {metadata.sql_path}",
        "",
        "Structure matches nest output.",
        '"""',
        "",
        "from typing import Any",
        "",
        "from pydantic import BaseModel",
        "",
    ]

    # Add nested class definitions if any
    if nested_classes_code:
        lines.append("")
        lines.append(nested_classes_code)
        lines.append("")

    lines.append("")
    lines.append(f"class {class_name}(BaseModel):")
    lines.append('    """API response data after nesting.')
    lines.append("")
    lines.append("    Structure matches nest output.")
    lines.append('    """')
    lines.append("")

    # Generate fields based on nested structure
    if not nested_data:
        # No return columns - add pass statement
        lines.append("    pass")
    else:
        for key, value in nested_data.items():
            # Try to use PostgreSQL type from column metadata for top-level fields
            api_field_type: str | None = None
            is_field_optional = False
            if top_level_type_map and key in top_level_type_map:
                api_field_type = top_level_type_map[key]
                if top_level_optional_map and key in top_level_optional_map:
                    is_field_optional = top_level_optional_map[key]

                # Resolve composite types
                composite_match = re.match(r"Composite\((.+)\)", api_field_type)
                if composite_match:
                    type_name = composite_match.group(1)
                    if (
                        generated_composite_models
                        and type_name in generated_composite_models
                    ):
                        api_field_type = generated_composite_models[type_name]

                # Resolve composite arrays
                array_match = re.match(r"CompositeArray\((.+)\)", api_field_type)
                if array_match:
                    type_name = array_match.group(1)
                    if (
                        generated_composite_models
                        and type_name in generated_composite_models
                    ):
                        api_field_type = (
                            f"list[{generated_composite_models[type_name]}]"
                        )
                    else:
                        api_field_type = "list[Any]"  # Fallback if not generated

            # Fall back to value inference
            if api_field_type is None:
                api_field_type = _generate_type_from_value(
                    value, key, generated_classes, route_name
                )
                # If value is None, mark as optional
                if value is None:
                    is_field_optional = True

            # Check if this prefix should be a dict (from dict_prefixes detection)
            if key in dict_prefixes:
                # This should be a dict, find the item class
                item_class_name = _to_class_name(f"{route_name}_{key}_item", "")
                if item_class_name in generated_classes:
                    api_field_type = f"dict[str, {item_class_name}]"
                elif isinstance(value, dict) and value:
                    # Fallback: infer from nested structure
                    first_val = next(iter(value.values()))
                    if isinstance(first_val, dict):
                        api_field_type = "dict[str, Any]"
            # If it's a dict of objects (but not in dict_prefixes), use the generated class
            elif isinstance(value, dict) and value:
                first_val = next(iter(value.values()))
                if isinstance(first_val, dict):
                    # Find the corresponding generated class
                    item_class_name = _to_class_name(f"{route_name}_{key}_item", "")
                    if item_class_name in generated_classes:
                        api_field_type = f"dict[str, {item_class_name}]"

            # If it's a list of dicts (legacy support), use the generated class
            elif isinstance(value, list) and value:
                first_item = value[0]
                if isinstance(first_item, dict):
                    item_class_name = _to_class_name(f"{route_name}_{key}_item", "")
                    if item_class_name in generated_classes:
                        api_field_type = f"list[{item_class_name}]"

            sanitized_key = _sanitize_field_name(key)
            # Apply optional type if needed
            if is_field_optional and "| None" not in api_field_type:
                api_field_type = f"{api_field_type} | None"

            if is_field_optional:
                lines.append(f"    {sanitized_key}: {api_field_type} = None")
            else:
                lines.append(f"    {sanitized_key}: {api_field_type}")

    return "\n".join(lines)


async def generate_types_file(
    metadata: SQLMetadata, route_name: str, conn: Any | None = None
) -> str:
    """Generate complete types file with SQL and API request/response models.

    Args:
        metadata: SQL metadata
        route_name: Route name (e.g., "create_agent")
        conn: Database connection (optional, needed for composite type introspection)

    Returns:
        Complete Python file content with all four types:
        - SqlParams (SQL input with profile_id)
        - SqlRow (SQL output)
        - ApiRequest (API input without profile_id)
        - ApiResponse (API output, same as SqlRow for now)
    """
    sql_request_model, request_composite_models = await generate_request_model(
        metadata, route_name, conn
    )
    sql_response_model, response_composite_models = await generate_response_model(
        metadata, route_name, conn
    )

    # Merge composite models from both request and response
    all_composite_models = {**request_composite_models, **response_composite_models}

    api_request_model = generate_api_request_model(
        metadata, route_name, all_composite_models
    )
    api_response_model = generate_api_response_model(
        metadata, route_name, all_composite_models
    )

    return f"{sql_request_model}\n\n\n{sql_response_model}\n\n\n{api_request_model}\n\n\n{api_response_model}\n"
