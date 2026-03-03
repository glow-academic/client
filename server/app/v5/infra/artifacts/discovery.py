"""Dynamic discovery helpers for artifact generation workflow.

This module provides functions to dynamically discover:
- SQL function names for resource creation
- Table column structures for resources
- Schema field mappings
- Agent end event names

All discovery is database-driven, eliminating the need for hardcoded mappings.
"""

import re
from typing import Any

import asyncpg

from app.v5.utils.sql_helper import _detect_function_in_sql, load_sql


async def get_resource_sql_function_name(
    conn: asyncpg.Connection, resource_type: str
) -> str | None:
    """Discover SQL function name for creating a resource type.

    Queries pg_proc for functions matching pattern:
    - api_create_{resource_type}_v4
    - api_create_{resource_type}s_v4 (pluralized)

    Also validates that the resource exists in resource_tools_relation table.

    Args:
        conn: Database connection
        resource_type: Resource type name (e.g., "personas", "names")

    Returns:
        Function name if found, None otherwise
    """
    sql_path = "app/v5/sql/queries/infra/artifacts/discovery/get_resource_sql_function_name_complete.sql"

    # Load SQL and detect if it's a function
    sql_text = load_sql(sql_path)
    is_function, function_name, schema = _detect_function_in_sql(sql_text)

    if is_function and function_name:
        # Call function and get first row (function returns single row or empty)
        function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"($1::text)'
        row = await conn.fetchrow(function_call_sql, resource_type)
        if row and row.get("function_name"):
            return str(row["function_name"])

    return None


async def get_resource_table_columns(
    conn: asyncpg.Connection, resource_type: str
) -> list[dict[str, Any]]:
    """Discover table columns for a resource type.

    Queries information_schema.columns to get all columns for the resource table.
    Filters out system columns (id, created_at, updated_at) as these are handled
    automatically by the database.

    Args:
        conn: Database connection
        resource_type: Resource type name (e.g., "personas", "names")

    Returns:
        List of column metadata dictionaries with keys:
        - name: Column name
        - data_type: PostgreSQL data type
        - is_nullable: Whether column allows NULL
        - column_default: Default value if any
    """
    sql_path = "app/v5/sql/queries/infra/artifacts/discovery/get_resource_table_columns_complete.sql"

    # Load SQL and detect if it's a function
    sql_text = load_sql(sql_path)
    is_function, function_name, schema = _detect_function_in_sql(sql_text)

    if is_function and function_name:
        # Call function and fetch all rows
        function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"($1::text)'
        rows = await conn.fetch(function_call_sql, resource_type)
    else:
        # Raw SQL - execute directly
        rows = await conn.fetch(sql_text, resource_type)

    return [
        {
            "name": str(row["name"]),
            "data_type": str(row["data_type"]),
            "is_nullable": bool(row["is_nullable"]),
            "column_default": str(row["column_default"])
            if row["column_default"]
            else None,
        }
        for row in rows
    ]


async def get_entry_table_columns(
    conn: asyncpg.Connection, entry_type: str
) -> list[dict[str, Any]]:
    """Discover table columns for an entry type.

    Queries information_schema.columns to get all columns for the entry table.
    Filters out system columns (id, created_at, updated_at) as these are handled
    automatically by the database.

    Args:
        conn: Database connection
        entry_type: Entry type name (e.g., "contents", "hints")

    Returns:
        List of column metadata dictionaries with keys:
        - name: Column name
        - data_type: PostgreSQL data type
        - is_nullable: Whether column allows NULL
        - column_default: Default value if any
    """
    # Query information_schema directly for entry tables
    table_name = f"{entry_type}_entry"
    query = """
        SELECT
            column_name::text as name,
            data_type::text as data_type,
            (is_nullable = 'YES') as is_nullable,
            column_default::text as column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name NOT IN ('id', 'created_at', 'updated_at')
        ORDER BY ordinal_position;
    """
    rows = await conn.fetch(query, table_name)

    return [
        {
            "name": str(row["name"]),
            "data_type": str(row["data_type"]),
            "is_nullable": bool(row["is_nullable"]),
            "column_default": str(row["column_default"])
            if row["column_default"]
            else None,
        }
        for row in rows
    ]


def get_resource_schema_fields(resource_type: str) -> list[dict[str, Any]]:
    """Get output schema fields for a resource type from the registry.

    Returns simplified output field schemas (string/number/boolean) that define
    the tool-facing output contract.

    Args:
        resource_type: Resource type name (e.g., "personas", "names")

    Returns:
        List of schema field metadata dictionaries with keys:
        - name: Field name
        - field_type: Field type (string, number, boolean)
        - required: Always False (outputs don't have required field)
        - position: Always 0 (outputs don't have position field)
        - template: Always empty string (templates are handled by args_outputs)
    """
    from app.v5.registry.resource_output_schemas import RESOURCE_OUTPUT_SCHEMAS

    return [
        {
            "name": f["name"],
            "field_type": f["field_type"],
            "required": False,
            "position": 0,
            "template": "",
        }
        for f in RESOURCE_OUTPUT_SCHEMAS.get(resource_type, [])
    ]


