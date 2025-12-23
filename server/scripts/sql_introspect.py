"""SQL introspection engine for type generation.

Uses asyncpg to PREPARE queries and extract parameter/return types,
mapping Postgres OIDs to Python types.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import asyncpg  # type: ignore
from utils.sql_helper import load_sql

# Postgres type OIDs to Python type mapping
# Common OIDs from PostgreSQL documentation
OID_TO_PYTHON_TYPE: dict[int, str] = {
    # Boolean
    16: "bool",  # BOOLEAN
    # Integer types
    20: "int",  # BIGINT
    21: "int",  # SMALLINT
    23: "int",  # INTEGER
    # Text types
    25: "str",  # TEXT
    1043: "str",  # VARCHAR
    1042: "str",  # CHAR
    # UUID
    2950: "str",  # UUID (stored as string in Python)
    # Timestamp types
    1114: "str",  # TIMESTAMP (ISO string)
    1184: "str",  # TIMESTAMPTZ (ISO string)
    1082: "str",  # DATE (ISO string)
    1083: "str",  # TIME (ISO string)
    1266: "str",  # TIMETZ (ISO string)
    # JSON types
    114: "dict[str, Any]",  # JSON
    3802: "dict[str, Any]",  # JSONB
    # Array types (base OID + 1 = array OID)
    # We'll detect arrays by checking if OID is in pg_type with typarray
    1000: "list[bool]",  # BOOLEAN[]
    1001: "list[bytes]",  # BYTEA[]
    1002: "list[str]",  # CHAR[]
    1003: "list[str]",  # NAME[]
    1005: "list[int]",  # SMALLINT[]
    1006: "list[int]",  # OID[]
    1007: "list[int]",  # INTEGER[]
    1009: "list[str]",  # TEXT[]
    1014: "list[str]",  # BPCHAR[]
    1015: "list[str]",  # VARCHAR[]
    1016: "list[int]",  # BIGINT[]
    1021: "list[float]",  # FLOAT4[]
    1022: "list[float]",  # FLOAT8[]
    1028: "list[int]",  # INT4[]
    1033: "list[str]",  # ACLITEM[]
    1034: "list[str]",  # UUID[]
    1115: "list[str]",  # TIMESTAMP[]
    1182: "list[str]",  # DATE[]
    1183: "list[str]",  # TIME[]
    1185: "list[str]",  # TIMESTAMPTZ[]
    1186: "list[str]",  # INTERVAL[]
    1187: "list[str]",  # TIMETZ[]
    199: "list[dict[str, Any]]",  # JSON[]
    3807: "list[dict[str, Any]]",  # JSONB[]
}


@dataclass
class ColumnMetadata:
    """Metadata for a single column."""

    name: str
    python_type: str
    pg_oid: int
    is_array: bool


@dataclass
class SQLMetadata:
    """Metadata extracted from a SQL file."""

    sql_path: str
    parameters: list[ColumnMetadata]  # Ordered $1, $2, ...
    returns: list[ColumnMetadata]  # Return columns
    error: str | None = None  # If introspection failed


async def _oid_to_python_type(oid: int, conn: asyncpg.Connection) -> tuple[str, bool]:
    """Map Postgres OID to Python type string.

    Args:
        oid: Postgres type OID
        conn: Database connection for querying type info

    Returns:
        Tuple of (python_type_string, is_array)
    """
    # Check if it's a known type (array or base)
    if oid in OID_TO_PYTHON_TYPE:
        # Check if it's an array type by OID range
        # Array OIDs are typically > 1000 for common types
        is_array = oid >= 1000 and oid < 2000
        return OID_TO_PYTHON_TYPE[oid], is_array

    # Query pg_type to get type information
    try:
        type_info = await conn.fetchrow(
            """
            SELECT 
                typname,
                typarray,
                typtype
            FROM pg_type
            WHERE oid = $1
            """,
            oid,
        )
        if type_info:
            typname = type_info["typname"]
            typarray = type_info["typarray"]
            typtype = type_info["typtype"]

            # Handle enum types (typtype='e' or b'e')
            # Postgres enums are represented as strings in Python/asyncpg
            if typtype == "e" or typtype == b"e":  # enum type
                return "str", False

            # If this type has an array type (typarray != 0), it's a base type
            # If typarray is 0 and typname ends with [], it's an array type
            if typname and typname.endswith("[]"):
                # Extract base type name
                base_name = typname[:-2]
                # Map common base types to array types
                if base_name in ("text", "varchar", "char", "name", "bpchar"):
                    return "list[str]", True
                if base_name in ("int4", "integer", "int"):
                    return "list[int]", True
                if base_name in ("int8", "bigint"):
                    return "list[int]", True
                if base_name in ("int2", "smallint"):
                    return "list[int]", True
                if base_name in ("bool", "boolean"):
                    return "list[bool]", True
                if base_name == "uuid":
                    return "list[str]", True
                if base_name in ("timestamp", "timestamptz", "date", "time", "timetz"):
                    return "list[str]", True
                if base_name in ("json", "jsonb"):
                    return "list[dict[str, Any]]", True
            else:
                # Base type - map common types
                if typname in ("text", "varchar", "char", "name", "bpchar"):
                    return "str", False
                if typname in ("int4", "integer", "int"):
                    return "int", False
                if typname in ("int8", "bigint"):
                    return "int", False
                if typname in ("int2", "smallint"):
                    return "int", False
                if typname in ("bool", "boolean"):
                    return "bool", False
                if typname == "uuid":
                    return "str", False
                if typname in ("timestamp", "timestamptz", "date", "time", "timetz"):
                    return "str", False
                if typname in ("json", "jsonb"):
                    return "dict[str, Any]", False
    except Exception:
        pass

    # Fallback to Any for unknown types
    return "Any", False


async def introspect_sql_file(
    sql_path: str, conn: asyncpg.Connection
) -> SQLMetadata:
    """Introspect a SQL file to extract parameter and return types.

    Args:
        sql_path: Path to SQL file (relative to server root, e.g., "app/sql/v3/agents/create_agent_complete.sql")
        conn: Database connection for PREPARE and introspection

    Returns:
        SQLMetadata with parameter and return column information
    """
    try:
        # Load SQL file
        sql_text = load_sql(sql_path)

        # Use a unique name to avoid conflicts
        stmt_name = f"introspect_{abs(hash(sql_path)) % 1000000}"

        try:
            # Use asyncpg's prepare() directly - it handles SQL escaping properly
            # This gives us return types reliably
            stmt = await conn.prepare(sql_text)
            
            # Get return column types
            return_types: list[ColumnMetadata] = []
            attrs = stmt.get_attributes()
            for attr in attrs:
                python_type, is_array = await _oid_to_python_type(
                    attr.type.oid, conn
                )
                return_types.append(
                    ColumnMetadata(
                        name=attr.name,
                        python_type=python_type,
                        pg_oid=attr.type.oid,
                        is_array=is_array,
                    )
                )

            # For parameter types, we need to use a different approach
            # asyncpg's prepare() doesn't expose parameter types directly
            # Try to get them by executing a PREPARE statement with proper escaping
            param_types: list[ColumnMetadata] = []
            try:
                # Use dollar-quoting for PREPARE to avoid escaping issues
                dollar_tag = f"tag_{abs(hash(sql_path)) % 10000}"
                # Format: PREPARE name AS $tag$sql$tag$
                prepare_cmd = f"PREPARE {stmt_name} AS ${dollar_tag}${sql_text}${dollar_tag}$"
                await conn.execute(prepare_cmd)
                
                # Query pg_prepared_statements for parameter types
                param_rows = await conn.fetch(
                    """
                    SELECT parameter_types
                    FROM pg_prepared_statements
                    WHERE name = $1
                    LIMIT 1
                    """,
                    stmt_name,
                )
                
                if param_rows and param_rows[0]["parameter_types"]:
                    param_oids = param_rows[0]["parameter_types"]
                    for i, param_oid in enumerate(param_oids, start=1):
                        python_type, is_array = await _oid_to_python_type(
                            param_oid, conn
                        )
                        param_types.append(
                            ColumnMetadata(
                                name=f"${i}",
                                python_type=python_type,
                                pg_oid=param_oid,
                                is_array=is_array,
                            )
                        )
                
                # Clean up
                await conn.execute(f"DEALLOCATE {stmt_name}")
            except Exception:
                # If we can't get parameter types, that's okay - we still have return types
                # Parameter types can be inferred from SQL comments or left as empty
                pass

            return SQLMetadata(
                sql_path=sql_path,
                parameters=param_types,
                returns=return_types,
            )

        except Exception as e:
            # Try to clean up on error
            try:
                await conn.execute(f"DEALLOCATE {stmt_name}")
            except Exception:
                pass
            return SQLMetadata(
                sql_path=sql_path,
                parameters=[],
                returns=[],
                error=f"Failed to prepare SQL: {str(e)}",
            )

    except FileNotFoundError:
        return SQLMetadata(
            sql_path=sql_path,
            parameters=[],
            returns=[],
            error=f"SQL file not found: {sql_path}",
        )
    except Exception as e:
        return SQLMetadata(
            sql_path=sql_path,
            parameters=[],
            returns=[],
            error=f"Error loading SQL file: {str(e)}",
        )

