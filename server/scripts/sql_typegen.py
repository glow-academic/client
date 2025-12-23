"""Type generator for SQL introspection results.

Generates Pydantic models from SQL metadata for request/response types.
"""

from typing import Any

from scripts.sql_introspect import ColumnMetadata, SQLMetadata
from utils.sql_nest import nest_many


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


def detect_list_prefixes(columns: list[ColumnMetadata]) -> set[str]:
    """Detect list prefixes from column names with __ patterns.

    Scans column names for prefixes that appear multiple times, indicating
    they should become lists when using nest_many().

    Args:
        columns: List of column metadata

    Returns:
        Set of list prefixes (e.g., {"model_mapping", "department_mapping"})
    """
    prefix_counts: dict[str, int] = {}
    sep = "__"

    for col in columns:
        if sep not in col.name:
            continue

        # Extract prefix (everything before the first __)
        prefix = col.name.split(sep)[0]
        prefix_counts[prefix] = prefix_counts.get(prefix, 0) + 1

    # Prefixes that appear multiple times are likely list prefixes
    # (they'll be aggregated across multiple rows)
    list_prefixes = {prefix for prefix, count in prefix_counts.items() if count > 1}

    return list_prefixes


def _python_type_to_sample_value(python_type: str) -> Any:
    """Convert Python type string to a sample value for nest_many().

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
    columns: list[ColumnMetadata], list_prefixes: set[str], num_samples: int = 3
) -> list[dict[str, Any]]:
    """Generate sample row dictionaries from column metadata.

    Creates sample rows with appropriate types for use with nest_many().
    Multiple rows are created to simulate list aggregation, with different
    values for list prefix columns to ensure proper aggregation.

    Args:
        columns: List of column metadata
        list_prefixes: Set of prefixes that should become lists
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

            # Check if this column belongs to a list prefix
            is_list_prefix_col = False
            for prefix in list_prefixes:
                if col.name.startswith(prefix + "__"):
                    is_list_prefix_col = True
                    break

            if is_list_prefix_col:
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
    value: Any, field_name: str = "", generated_classes: dict[str, str] | None = None, route_name: str = ""
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
        item_type = _generate_type_from_value(first_item, "", generated_classes, route_name)
        # Remove | None from item type for list items
        item_type = item_type.replace(" | None", "").strip()
        return f"list[{item_type}]"

    if isinstance(value, str):
        return "str"
    if isinstance(value, int):
        # Check if it's actually a bool (0/1)
        # Common patterns: is_*, has_*, can_*, should_*, will_*
        if value in (0, 1) and field_name:
            field_lower = field_name.lower()
            if any(prefix in field_lower for prefix in ["is_", "has_", "can_", "should_", "will_", "_enabled", "_active"]):
                return "bool"
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
    base_path = re.sub(r'(?<!^)(?=[A-Z])', '_', parent_class_name.replace("Item", "")).lower()
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

    # Generate fields
    for key, value in nested_data.items():
        # Build the full field path for nested class lookup
        # Extract base path from class name if it's a nested class
        import re
        if class_name.endswith("Item"):
            # Convert PascalCase to snake_case: "GetAgentNewModelMappingItem" -> "get_agent_new_model_mapping"
            base_path = re.sub(r'(?<!^)(?=[A-Z])', '_', class_name.replace("Item", "")).lower()
            full_field_path = f"{base_path}_{key}"
        else:
            full_field_path = f"{route_name}_{key}" if route_name else key
        
        field_type = _generate_type_from_value(value, full_field_path, generated_classes, route_name)
        
        # If it's a list of dicts, check if we have a generated class for it
        if isinstance(value, list) and value:
            first_item = value[0]
            if isinstance(first_item, dict):
                # Try to find the nested class name
                nested_class_name = None
                if generated_classes:
                    nested_class_name = _find_nested_class_name(key, class_name, generated_classes)
                
                if nested_class_name:
                    field_type = f"list[{nested_class_name}]"
        
        # Sanitize field name
        sanitized_key = _sanitize_field_name(key)
        lines.append(f"{indent_str}    {sanitized_key}: {field_type}")

    class_code = "\n".join(lines)
    generated_classes[class_name] = class_code

    return class_code, generated_classes


