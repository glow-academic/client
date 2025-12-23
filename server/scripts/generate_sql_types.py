#!/usr/bin/env python3
"""Generate Python type files from SQL introspection.

Walks all SQL files, introspects them, and generates Pydantic models
for request/response types.
"""

import asyncio
import os
import re
import sys
from pathlib import Path

import asyncpg  # type: ignore

# Add server directory to path for imports
server_dir = Path(__file__).parent.parent
sys.path.insert(0, str(server_dir))

from scripts.sql_introspect import introspect_sql_file
from scripts.sql_typegen import generate_types_file


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


def _sql_path_to_types_path(sql_path: str) -> tuple[str, str] | None:
    """Convert SQL file path to types file path and route name.

    Example:
        "app/sql/v3/agents/create_agent_complete.sql" ->
        ("app/types/v3/agents/create_agent.py", "create_agent")
        
        "tests/sql/integration/infra/activity/insert_test_profile.sql" ->
        ("tests/types/integration/infra/activity/insert_test_profile.py", "insert_test_profile")

    Args:
        sql_path: SQL file path relative to server root

    Returns:
        Tuple of (types_file_path, route_name) or None if pattern doesn't match
    """
    # Pattern: app/sql/v3/[resource]/[operation]_complete.sql
    # -> app/types/v3/[resource]/[operation]_complete.py
    if sql_path.startswith("app/sql/v3/"):
        # Remove prefix and replace sql with types
        relative = sql_path[len("app/sql/v3/") :]

        # Split into resource and filename
        parts = relative.split("/")
        if len(parts) != 2:
            return None

        resource, filename = parts

        # Remove _complete.sql suffix
        if not filename.endswith("_complete.sql"):
            return None

        operation = filename[: -len("_complete.sql")]

        # Build types path
        types_path = f"app/types/v3/{resource}/{operation}_complete.py"
        # Route name is just the operation (resource is already in the path)
        route_name = operation.replace("-", "_")

        return types_path, route_name
    
    # Pattern: tests/sql/integration/infra/[resource]/[operation].sql
    # -> tests/types/integration/infra/[resource]/[operation].py
    if sql_path.startswith("tests/sql/integration/infra/"):
        # Remove prefix and replace sql with types
        relative = sql_path[len("tests/sql/integration/infra/") :]

        # Split into resource and filename
        parts = relative.split("/")
        if len(parts) != 2:
            return None

        resource, filename = parts

        # Remove .sql suffix
        if not filename.endswith(".sql"):
            return None

        operation = filename[: -len(".sql")]

        # Build types path
        types_path = f"tests/types/integration/infra/{resource}/{operation}.py"
        # Route name is just the operation (resource is already in the path)
        route_name = operation.replace("-", "_")

        return types_path, route_name
    
    # Pattern: tests/sql/integration/socket/[operation].sql
    # -> tests/types/integration/socket/[operation].py
    if sql_path.startswith("tests/sql/integration/socket/"):
        # Remove prefix and replace sql with types
        relative = sql_path[len("tests/sql/integration/socket/") :]

        # Remove .sql suffix
        if not relative.endswith(".sql"):
            return None

        operation = relative[: -len(".sql")]

        # Build types path
        types_path = f"tests/types/integration/socket/{operation}.py"
        # Route name is just the operation
        route_name = operation.replace("-", "_")

        return types_path, route_name

    return None


