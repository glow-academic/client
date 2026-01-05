"""Schema helper utilities for working with normalized schema system.

Provides functions to:
- Get schema with fields (including nested arrays)
- Build schema tree structure compatible with template schema format
- Get template schema
- Create schemas from dict structures
- Validate data against schemas
"""

import uuid
from typing import Any

import asyncpg


async def get_schema_with_fields(
    conn: asyncpg.Connection, schema_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Get schema fields for a given schema_id.

    Calls api_get_schema_with_fields_v4 SQL function to get all fields
    including nested array fields via schema_field_items.

    Args:
        conn: Database connection
        schema_id: UUID of the schema

    Returns:
        List of field dictionaries with keys: schema_id, field_id, field_name,
        field_type, required, position, item_schema_id
    """
    # Call function directly since it returns multiple rows
    rows = await conn.fetch(
        "SELECT * FROM api_get_schema_with_fields_v4($1)",
        schema_id,
    )

    # Convert rows to list of dicts
    fields: list[dict[str, Any]] = []
    for row in rows:
        field_dict = {
            "schema_id": uuid.UUID(row["schema_id"]) if row["schema_id"] else None,
            "field_id": uuid.UUID(row["field_id"]) if row["field_id"] else None,
            "field_name": row["field_name"],
            "field_type": row["field_type"],
            "required": row["required"],
            "position": row["position"],
            "item_schema_id": uuid.UUID(row["item_schema_id"])
            if row["item_schema_id"]
            else None,
        }
        fields.append(field_dict)

    return fields


async def get_schema_tree(
    conn: asyncpg.Connection, schema_id: uuid.UUID
) -> dict[str, Any]:
    """Recursively build complete schema tree including nested arrays.

    Returns structure compatible with existing template schema format:
    {
        "fields": [
            {
                "name": "field_name",
                "type": "string" | "number" | "boolean" | "array",
                "required": true/false,
                "description": "...",
                "placeholder": "...",
                "item": {  # Only for array type
                    "fields": [...]
                }
            }
        ]
    }

    Args:
        conn: Database connection
        schema_id: UUID of the schema

    Returns:
        Dictionary with "fields" key containing list of field definitions
    """
    fields_list = await get_schema_with_fields(conn, schema_id)

    # Group fields by schema_id (for nested arrays)
    schema_fields_map: dict[uuid.UUID, list[dict[str, Any]]] = {}
    for field in fields_list:
        schema_id_val = field["schema_id"]
        if schema_id_val not in schema_fields_map:
            schema_fields_map[schema_id_val] = []
        schema_fields_map[schema_id_val].append(field)

    async def build_field_dict(field: dict[str, Any]) -> dict[str, Any]:
        """Build field dictionary, recursively handling array items."""
        field_dict: dict[str, Any] = {
            "name": field["field_name"],
            "type": field["field_type"],
            "required": field["required"],
        }

        # If array type, recursively build item schema
        if field["field_type"] == "array" and field["item_schema_id"]:
            item_schema_id = field["item_schema_id"]
            item_fields = await get_schema_with_fields(conn, item_schema_id)
            item_field_dicts = [await build_field_dict(f) for f in item_fields]
            field_dict["item"] = {"fields": item_field_dicts}

        return field_dict

    # Build field dictionaries for root schema
    root_fields = schema_fields_map.get(schema_id, [])
    field_dicts = [await build_field_dict(f) for f in root_fields]

    # Sort by position
    field_dicts.sort(
        key=lambda x: next(
            (f["position"] for f in root_fields if f["field_name"] == x["name"]), 999
        )
    )

    return {"fields": field_dicts}


async def get_template_schema(
    conn: asyncpg.Connection, template_id: uuid.UUID
) -> dict[str, Any] | None:
    """Get schema for a template via schema_templates junction.

    Args:
        conn: Database connection
        template_id: UUID of the template

    Returns:
        Schema tree dictionary or None if template has no schema
    """
    # Call function directly since it returns a single row
    row = await conn.fetchrow(
        "SELECT * FROM api_get_template_schema_v4($1)",
        template_id,
    )

    if not row or not row["schema_id"]:
        return None

    schema_id = uuid.UUID(row["schema_id"])

    # Build schema tree
    return await get_schema_tree(conn, schema_id)


async def get_template_values(
    conn: asyncpg.Connection, template_id: uuid.UUID
) -> dict[str, Any]:
    """Reconstruct template values JSONB from normalized tables.

    Loads scalar values from template_values and array items from template_array_items,
    reconstructing the original JSONB structure.

    Args:
        conn: Database connection
        template_id: UUID of the template

    Returns:
        Dictionary of template values (compatible with template_args format)
    """
    # Get all scalar values
    values_rows = await conn.fetch(
        """
        SELECT sf.name, tv.string_value, tv.number_value, tv.boolean_value, sf.field_type
        FROM template_values tv
        JOIN schema_fields sf ON sf.id = tv.schema_field_id
        WHERE tv.template_id = $1
        ORDER BY sf.position
        """,
        template_id,
    )

    # Get all array items
    array_items_rows = await conn.fetch(
        """
        SELECT sf.name, tai.item_template_id, tai.position
        FROM template_array_items tai
        JOIN schema_fields sf ON sf.id = tai.schema_field_id
        WHERE tai.template_id = $1
        ORDER BY sf.position, tai.position
        """,
        template_id,
    )

    # Build result dictionary
    result: dict[str, Any] = {}

    # Process scalar values
    for row in values_rows:
        field_name = row["name"]
        field_type = row["field_type"]

        if field_type == "string":
            result[field_name] = row["string_value"]
        elif field_type == "number":
            result[field_name] = row["number_value"]
        elif field_type == "boolean":
            result[field_name] = row["boolean_value"]

    # Process array items (group by field name)
    array_fields: dict[str, list[dict[str, Any]]] = {}
    for row in array_items_rows:
        field_name = row["name"]
        item_template_id = row["item_template_id"]

        if field_name not in array_fields:
            array_fields[field_name] = []

        # Recursively get values for nested template
        item_values = await get_template_values(conn, item_template_id)
        array_fields[field_name].append(item_values)

    # Add arrays to result (preserve order)
    for field_name, items in array_fields.items():
        result[field_name] = items

    return result


async def create_template_with_values(
    conn: asyncpg.Connection,
    name: str,
    schema_id: uuid.UUID,
    values: dict[str, Any],
) -> uuid.UUID:
    """Create template and populate normalized value tables.

    Args:
        conn: Database connection
        name: Template name
        schema_id: UUID of the schema this template invokes
        values: Dictionary of template values (compatible with template_args format)

    Returns:
        UUID of the created template
    """
    # Create template record
    template_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO templates (id, name, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        """,
        template_id,
        name,
    )

    # Get schema fields
    schema_fields_list = await get_schema_with_fields(conn, schema_id)

    # Process each value
    for field in schema_fields_list:
        field_name = field["field_name"]
        field_id = field["field_id"]
        field_type = field["field_type"]

        if field_name not in values:
            continue  # Skip missing values

        value = values[field_name]

        if field_type == "array":
            # Handle array items
            if isinstance(value, list):
                for position, item_value in enumerate(value):
                    if isinstance(item_value, dict):
                        # Recursively create nested template for array item
                        item_schema_id = field["item_schema_id"]
                        if item_schema_id:
                            item_template_id = await create_template_with_values(
                                conn, f"{name} - {field_name}[{position}]", item_schema_id, item_value
                            )

                            # Link array item
                            await conn.execute(
                                """
                                INSERT INTO template_array_items (
                                    template_id, schema_field_id, item_template_id, position,
                                    created_at, updated_at
                                )
                                VALUES ($1, $2, $3, $4, NOW(), NOW())
                                ON CONFLICT (template_id, schema_field_id, item_template_id) DO NOTHING
                                """,
                                template_id,
                                field_id,
                                item_template_id,
                                position,
                            )
        else:
            # Handle scalar values
            if field_type == "string":
                await conn.execute(
                    """
                    INSERT INTO template_values (
                        template_id, schema_field_id, string_value, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, NOW(), NOW())
                    ON CONFLICT (template_id, schema_field_id) DO UPDATE SET
                        string_value = EXCLUDED.string_value,
                        updated_at = NOW()
                    """,
                    template_id,
                    field_id,
                    str(value),
                )
            elif field_type == "number":
                await conn.execute(
                    """
                    INSERT INTO template_values (
                        template_id, schema_field_id, number_value, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, NOW(), NOW())
                    ON CONFLICT (template_id, schema_field_id) DO UPDATE SET
                        number_value = EXCLUDED.number_value,
                        updated_at = NOW()
                    """,
                    template_id,
                    field_id,
                    float(value),
                )
            elif field_type == "boolean":
                await conn.execute(
                    """
                    INSERT INTO template_values (
                        template_id, schema_field_id, boolean_value, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, NOW(), NOW())
                    ON CONFLICT (template_id, schema_field_id) DO UPDATE SET
                        boolean_value = EXCLUDED.boolean_value,
                        updated_at = NOW()
                    """,
                    template_id,
                    field_id,
                    bool(value),
                )

    # Link template to schema
    await link_template_to_schema(conn, template_id, schema_id)

    return template_id


