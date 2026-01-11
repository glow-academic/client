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


async def get_resource_sql_function_name(
    conn: asyncpg.Connection, resource_type: str
) -> str | None:
    """Discover SQL function name for creating a resource type.
    
    Queries pg_proc for functions matching pattern:
    - api_create_{resource_type}_v4
    - api_create_{resource_type}s_v4 (pluralized)
    
    Also validates that the resource exists in resource_tools table.
    
    Args:
        conn: Database connection
        resource_type: Resource type name (e.g., "personas", "names")
        
    Returns:
        Function name if found, None otherwise
    """
    # First check if resource exists in resource_tools
    resource_exists = await conn.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM resource_tools
            WHERE resource = $1::resources
        )
        """,
        resource_type,
    )
    
    if not resource_exists:
        return None
    
    # Try singular form first
    function_name_singular = f"api_create_{resource_type}_v4"
    function_exists = await conn.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = $1
        )
        """,
        function_name_singular,
    )
    
    if function_exists:
        return function_name_singular
    
    # Try plural form
    function_name_plural = f"api_create_{resource_type}s_v4"
    function_exists = await conn.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = $1
        )
        """,
        function_name_plural,
    )
    
    if function_exists:
        return function_name_plural
    
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
    columns = await conn.fetch(
        """
        SELECT 
            column_name as name,
            data_type,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name NOT IN ('id', 'created_at', 'updated_at')
        ORDER BY ordinal_position
        """,
        resource_type,
    )
    
    return [
        {
            "name": col["name"],
            "data_type": col["data_type"],
            "is_nullable": col["is_nullable"] == "YES",
            "column_default": col["column_default"],
        }
        for col in columns
    ]


async def get_resource_schema_fields(
    conn: asyncpg.Connection, resource_type: str
) -> list[dict[str, Any]]:
    """Discover schema fields for a resource type.
    
    Queries resource_schemas → schemas → schema_fields to get the output schema
    fields for a resource. These fields define what data the resource expects.
    
    Args:
        conn: Database connection
        resource_type: Resource type name (e.g., "personas", "names")
        
    Returns:
        List of schema field metadata dictionaries with keys:
        - name: Field name
        - field_type: Field type (string, number, boolean)
        - required: Whether field is required
        - position: Field position in schema
        - template: Jinja template string (if any)
    """
    fields = await conn.fetch(
        """
        SELECT 
            sf.name,
            sf.field_type::text as field_type,
            sf.required,
            sf.position,
            sf.template
        FROM resource_schemas rs
        JOIN schemas s ON s.id = rs.schema_id
        JOIN schema_fields sf ON sf.schema_id = s.id
        WHERE rs.resource = $1::resources
          AND sf.active = true
        ORDER BY sf.position
        """,
        resource_type,
    )
    
    return [
        {
            "name": field["name"],
            "field_type": field["field_type"],
            "required": field["required"],
            "position": field["position"],
            "template": field["template"],
        }
        for field in fields
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
    fields = await conn.fetch(
        """
        SELECT 
            sf.name,
            sf.field_type::text as field_type,
            sf.required,
            sf.position,
            sf.template
        FROM tool_templates tt
        JOIN schema_templates st ON st.template_id = tt.template_id
        JOIN schemas s ON s.id = st.schema_id
        JOIN schema_fields sf ON sf.schema_id = s.id
        WHERE tt.tool_id = $1::uuid
          AND sf.active = true
        ORDER BY sf.position
        """,
        tool_id,
    )
    
    return [
        {
            "name": field["name"],
            "field_type": field["field_type"],
            "required": field["required"],
            "position": field["position"],
            "template": field["template"],
        }
        for field in fields
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
    match = re.search(r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)', template)
    if match:
        return match.group(1)
    
    return None


async def map_template_values_to_table_columns(
    conn: asyncpg.Connection,
    resource_type: str,
    template_values: dict[str, Any],
    tool_id: str | None = None,
) -> dict[str, Any]:
    """Map template values (using schema field names) to table column names.
    
    Template values use output schema field names, but table columns may have
    different names. This function maps them by:
    1. Direct match: schema field name = table column name
    2. Template extraction: Extract variable names from Jinja templates
    3. Fallback: Use schema field name if no match found
    
    Args:
        conn: Database connection
        resource_type: Resource type name
        template_values: Dictionary of template values keyed by schema field name
        tool_id: Optional tool ID to get output schema fields
        
    Returns:
        Dictionary mapped to table column names ready for INSERT
    """
    # Get table columns
    table_columns = await get_resource_table_columns(conn, resource_type)
    column_names = {col["name"] for col in table_columns}
    
    # Get output schema fields (either from tool_id or resource_schemas)
    if tool_id:
        schema_fields = await get_resource_output_schema_fields(conn, tool_id)
    else:
        schema_fields = await get_resource_schema_fields(conn, resource_type)
    
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


async def get_agent_end_event_name(
    conn: asyncpg.Connection, resource_type: str
) -> str:
    """Discover agent end event name for a resource type.
    
    Checks if resource_type matches an artifact name in the artifacts table.
    If found, returns {resource_type}_end. Otherwise returns "text_end" as default.
    
    Args:
        conn: Database connection
        resource_type: Resource type name
        
    Returns:
        Event name string (e.g., "scenario_end", "text_end")
    """
    # Check if resource_type matches an artifact name
    artifact_exists = await conn.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM artifacts
            WHERE name = $1
        )
        """,
        resource_type,
    )
    
    if artifact_exists:
        return f"{resource_type}_end"
    
    # Special case: audio maps to voice
    if resource_type == "audio":
        return "voice_end"
    
    # Default fallback
    return "text_end"
