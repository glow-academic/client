"""Dynamic persona documentation endpoint.

Queries database schema at runtime and extracts business logic from permissions.py.
"""

import inspect
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.api.v4.artifacts.persona import permissions
from app.main import get_db

router = APIRouter()

# Permission functions to document
PERMISSION_FUNCTIONS = [
    "compute_can_edit",
    "compute_can_delete",
    "compute_can_duplicate",
    "compute_can_create",
    "compute_can_save",
    "compute_can_draft",
    "has_access",
]


# ========== Schema Discovery Helpers ==========


async def _get_table_columns(conn: asyncpg.Connection, table_name: str) -> list[dict]:
    """Get columns for a table from information_schema."""
    rows = await conn.fetch(
        """
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
        """,
        table_name,
    )
    return [
        {
            "name": row["column_name"],
            "type": row["data_type"],
            "nullable": row["is_nullable"] == "YES",
            "default": row["column_default"],
        }
        for row in rows
    ]


async def _get_junction_tables(conn: asyncpg.Connection, prefix: str) -> list[dict]:
    """Get junction tables and their columns for a given prefix."""
    rows = await conn.fetch(
        """
        SELECT t.table_name, array_agg(c.column_name ORDER BY c.ordinal_position) as columns
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        WHERE t.table_schema = 'public'
          AND (t.table_name LIKE $1 OR t.table_name LIKE $2)
        GROUP BY t.table_name
        ORDER BY t.table_name
        """,
        f"{prefix}_%_junction",
        f"%_{prefix}s_%",
    )
    return [{"name": row["table_name"], "columns": row["columns"]} for row in rows]


async def _get_foreign_keys(conn: asyncpg.Connection, table_pattern: str) -> list[dict]:
    """Get foreign key relationships for tables matching a pattern."""
    rows = await conn.fetch(
        """
        SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name LIKE $1
        ORDER BY tc.table_name, kcu.column_name
        """,
        table_pattern,
    )
    return [
        {
            "table": row["table_name"],
            "column": row["column_name"],
            "references": row["references_table"],
        }
        for row in rows
    ]


# ========== Business Logic Extraction ==========


def _parse_docstring(docstring: str | None) -> dict[str, Any]:
    """Parse docstring into description and rules."""
    if not docstring:
        return {"description": "", "rules": []}

    lines = docstring.strip().split("\n")
    description = lines[0] if lines else ""

    rules = []
    for line in lines:
        line = line.strip()
        if line.startswith("-") or line.startswith("*"):
            rules.append(line.lstrip("-* "))

    return {"description": description, "rules": rules}


def _get_business_logic() -> dict[str, dict[str, Any]]:
    """Extract business logic from permission function docstrings."""
    result = {}
    for func_name in PERMISSION_FUNCTIONS:
        func = getattr(permissions, func_name, None)
        if func is None:
            continue
        parsed = _parse_docstring(inspect.getdoc(func))
        result[func_name] = {
            "description": parsed["description"],
            "rules": parsed["rules"],
            "source": inspect.getsource(func),
        }
    return result


# ========== Static Documentation ==========


def _get_api_routing() -> dict[str, Any]:
    """Get static API routing documentation."""
    return {
        "base_path": "/api/v4/personas",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single persona by ID",
                "request_model": "GetPersonaApiRequest",
                "response_model": "GetPersonaApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a persona",
                "request_model": "SavePersonaApiRequest",
                "response_model": "SavePersonaApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List personas with optional filters",
                "request_model": "GetPersonasListApiRequest",
                "response_model": "GetPersonasListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing persona",
                "request_model": "DuplicatePersonaApiRequest",
                "response_model": "DuplicatePersonaApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a persona",
                "request_model": "DeletePersonaApiRequest",
                "response_model": "DeletePersonaApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a persona draft (autosave)",
                "request_model": "PatchPersonaDraftApiRequest",
                "response_model": "PatchPersonaDraftApiResponse",
            },
            "docs": {
                "path": "/docs",
                "method": "POST",
                "description": "Get comprehensive persona documentation",
            },
        },
    }


def _get_glow_context() -> dict[str, Any]:
    """Get static GLOW context documentation."""
    return {
        "description": (
            "Personas represent AI characters used in scenarios to provide "
            "different perspectives, roles, or personalities. They are central "
            "to GLOW's simulation and practice features, allowing students to "
            "interact with various AI characters in realistic scenarios."
        ),
        "use_cases": [
            "Creating AI characters for scenario-based learning",
            "Defining different roles in simulations (e.g., patient, doctor, administrator)",
            "Customizing AI behavior through instructions and examples",
            "Organizing personas by department or field",
            "Using personas in messages and model runs for consistent character representation",
        ],
        "related_concepts": [
            "Scenarios - Personas are assigned to scenarios to define available characters",
            "Messages - Messages can be associated with personas to indicate which character is speaking",
            "Runs - Model runs reference personas to track which character generated responses",
            "Parameters - Personas can be linked to parameters for configuration",
            "Resources - Personas use multiple resource types for rich representation",
        ],
    }


# ========== Main Documentation Builder ==========


async def _build_docs(conn: asyncpg.Connection) -> dict[str, Any]:
    """Build complete documentation response."""
    # Fetch dynamic schema information
    columns = await _get_table_columns(conn, "persona_artifact")
    junction_tables = await _get_junction_tables(conn, "persona")
    foreign_keys = await _get_foreign_keys(conn, "persona_%")

    # Extract linked resources from junction table names
    linked_resources = []
    for jt in junction_tables:
        name = jt["name"]
        # Extract resource name from junction table (e.g., persona_names_junction -> names)
        if name.startswith("persona_") and name.endswith("_junction"):
            resource = name[8:-9]  # Remove 'persona_' prefix and '_junction' suffix
            if resource:
                linked_resources.append(resource)

    return {
        "name": "personas",
        "type": "artifact",
        # Dynamic: From information_schema
        "database": {
            "table": "persona_artifact",
            "columns": columns,
            "foreign_keys": foreign_keys,
        },
        # Dynamic: From junction table query
        "relationships": {
            "junction_tables": junction_tables,
            "linked_resources": linked_resources,
        },
        # Dynamic: Parsed from permissions.py
        "business_logic": _get_business_logic(),
        # Static
        "api_routing": _get_api_routing(),
        "glow_context": _get_glow_context(),
    }


# ========== Endpoint ==========


@router.post("/docs")
async def get_persona_docs(
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict[str, Any]:
    """Get comprehensive persona documentation with dynamic schema and business logic.

    Returns:
        Complete documentation including:
        - Database schema (columns, foreign keys) from information_schema
        - Junction tables and relationships
        - Business logic extracted from permissions.py
        - API routing information
        - GLOW context and use cases
    """
    return await _build_docs(conn)
