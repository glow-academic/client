"""Tests for artifact discovery helpers."""

import pytest

from app.infra.artifacts.discovery import (
    extract_template_variable_name,
    get_agent_end_event_name,
    get_entry_table_columns,
    get_resource_schema_fields,
    get_resource_sql_function_name,
    get_resource_table_columns,
    map_template_values_to_table_columns,
)

pytestmark = pytest.mark.asyncio


async def test_get_resource_sql_function_name_discovers_real_function(conn):
    await conn.execute(
        """
        CREATE FUNCTION public.api_create_names_v4()
        RETURNS integer
        LANGUAGE sql
        AS $$ SELECT 1 $$;
        """
    )

    assert await get_resource_sql_function_name(conn, "name") == "api_create_names_v4"
    assert await get_resource_sql_function_name(conn, "totally_missing") is None


async def test_get_resource_table_columns_reads_real_table_shape(conn):
    columns = await get_resource_table_columns(conn, "names")
    column_names = {column["name"] for column in columns}

    assert "name" in column_names
    assert "id" not in column_names
    assert "created_at" not in column_names


async def test_get_entry_table_columns_reads_real_table_shape(conn):
    columns = await get_entry_table_columns(conn, "messages")
    column_names = {column["name"] for column in columns}

    assert "role" in column_names
    assert "id" not in column_names
    assert "created_at" not in column_names


async def test_get_resource_schema_fields_uses_registry():
    fields = get_resource_schema_fields("emails")

    assert fields == [
        {
            "name": "email",
            "field_type": "string",
            "required": False,
            "position": 0,
            "template": "",
        }
    ]


async def test_extract_template_variable_name_handles_basic_cases():
    assert extract_template_variable_name("{{ content }}") == "content"
    assert extract_template_variable_name("{{ value.name|trim }}") == "value"
    assert extract_template_variable_name("plain text") is None


async def test_map_template_values_to_table_columns_direct_and_template_match(conn):
    mapped = await map_template_values_to_table_columns(
        conn,
        "names",
        {"name": "Alice"},
    )
    assert mapped == {"name": "Alice"}

    mapped_entry = await map_template_values_to_table_columns(
        conn,
        "messages",
        {"role": "user"},
        is_entry=True,
    )
    assert mapped_entry == {}


async def test_get_agent_end_event_name_handles_known_and_special_cases(conn):
    assert await get_agent_end_event_name(conn, "audio") == "voice_end"
    assert await get_agent_end_event_name(conn, "persona") == "persona_end"
    assert await get_agent_end_event_name(conn, "missing_artifact") == "text_end"
