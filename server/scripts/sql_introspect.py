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
    # Float types
    700: "float",  # REAL (FLOAT4)
    701: "float",  # DOUBLE PRECISION (FLOAT8)
    1700: "float",  # NUMERIC
    # Text types
    25: "str",  # TEXT
    1043: "str",  # VARCHAR
    1042: "str",  # CHAR
    # UUID - use uuid.UUID for strong typing
    2950: "UUID",  # UUID (use uuid.UUID for strong typing)
    2951: "list[UUID]",  # UUID[] (use list[uuid.UUID] for strong typing)
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
    1034: "list[UUID]",  # UUID[] (use list[uuid.UUID] for strong typing)
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
    is_optional: bool = False  # For parameters: whether field is optional (nullable)
    default_value: str | None = None  # For parameters: default value expression (e.g., "[]", "None")


@dataclass
class SQLMetadata:
    """Metadata extracted from a SQL file."""

    sql_path: str
    parameters: list[ColumnMetadata]  # Ordered $1, $2, ...
    returns: list[ColumnMetadata]  # Return columns
    error: str | None = None  # If introspection failed


def _parse_atparams_block(sql_text: str) -> dict[int, dict[str, Any]]:
    """Parse @params block for parameter metadata.
    
    Parses:
    -- @params
    --   name: text
    --   prompt_id?: uuid
    --   department_ids: uuid[] = {}
    
    Returns dict mapping param index to {name, type, optional, default}
    """
    import re
    
    param_metadata: dict[int, dict[str, Any]] = {}
    
    # Find @params block
    atparams_pattern = r'--\s*@params\s*\n((?:--\s+.*\n)*)'
    match = re.search(atparams_pattern, sql_text, re.IGNORECASE | re.MULTILINE)
    
    if not match:
        return param_metadata
    
    params_block = match.group(1)
    
    # Extract parameter definitions: name: type, name?: type, name: type = default
    param_line_pattern = r'--\s+(\w+)(\?)?:\s+(\S+)(?:\s*=\s*(.+))?'
    
    param_index = 1
    for line_match in re.finditer(param_line_pattern, params_block, re.IGNORECASE):
        param_name = line_match.group(1)
        is_optional = line_match.group(2) == '?'
        param_type = line_match.group(3)
        default_value = line_match.group(4) if line_match.group(4) else None
        
        param_metadata[param_index] = {
            'name': param_name,
            'type': param_type,
            'optional': is_optional,
            'default': default_value,
        }
        param_index += 1
    
    return param_metadata


def _extract_param_names_from_params_cte(sql_text: str) -> dict[int, str]:
    """Extract parameter names from params CTE column aliases or comments.
    
    First tries to extract from params CTE pattern: WITH params AS (SELECT $1::type AS name, ...)
    Falls back to parsing comments: -- Parameters: $1=name (type), $2=name2 (type), ...
    
    Args:
        sql_text: SQL query text
        
    Returns:
        Dict mapping parameter index to name (e.g., {1: "name", 2: "description"})
    """
    import re
    
    param_names: dict[int, str] = {}
    
    # First, try to extract from params CTE
    params_cte_pattern = r'WITH\s+params\s+AS\s*\(\s*SELECT\s+(.*?)\s*\)\s*,'
    match = re.search(params_cte_pattern, sql_text, re.IGNORECASE | re.DOTALL)
    
    if match:
        select_clause = match.group(1)
        
        # Split by commas to get individual column definitions
        # But be careful of commas inside function calls
        columns = []
        current_col = ""
        paren_depth = 0
        for char in select_clause:
            if char == '(':
                paren_depth += 1
                current_col += char
            elif char == ')':
                paren_depth -= 1
                current_col += char
            elif char == ',' and paren_depth == 0:
                columns.append(current_col.strip())
                current_col = ""
            else:
                current_col += char
        if current_col.strip():
            columns.append(current_col.strip())
        
        # Extract parameter number and alias from each column
        for col in columns:
            # Find the AS keyword and extract the alias
            as_match = re.search(r'\s+AS\s+(\w+)', col, re.IGNORECASE)
            if not as_match:
                continue
            
            param_name = as_match.group(1)
            
            # Find the parameter number ($N)
            param_match = re.search(r'\$(\d+)', col)
            if param_match:
                param_index = int(param_match.group(1))
                param_names[param_index] = param_name
    
    # If no params CTE found, try parsing from comments
    if not param_names:
        # Pattern: -- Parameters: $1=name (type), $2=name2 (type), ...
        comment_pattern = r'--\s*Parameters?:\s*(.*?)(?:\n|$)'
        comment_match = re.search(comment_pattern, sql_text, re.IGNORECASE | re.MULTILINE)
        if comment_match:
            params_line = comment_match.group(1)
            # Extract $N=name patterns
            param_pattern = r'\$(\d+)\s*=\s*(\w+)'
            for param_match in re.finditer(param_pattern, params_line):
                param_index = int(param_match.group(1))
                param_name = param_match.group(2)
                param_names[param_index] = param_name
    
    return param_names