def generate_registry_entry(
    sql_path: str, types_path: str, route_name: str
) -> tuple[str, str, str, str, str, str, str] | None:
    """Generate registry entry for a SQL file.

    Args:
        sql_path: SQL file path (e.g., "app/sql/v3/agents/get_agent_new_complete.sql")
        types_path: Types file path (e.g., "app/types/v3/agents/get_agent_new_complete.py")
        route_name: Route name (e.g., "get_agent_new")

    Returns:
        Tuple of (registry_type, sql_path, module_path, sql_params_class, sql_row_class, api_request_class, api_response_class) or None if invalid
        registry_type is either "app" or "test"
    """
    # Process app/sql/v3/ files
    if sql_path.startswith("app/sql/v3/"):
        # Convert types_path to module path (remove .py, replace / with .)
        module_path = types_path.replace(".py", "").replace("/", ".")

        # Generate class names
        sql_params_class = _to_class_name(route_name, "SqlParams")
        sql_row_class = _to_class_name(route_name, "SqlRow")
        api_request_class = _to_class_name(route_name, "ApiRequest")
        api_response_class = _to_class_name(route_name, "ApiResponse")

        return ("app", sql_path, module_path, sql_params_class, sql_row_class, api_request_class, api_response_class)
    
    # Process test SQL files
    if sql_path.startswith("tests/sql/integration/"):
        # Convert types_path to module path (remove .py, replace / with .)
        module_path = types_path.replace(".py", "").replace("/", ".")

        # Generate class names
        sql_params_class = _to_class_name(route_name, "SqlParams")
        sql_row_class = _to_class_name(route_name, "SqlRow")
        api_request_class = _to_class_name(route_name, "ApiRequest")
        api_response_class = _to_class_name(route_name, "ApiResponse")

        return ("test", sql_path, module_path, sql_params_class, sql_row_class, api_request_class, api_response_class)
    
    return None