def generate_nested_types(
    nested_data: dict[str, Any],
    route_name: str,
    prefix: str = "",
) -> tuple[str, dict[str, str]]:
    """Recursively generate Pydantic model classes from nested structure.

    Analyzes the output of nest_many() and generates appropriate Pydantic
    model classes for nested objects, handling nested lists within lists.

    Args:
        nested_data: Nested dictionary from nest_many() output
        route_name: Route name for class naming
        prefix: Prefix for generated class names

    Returns:
        Tuple of (generated_classes_code, class_name_to_code_dict)
    """
    generated_classes: dict[str, str] = {}
    all_class_code: list[str] = []

    def _process_value(value: Any, key: str, parent_prefix: str = ""):
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
                            nested_parent = f"{parent_prefix}_{key}" if parent_prefix else key
                            _process_value(nested_val, nested_key, nested_parent)

                    # Now generate the class for this item (nested classes are already generated)
                    item_code, updated_classes = _generate_nested_model_class(
                        first_item, item_class_name, indent=0, generated_classes=generated_classes, route_name=route_name
                    )
                    generated_classes.update(updated_classes)
                    if item_code:
                        all_class_code.append(item_code)
                        generated_classes[item_class_name] = item_code

        elif isinstance(value, dict) and value:
            # Check if it's a dict of objects (though nest_many returns lists, not dicts)
            first_val = next(iter(value.values()))
            if isinstance(first_val, dict):
                # Generate class for the item type
                item_class_name = _to_class_name(
                    f"{route_name}_{parent_prefix}_{key}_item" if parent_prefix else f"{route_name}_{key}_item",
                    ""
                )
                if item_class_name not in generated_classes:
                    item_code, _ = _generate_nested_model_class(
                        first_val, item_class_name, indent=0, generated_classes=generated_classes
                    )
                    if item_code:
                        all_class_code.append(item_code)
                        generated_classes[item_class_name] = item_code

    # Process top-level structure
    for key, value in nested_data.items():
        _process_value(value, key, prefix)

    return "\n\n".join(all_class_code), generated_classes


def generate_response_model(
    metadata: SQLMetadata, route_name: str
) -> str:
    """Generate Pydantic response model from SQL metadata with nesting support.

    Uses nest_many() to determine the nested structure, then generates
    types that match what routes actually use.

    Args:
        metadata: SQL metadata with return column information
        route_name: Route name for class naming (e.g., "create_agent")

    Returns:
        Python code string for Pydantic model
    """
    class_name = _to_class_name(route_name, "SqlRow")

    # Detect list prefixes from column names
    list_prefixes = detect_list_prefixes(metadata.returns)

    # If no list prefixes detected, fall back to flat structure
    if not list_prefixes:
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
            lines.append(f"    {field_name}: {field_type}")

        return "\n".join(lines)

    # Generate nested structure using nest_many()
    sample_rows = create_sample_rows(metadata.returns, list_prefixes, num_samples=3)
    nested_data = nest_many(sample_rows, list_prefixes=list_prefixes)

    # Generate nested model classes
    nested_classes_code, generated_classes = generate_nested_types(
        nested_data, route_name
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

    # Add nested class definitions if any
    if nested_classes_code:
        lines.append("")
        lines.append(nested_classes_code)
        lines.append("")

    lines.append("")
    lines.append(f"class {class_name}(BaseModel):")
    lines.append('    """SQL query result row after nesting.')
    lines.append("")
    lines.append("    Structure matches nest_many() output.")
    lines.append('    """')
    lines.append("")

    # Generate fields based on nested structure
    for key, value in nested_data.items():
        field_type = _generate_type_from_value(value, key, generated_classes, route_name)

        # If it's a dict of objects, use the generated class
        if isinstance(value, dict) and value:
            first_val = next(iter(value.values()))
            if isinstance(first_val, dict):
                # Find the corresponding generated class
                item_class_name = _to_class_name(
                    f"{route_name}_{key}_item", ""
                )
                if item_class_name in generated_classes:
                    field_type = f"dict[str, {item_class_name}]"

        # If it's a list of dicts, use the generated class
        elif isinstance(value, list) and value:
            first_item = value[0]
            if isinstance(first_item, dict):
                item_class_name = _to_class_name(
                    f"{route_name}_{key}_item", ""
                )
                if item_class_name in generated_classes:
                    field_type = f"list[{item_class_name}]"

        sanitized_key = _sanitize_field_name(key)
        lines.append(f"    {sanitized_key}: {field_type}")

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