def _detect_nullable_columns(sql_text: str, column_names: list[str]) -> set[str]:
    """Detect columns that can be NULL based on SQL patterns.
    
    Checks for:
    1. COALESCE(column, NULL) patterns - redundant COALESCE that still allows NULL
    2. LEFT JOIN patterns - columns from LEFT JOINed tables can be NULL
    
    Args:
        sql_text: SQL query text
        column_names: List of column names from introspection
        
    Returns:
        Set of column names that are nullable
    """
    nullable_columns: set[str] = set()
    sql_upper = sql_text.upper()
    
    # Pattern 1: Detect COALESCE(..., NULL) patterns
    # This is redundant and indicates the field can be NULL
    import re
    # Match: COALESCE(column, NULL) or COALESCE(alias.column, NULL) ... AS column_name
    # Look for the full pattern including the AS clause to match column names accurately
    coalesce_null_pattern = r'COALESCE\s*\(\s*([\w.]+)\s*,\s*NULL\s*\)[^,]*?\s+AS\s+(\w+)'
    matches = re.finditer(coalesce_null_pattern, sql_text, re.IGNORECASE)
    for match in matches:
        # Extract the column name from the AS clause
        as_column_name = match.group(2).lower()
        # Check if this matches any of our column names
        for col_name in column_names:
            if as_column_name == col_name.lower():
                nullable_columns.add(col_name)
                break
    
    # Also check for COALESCE patterns without explicit AS (fallback)
    # Match: COALESCE(column, NULL) or COALESCE(alias.column, NULL)
    coalesce_null_pattern_fallback = r'COALESCE\s*\(\s*([\w.]+)\s*,\s*NULL\s*\)'
    matches_fallback = re.finditer(coalesce_null_pattern_fallback, sql_upper, re.IGNORECASE)
    for match in matches_fallback:
        # Extract column reference (could be alias.column or just column)
        column_ref = match.group(1).lower()
        # Try to match against column names (handle aliases)
        for col_name in column_names:
            # Check if column_ref matches the column name or ends with it
            if column_ref == col_name.lower() or column_ref.endswith('.' + col_name.lower()):
                nullable_columns.add(col_name)
    
    # Pattern 2: Detect LEFT JOIN patterns
    # Find all LEFT JOINs and extract table aliases
    left_join_pattern = r'LEFT\s+JOIN\s+[\w.]+\s+(\w+)'
    left_join_matches = re.finditer(left_join_pattern, sql_upper, re.IGNORECASE)
    left_join_aliases: set[str] = set()
    for match in left_join_matches:
        alias = match.group(1).lower()
        left_join_aliases.add(alias)
    
    # Check if columns come from LEFT JOINed tables
    # Look for column references like alias.column in SELECT clause
    select_pattern = r'SELECT\s+(.*?)(?:\s+FROM|\s+WHERE|\s+ORDER|\s+GROUP|\Z)'
    select_match = re.search(select_pattern, sql_text, re.IGNORECASE | re.DOTALL)
    if select_match:
        select_clause = select_match.group(1)
        # Find column references with aliases
        for col_name in column_names:
            # Look for patterns like "alias.column AS column_name" or "alias.column::type AS column_name"
            # Also check for direct references in COALESCE
            col_ref_pattern = rf'(\w+)\.{re.escape(col_name.lower())}'
            col_matches = re.finditer(col_ref_pattern, select_clause, re.IGNORECASE)
            for col_match in col_matches:
                alias = col_match.group(1).lower()
                if alias in left_join_aliases:
                    nullable_columns.add(col_name)
    
    return nullable_columns


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
                    return "list[UUID]", True
                if base_name in ("timestamp", "timestamptz", "date", "time", "timetz"):
                    return "list[str]", True
                if base_name in ("json", "jsonb"):
                    return "list[dict[str, Any]]", True
                if base_name in ("float4", "real"):
                    return "list[float]", True
                if base_name in ("float8", "double precision"):
                    return "list[float]", True
                if base_name == "numeric":
                    return "list[float]", True
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
                    return "UUID", False
                if typname in ("timestamp", "timestamptz", "date", "time", "timetz"):
                    return "str", False
                if typname in ("json", "jsonb"):
                    return "dict[str, Any]", False
                if typname in ("float4", "real"):
                    return "float", False
                if typname in ("float8", "double precision"):
                    return "float", False
                if typname == "numeric":
                    return "float", False
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
            column_names = [attr.name for attr in attrs]
            
            # Detect nullable columns from SQL patterns
            nullable_columns = _detect_nullable_columns(sql_text, column_names)
            
            for attr in attrs:
                python_type, is_array = await _oid_to_python_type(
                    attr.type.oid, conn
                )
                is_optional = attr.name in nullable_columns
                return_types.append(
                    ColumnMetadata(
                        name=attr.name,
                        python_type=python_type,
                        pg_oid=attr.type.oid,
                        is_array=is_array,
                        is_optional=is_optional,
                    )
                )

            # Get parameter types from asyncpg's prepared statement
            # asyncpg's prepare() exposes parameter types via get_parameters()
            param_types: list[ColumnMetadata] = []
            try:
                # Parse @params block (primary source of truth for names, optionality, defaults)
                atparams_metadata = _parse_atparams_block(sql_text)
                
                # Fallback: extract parameter names from params CTE or comments
                param_names = _extract_param_names_from_params_cte(sql_text)
                
                param_type_objs = stmt.get_parameters()
                if param_type_objs:
                    for i, param_type_obj in enumerate(param_type_objs, start=1):
                        python_type, is_array = await _oid_to_python_type(
                            param_type_obj.oid, conn
                        )
                        
                        # Get metadata from @params block if available
                        if i in atparams_metadata:
                            meta = atparams_metadata[i]
                            param_name = meta['name']
                            is_optional = meta['optional']
                            default_value = meta['default']
                        else:
                            # Fallback to CTE/comment parsing
                            param_name = param_names.get(i, f"${i}")
                            is_optional = False
                            default_value = None
                        
                        param_types.append(
                            ColumnMetadata(
                                name=param_name,
                                python_type=python_type,
                                pg_oid=param_type_obj.oid,
                                is_array=is_array,
                                is_optional=is_optional,
                                default_value=default_value,
                            )
                        )
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