async def link_template_to_schema(
    conn: asyncpg.Connection, template_id: uuid.UUID, schema_id: uuid.UUID
) -> None:
    """Create schema_templates entry linking template to schema.

    Args:
        conn: Database connection
        template_id: UUID of the template
        schema_id: UUID of the schema
    """
    await conn.execute(
        """
        INSERT INTO schema_templates (schema_id, template_id, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (schema_id, template_id) DO UPDATE SET updated_at = NOW()
        """,
        schema_id,
        template_id,
    )


async def create_schema_from_dict(
    conn: asyncpg.Connection, schema_dict: dict[str, Any]
) -> uuid.UUID:
    """Create schema and schema_fields records from dict structure.

    Handles nested arrays via schema_field_items junction table.
    The schema_dict should have the format:
    {
        "fields": [
            {
                "name": "field_name",
                "type": "string" | "number" | "boolean" | "array",
                "required": true/false,
                "description": "...",  # Optional
                "placeholder": "...",  # Optional
                "item": {  # Only for array type
                    "fields": [...]
                }
            }
        ]
    }

    Args:
        conn: Database connection
        schema_dict: Dictionary with schema structure

    Returns:
        UUID of the created schema
    """
    # Create schema record
    schema_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO schemas (id, created_at, updated_at)
        VALUES ($1, NOW(), NOW())
        """,
        schema_id,
    )

    # Create schema_fields records
    fields = schema_dict.get("fields", [])
    for position, field in enumerate(fields):
        field_id = uuid.uuid4()
        field_type = field["type"]
        required = field.get("required", False)
        description = field.get("description")
        placeholder = field.get("placeholder")

        # Insert schema_field
        await conn.execute(
            """
            INSERT INTO schema_fields (
                id, schema_id, name, field_type, required, position, description, placeholder,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            """,
            field_id,
            schema_id,
            field["name"],
            field_type,
            required,
            position,
            description,
            placeholder,
        )

        # If array type, recursively create item schema and link via schema_field_items
        if field_type == "array" and "item" in field:
            item_schema_id = await create_schema_from_dict(conn, field["item"])
            await conn.execute(
                """
                INSERT INTO schema_field_items (
                    schema_field_id, item_schema_id, created_at, updated_at
                )
                VALUES ($1, $2, NOW(), NOW())
                """,
                field_id,
                item_schema_id,
            )

    return schema_id


async def validate_schema_data(
    data: dict[str, Any], schema_id: uuid.UUID, conn: asyncpg.Connection
) -> bool:
    """Validate data against schema.

    Checks required fields, types, and nested structures.

    Args:
        data: Data dictionary to validate
        schema_id: UUID of the schema to validate against
        conn: Database connection

    Returns:
        True if valid, False otherwise
    """
    schema_tree = await get_schema_tree(conn, schema_id)
    fields = schema_tree.get("fields", [])

    # Check required fields
    for field in fields:
        if field.get("required") and field["name"] not in data:
            return False

        field_name = field["name"]
        if field_name in data:
            value = data[field_name]
            field_type = field["type"]

            # Type validation
            if field_type == "string" and not isinstance(value, str):
                return False
            elif field_type == "number" and not isinstance(value, (int, float)):
                return False
            elif field_type == "boolean" and not isinstance(value, bool):
                return False
            elif field_type == "array":
                if not isinstance(value, list):
                    return False
                # Validate array items if item schema exists
                if "item" in field and value:
                    item_schema_id = None
                    # Get item_schema_id from database
                    fields_list = await get_schema_with_fields(conn, schema_id)
                    for f in fields_list:
                        if f["field_name"] == field_name and f["item_schema_id"]:
                            item_schema_id = f["item_schema_id"]
                            break
                    if item_schema_id:
                        for item in value:
                            if not isinstance(item, dict):
                                return False
                            if not await validate_schema_data(
                                item, item_schema_id, conn
                            ):
                                return False

    return True