def write_registry_file(
    registry_entries: list[tuple[str, str, str, str, str, str, str]], registry_type: str, server_root: Path
) -> None:
    """Write registry file mapping SQL paths to type classes.

    Args:
        registry_entries: List of (registry_type, sql_path, module_path, sql_params_class, sql_row_class, api_request_class, api_response_class) tuples
        registry_type: Either "app" or "test"
        server_root: Server root directory
    """
    if registry_type == "app":
        registry_file = server_root / "app" / "types" / "registry.py"
    else:
        registry_file = server_root / "tests" / "types" / "registry.py"

    lines = [
        '"""Registry mapping SQL file paths to their generated type classes.',
        "",
        "Auto-generated by sql-compile. Do not edit manually.",
        '"""',
        "",
        "from pathlib import Path",
        "from typing import TYPE_CHECKING, Literal, Type, TypeVar, overload",
        "",
        "from pydantic import BaseModel",
        "",
        "# Type variables for generic return types",
        "TInput = TypeVar(\"TInput\", bound=BaseModel)",
        "TOutput = TypeVar(\"TOutput\", bound=BaseModel)",
        "",
        "# Type alias for SQL strings loaded from files (semantic clarity)",
        "SqlString = str",
        "",
        "if TYPE_CHECKING:",
    ]

    # Add TYPE_CHECKING imports for all types (for type checkers)
    # registry_entries is (registry_type, sql_path, module_path, sql_params_class, sql_row_class, api_request_class, api_response_class)
    for _, sql_path, module_path, sql_params_class, sql_row_class, api_request_class, api_response_class in sorted(registry_entries, key=lambda x: x[1]):
        lines.append(f"    from {module_path} import {sql_params_class}, {sql_row_class}, {api_request_class}, {api_response_class}")

    lines.append("")
    lines.append("")
    lines.append("_registry: dict[str, tuple[str, str, str, str, str]] = {")

    # Add registry entries
    # registry_entries is (registry_type, sql_path, module_path, sql_params_class, sql_row_class, api_request_class, api_response_class)
    for _, sql_path, module_path, sql_params_class, sql_row_class, api_request_class, api_response_class in sorted(registry_entries, key=lambda x: x[1]):
        lines.append(f'    "{sql_path}": (')
        lines.append(f'        "{module_path}",')
        lines.append(f'        "{sql_params_class}",')
        lines.append(f'        "{sql_row_class}",')
        lines.append(f'        "{api_request_class}",')
        lines.append(f'        "{api_response_class}",')
        lines.append("    ),")

    lines.append("}")
    lines.append("")
    lines.append("")
    lines.append("def get_sql_types(sql_path: str) -> tuple[Type[BaseModel], Type[BaseModel]]:")
    lines.append('    """Get SQL input and output types for a SQL file path.')
    lines.append("    ")
    lines.append("    Uses lazy imports to avoid loading all types at startup.")
    lines.append('    """')
    lines.append('    if sql_path not in _registry:')
    lines.append('        raise ValueError(f"No types found for SQL path: {sql_path}")')
    lines.append("    ")
    lines.append("    module_path, sql_params_class, sql_row_class, _, _ = _registry[sql_path]")
    lines.append("    ")
    lines.append("    # Dynamic import")
    lines.append("    import importlib")
    lines.append("    module = importlib.import_module(module_path)")
    lines.append("    sql_params_type = getattr(module, sql_params_class)")
    lines.append("    sql_row_type = getattr(module, sql_row_class)")
    lines.append("    ")
    lines.append("    return sql_params_type, sql_row_type")
    lines.append("")
    lines.append("")
    lines.append("def get_api_types(sql_path: str) -> tuple[Type[BaseModel], Type[BaseModel]]:")
    lines.append('    """Get API request and response types for a SQL file path.')
    lines.append("    ")
    lines.append("    Uses lazy imports to avoid loading all types at startup.")
    lines.append('    """')
    lines.append('    if sql_path not in _registry:')
    lines.append('        raise ValueError(f"No types found for SQL path: {sql_path}")')
    lines.append("    ")
    lines.append("    module_path, _, _, api_request_class, api_response_class = _registry[sql_path]")
    lines.append("    ")
    lines.append("    # Dynamic import")
    lines.append("    import importlib")
    lines.append("    module = importlib.import_module(module_path)")
    lines.append("    api_request_type = getattr(module, api_request_class)")
    lines.append("    api_response_type = getattr(module, api_response_class)")
    lines.append("    ")
    lines.append("    return api_request_type, api_response_type")
    lines.append("")
    lines.append("")
    lines.append("# Overload declarations for load_sql_typed() - provides strong type hints")
    lines.append("# Auto-generated by sql-compile. Do not edit manually.")
    lines.append("if TYPE_CHECKING:")
    
    # Generate overload declarations for each SQL file
    # registry_entries is (registry_type, sql_path, module_path, sql_params_class, sql_row_class, api_request_class, api_response_class)
    for _, sql_path, module_path, sql_params_class, sql_row_class, api_request_class, api_response_class in sorted(registry_entries, key=lambda x: x[1]):
        lines.append("    @overload")
        lines.append("    def load_sql_typed(")
        lines.append(f'        file_path: Literal["{sql_path}"]')
        lines.append(f"    ) -> tuple[SqlString, Type[{sql_params_class}], Type[{sql_row_class}]]: ...")
        lines.append("")
    
    # Add fallback overload for any string (for runtime compatibility)
    lines.append("    @overload")
    lines.append("    def load_sql_typed(")
    lines.append("        file_path: str")
    lines.append("    ) -> tuple[SqlString, Type[BaseModel], Type[BaseModel]]: ...")
    lines.append("")
    lines.append("")
    lines.append("def load_sql_typed(")
    lines.append("    file_path: str,")
    lines.append(") -> tuple[SqlString, Type[TInput], Type[TOutput]]:")
    lines.append('    """Load SQL file content and return SQL string with typed input/output classes.')
    lines.append("")
    lines.append("    Returns the SQL string along with the generated Pydantic model classes for")
    lines.append("    input parameters and output rows. Types are loaded from the registry generated")
    lines.append("    by sql-compile.")
    lines.append("")
    lines.append("    The overloads provide strong type hints - when you use a literal string path,")
    lines.append("    the IDE will know the exact InputType and OutputType classes, including their fields.")
    lines.append("    To see the fields in your IDE, hover over `InputType(...)` when creating an instance,")
    lines.append("    or access `InputType.model_fields` (Pydantic v2) to see all field definitions.")
    lines.append("")
    lines.append("    Args:")
    lines.append('        file_path: Relative path from server root (e.g., "app/sql/v3/agents/get_agent_new_complete.sql")')
    lines.append("")
    lines.append("    Returns:")
    lines.append("        Tuple of (sql_string, InputType, OutputType) where:")
    lines.append("        - sql_string: SQL string with parameter placeholders ($1, $2, etc.)")
    lines.append("        - InputType: Pydantic model class for input parameters (e.g., GetAgentNewSqlParams)")
    lines.append("          Use `InputType(...)` to create an instance and see field autocomplete")
    lines.append("        - OutputType: Pydantic model class for output rows (e.g., GetAgentNewSqlRow)")
    lines.append("          Use `OutputType(**dict(row))` to create an instance and see field types")
    lines.append("")
    lines.append("    Raises:")
    lines.append("        ValueError: If no types are found for the SQL file path")
    lines.append("        ImportError: If the type classes cannot be imported")
    lines.append("")
    lines.append("    Example:")
    lines.append('        ```python')
    if registry_type == "app":
        lines.append('        sql, InputType, OutputType = load_sql_typed("app/sql/v3/agents/get_agent_new_complete.sql")')
    else:
        lines.append('        sql, InputType, OutputType = load_sql_typed("tests/sql/integration/infra/activity/insert_test_profile.sql")')
    lines.append("        ")
    lines.append("        # Type-safe usage - IDE will show fields when you type InputType(...)")
    lines.append('        params = InputType(profile_id="...")  # Hover here to see fields')
    lines.append("        result = await conn.fetchrow(sql, *params.to_tuple())")
    lines.append('        typed_result = OutputType(**dict(result))  # Hover here to see fields')
    lines.append("        ```")
    lines.append('    """')
    lines.append("    # Import here to avoid circular imports")
    lines.append("    from utils.sql_helper import load_sql")
    lines.append("")
    lines.append("    # Load SQL string")
    lines.append("    sql_string = load_sql(file_path)")
    lines.append("")
    lines.append("    # Get types from registry")
    lines.append("    input_type, output_type = get_sql_types(file_path)")
    lines.append("    return sql_string, input_type, output_type")
    lines.append("")
    lines.append("")
    lines.append("# Overload declarations for load_api_types() - provides strong type hints")
    lines.append("# Auto-generated by sql-compile. Do not edit manually.")
    lines.append("if TYPE_CHECKING:")
    
    # Generate overload declarations for each SQL file
    # registry_entries is (registry_type, sql_path, module_path, sql_params_class, sql_row_class, api_request_class, api_response_class)
    for _, sql_path, module_path, sql_params_class, sql_row_class, api_request_class, api_response_class in sorted(registry_entries, key=lambda x: x[1]):
        lines.append("    @overload")
        lines.append("    def load_api_types(")
        lines.append(f'        file_path: Literal["{sql_path}"]')
        lines.append(f"    ) -> tuple[Type[{api_request_class}], Type[{api_response_class}]]: ...")
        lines.append("")
    
    # Add fallback overload for any string (for runtime compatibility)
    lines.append("    @overload")
    lines.append("    def load_api_types(")
    lines.append("        file_path: str")
    lines.append("    ) -> tuple[Type[BaseModel], Type[BaseModel]]: ...")
    lines.append("")
    lines.append("")
    lines.append("def load_api_types(")
    lines.append("    file_path: str,")
    lines.append(") -> tuple[Type[TInput], Type[TOutput]]:")
    lines.append('    """Load API request and response types for a SQL file path.')
    lines.append("")
    lines.append("    Returns the generated Pydantic model classes for API request and response.")
    lines.append("    API request excludes profile_id (obtained from request header).")
    lines.append("    API response matches SQL response structure (can be customized later).")
    lines.append("")
    lines.append("    The overloads provide strong type hints - when you use a literal string path,")
    lines.append("    the IDE will know the exact ApiRequestType and ApiResponseType classes.")
    lines.append("")
    lines.append("    Args:")
    lines.append('        file_path: Relative path from server root (e.g., "app/sql/v3/agents/get_agent_new_complete.sql")')
    lines.append("")
    lines.append("    Returns:")
    lines.append("        Tuple of (ApiRequestType, ApiResponseType) where:")
    lines.append("        - ApiRequestType: Pydantic model class for API request (e.g., GetAgentNewApiRequest)")
    lines.append("          Excludes profile_id field")
    lines.append("        - ApiResponseType: Pydantic model class for API response (e.g., GetAgentNewApiResponse)")
    lines.append("")
    lines.append("    Raises:")
    lines.append("        ValueError: If no types are found for the SQL file path")
    lines.append("        ImportError: If the type classes cannot be imported")
    lines.append("")
    lines.append("    Example:")
    lines.append('        ```python')
    if registry_type == "app":
        lines.append('        ApiRequestType, ApiResponseType = load_api_types("app/sql/v3/agents/get_agent_new_complete.sql")')
    else:
        lines.append('        ApiRequestType, ApiResponseType = load_api_types("tests/sql/integration/infra/activity/insert_test_profile.sql")')
    lines.append("        ")
    lines.append("        # Type-safe usage - IDE will show fields when you type ApiRequestType(...)")
    lines.append('        request = ApiRequestType(...)  # No profile_id field')
    lines.append('        response = ApiResponseType(...)  # Same structure as SQL response')
    lines.append("        ```")
    lines.append('    """')
    lines.append("    # Get types from registry")
    lines.append("    api_request_type, api_response_type = get_api_types(file_path)")
    lines.append("    return api_request_type, api_response_type")

    registry_file.write_text("\n".join(lines))