async def get_resource_output_schema_fields(
    conn: asyncpg.Connection, tool_id: str
) -> list[dict[str, Any]]:
    """Get output schema fields for a tool via tool_templates → schema_templates.

    This is used to map template_values (which use output schema field names)
    to table column names.

    Args:
        conn: Database connection
        tool_id: Tool UUID as string

    Returns:
        List of schema field metadata dictionaries
    """
    sql_path = "app/v5/sql/queries/infra/artifacts/discovery/get_resource_output_schema_fields_complete.sql"

    import uuid

    # Load SQL and detect if it's a function
    sql_text = load_sql(sql_path)
    is_function, function_name, schema = _detect_function_in_sql(sql_text)

    tool_uuid = uuid.UUID(tool_id)

    if is_function and function_name:
        # Call function and fetch all rows
        function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"($1::uuid)'
        rows = await conn.fetch(function_call_sql, tool_uuid)
    else:
        # Raw SQL - execute directly
        rows = await conn.fetch(sql_text, tool_uuid)

    return [
        {
            "name": str(row["name"]),
            "field_type": str(row["field_type"]),
            "required": bool(row["required"]),
            "position": int(row["position"]),
            "template": str(row["template"]),
        }
        for row in rows
    ]


def extract_template_variable_name(template: str) -> str | None:
    """Extract variable name from Jinja template.

    Extracts the first variable name from templates like:
    - {{ message }} -> "message"
    - {{ variable.property }} -> "variable"
    - {{ variable|filter }} -> "variable"

    Args:
        template: Jinja template string

    Returns:
        Variable name if found, None otherwise
    """
    if not template or not template.strip():
        return None

    # Pattern to match {{ variable }} or {{ variable.property }} or {{ variable|filter }}
    match = re.search(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)", template)
    if match:
        return match.group(1)

    return None


async def map_template_values_to_table_columns(
    conn: asyncpg.Connection,
    resource_type: str,
    template_values: dict[str, Any],
    tool_id: str | None = None,
    is_entry: bool = False,
) -> dict[str, Any]:
    """Map template values (using schema field names) to table column names.

    Template values use output schema field names, but table columns may have
    different names. This function maps them by:
    1. Direct match: schema field name = table column name
    2. Template extraction: Extract variable names from Jinja templates
    3. Fallback: Use schema field name if no match found

    Args:
        conn: Database connection
        resource_type: Resource type name (or entry_type if is_entry=True)
        template_values: Dictionary of template values keyed by schema field name
        tool_id: Optional tool ID to get output schema fields
        is_entry: If True, look up {type}_entry table instead of {type}_resource

    Returns:
        Dictionary mapped to table column names ready for INSERT
    """
    # Get table columns (handle both resource and entry tables)
    if is_entry:
        table_columns = await get_entry_table_columns(conn, resource_type)
    else:
        table_columns = await get_resource_table_columns(conn, resource_type)
    column_names = {col["name"] for col in table_columns}

    # Get output schema fields (either from tool_id or resource_schemas)
    if tool_id:
        schema_fields = await get_resource_output_schema_fields(conn, tool_id)
    else:
        schema_fields = get_resource_schema_fields(resource_type)

    # Build mapping: schema field name -> table column name
    mapped_data: dict[str, Any] = {}

    for schema_field in schema_fields:
        schema_field_name = schema_field["name"]
        template = schema_field.get("template", "")

        # Try direct match first
        if schema_field_name in column_names:
            if schema_field_name in template_values:
                mapped_data[schema_field_name] = template_values[schema_field_name]
            continue

        # Try extracting variable name from template
        var_name = extract_template_variable_name(template)
        if var_name and var_name in column_names:
            if schema_field_name in template_values:
                mapped_data[var_name] = template_values[schema_field_name]
            continue

        # Fallback: use schema field name (may not match, but worth trying)
        if schema_field_name in template_values:
            mapped_data[schema_field_name] = template_values[schema_field_name]

    return mapped_data


async def get_agent_end_event_name(conn: asyncpg.Connection, artifact_type: str) -> str:
    """Discover agent end event name for an artifact type.

    Checks if artifact_type is a valid value in the artifacts enum.
    If found, returns {artifact_type}_end. Otherwise returns "text_end" as default.

    Args:
        conn: Database connection
        artifact_type: Artifact type name (from artifacts enum, e.g., "persona", "scenario", "rubric")

    Returns:
        Event name string (e.g., "persona_end", "scenario_end", "text_end")
    """
    sql_path = "app/v5/sql/queries/infra/artifacts/discovery/get_agent_end_event_name_complete.sql"

    # Load SQL and detect if it's a function
    sql_text = load_sql(sql_path)
    is_function, function_name, schema = _detect_function_in_sql(sql_text)

    if is_function and function_name:
        # Call function and get first row (function returns single row)
        function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"($1::text)'
        row = await conn.fetchrow(function_call_sql, artifact_type)
        if row and row.get("event_name"):
            return str(row["event_name"])

    return "text_end"