async def generate_types_for_sql_file(
    sql_path: str, conn: asyncpg.Connection, server_root: Path
) -> tuple[bool, str, tuple[str, str, str, str, str] | None]:
    """Generate types for a single SQL file.

    Args:
        sql_path: SQL file path relative to server root
        conn: Database connection
        server_root: Server root directory

    Returns:
        Tuple of (success, error_message, registry_entry)
    """
    try:
        # Introspect SQL file
        metadata = await introspect_sql_file(sql_path, conn)

        if metadata.error:
            # For test SQL files, treat introspection errors as skips (they're often mocks/seeds)
            if sql_path.startswith("tests/sql/"):
                return True, f"Skipping {sql_path} (introspection failed: {metadata.error})", None
            return False, metadata.error, None

        # Convert SQL path to types path
        types_info = _sql_path_to_types_path(sql_path)
        if not types_info:
            return True, f"Skipping {sql_path} (doesn't match route pattern)", None

        types_path, route_name = types_info

        # Generate types
        types_content = generate_types_file(metadata, route_name)

        # Write types file to central types folder
        types_file = server_root / types_path

        # Ensure directory exists
        types_file.parent.mkdir(parents=True, exist_ok=True)

        # Write file
        types_file.write_text(types_content)

        # Generate registry entry
        registry_entry = generate_registry_entry(sql_path, types_path, route_name)

        return True, f"Generated {types_file.relative_to(server_root)}", registry_entry

    except Exception as e:
        # For test SQL files, treat exceptions as skips (they're often mocks/seeds)
        if sql_path.startswith("tests/sql/"):
            return True, f"Skipping {sql_path} (error during processing: {str(e)})", None
        return False, f"Error processing {sql_path}: {str(e)}", None


async def main() -> int:
    """Main entry point."""
    # Get database connection info from environment
    db_user = os.getenv("DB_USER", "myuser")
    db_password = os.getenv("DB_PASSWORD", "mypassword")
    db_name = os.getenv("DB_NAME", "mydb")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", "5432"))

    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    # Get server root
    server_root = Path(__file__).parent.parent

    # Find all SQL files from both app and tests directories
    sql_files: list[Path] = []
    
    # Process app/sql/v3/
    app_sql_dir = server_root / "app" / "sql" / "v3"
    if app_sql_dir.exists():
        sql_files.extend(app_sql_dir.rglob("*.sql"))
    
    # Process tests/sql/integration/ (all subdirectories)
    tests_sql_dir = server_root / "tests" / "sql" / "integration"
    if tests_sql_dir.exists():
        sql_files.extend(tests_sql_dir.rglob("*.sql"))
    
    if not sql_files:
        print(f"⚠️  No SQL files found in {app_sql_dir} or {tests_sql_dir}")
        return 0

    print(f"🔍 Found {len(sql_files)} SQL files to process")

    # Connect to database
    try:
        conn = await asyncpg.connect(db_url)
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        print(f"   URL: postgresql://{db_user}:***@{db_host}:{db_port}/{db_name}")
        return 1

    try:
        # Process each SQL file
        errors: list[tuple[str, str]] = []  # (sql_path, error_message)
        successes: list[str] = []
        skipped: list[str] = []
        registry_entries: list[tuple[str, str, str, str, str]] = []  # (registry_type, sql_path, module_path, input_class_name, output_class_name)

        for sql_file in sorted(sql_files):
            # Get relative path from server root
            sql_path = str(sql_file.relative_to(server_root))

            success, message, registry_entry = await generate_types_for_sql_file(
                sql_path, conn, server_root
            )

            if success:
                if "Skipping" not in message:
                    successes.append(message)
                    print(f"✅ {message}")
                    # Collect registry entry if available
                    if registry_entry:
                        registry_entries.append(registry_entry)
                else:
                    skipped.append(sql_path)
                    print(f"⏭️  {message}")
            else:
                # Store as tuple for better grouping
                errors.append((sql_path, message))
                print(f"❌ {sql_path}: {message}")

        # Separate app and test registry entries
        app_registry_entries = [e for e in registry_entries if e[0] == "app"]
        test_registry_entries = [e for e in registry_entries if e[0] == "test"]
        
        # Write app registry file if we have entries
        if app_registry_entries:
            write_registry_file(app_registry_entries, "app", server_root)
            print(f"✅ Generated app/types/registry.py with {len(app_registry_entries)} entries")
        
        # Write test registry file if we have entries
        if test_registry_entries:
            write_registry_file(test_registry_entries, "test", server_root)
            print(f"✅ Generated tests/types/registry.py with {len(test_registry_entries)} entries")

        # Summary
        print(f"\n📊 Summary:")
        print(f"   ✅ Generated: {len(successes)}")
        print(f"   ⏭️  Skipped: {len(skipped)}")
        print(f"   ❌ Errors: {len(errors)}")

        if errors:
            # Group errors by error message to identify patterns
            error_groups: dict[str, list[str]] = {}
            for sql_path, error_msg in errors:
                # Extract the core error (remove file-specific details)
                # Common patterns: function doesn't exist, relation doesn't exist, syntax error
                core_error = error_msg
                # Normalize error messages for grouping
                if "does not exist" in error_msg:
                    # Extract the object name (function, relation, column)
                    if "function" in error_msg:
                        # Extract function name
                        match = re.search(r"function (\w+)\([^)]+\) does not exist", error_msg)
                        if match:
                            core_error = f"function {match.group(1)} does not exist"
                    elif "relation" in error_msg:
                        match = re.search(r'relation "([^"]+)" does not exist', error_msg)
                        if match:
                            core_error = f'relation "{match.group(1)}" does not exist'
                    elif "column" in error_msg:
                        match = re.search(r'column "([^"]+)" (?:of relation "[^"]+" )?does not exist', error_msg)
                        if match:
                            core_error = f'column "{match.group(1)}" does not exist'
                elif "syntax error" in error_msg:
                    # Extract the location of syntax error
                    match = re.search(r'syntax error at or near "([^"]+)"', error_msg)
                    if match:
                        core_error = f'syntax error at or near "{match.group(1)}"'
                elif "cannot insert multiple commands" in error_msg:
                    core_error = "cannot insert multiple commands into a prepared statement"
                elif "could not determine data type" in error_msg:
                    core_error = "could not determine data type of parameter"
                
                if core_error not in error_groups:
                    error_groups[core_error] = []
                error_groups[core_error].append(sql_path)

            # Sort error groups by count (most common first)
            sorted_groups = sorted(error_groups.items(), key=lambda x: len(x[1]), reverse=True)

            print("\n❌ SQL compilation failed. Errors grouped by type:")
            print()
            
            for core_error, files in sorted_groups:
                count = len(files)
                print(f"   {core_error} ({count} file{'s' if count > 1 else ''}):")
                # Show all files for this error type
                for file_path in sorted(files):
                    print(f"      - {file_path}")
                print()

            return 1

        print("\n✅ SQL compilation complete!")
        return 0

    finally:
        await conn.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

