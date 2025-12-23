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


async def generate_types_for_sql_file(
    sql_path: str, conn: asyncpg.Connection, server_root: Path
) -> tuple[bool, str]:
    """Generate types for a single SQL file.

    Args:
        sql_path: SQL file path relative to server root
        conn: Database connection
        server_root: Server root directory

    Returns:
        Tuple of (success, error_message)
    """
    try:
        # Introspect SQL file
        metadata = await introspect_sql_file(sql_path, conn)

        if metadata.error:
            # For test SQL files, treat introspection errors as skips (they're often mocks/seeds)
            if sql_path.startswith("tests/sql/"):
                return True, f"Skipping {sql_path} (introspection failed: {metadata.error})"
            return False, metadata.error

        # Convert SQL path to types path
        types_info = _sql_path_to_types_path(sql_path)
        if not types_info:
            return True, f"Skipping {sql_path} (doesn't match route pattern)"

        types_path, route_name = types_info

        # Generate types
        types_content = generate_types_file(metadata, route_name)

        # Write types file to central types folder
        types_file = server_root / types_path

        # Ensure directory exists
        types_file.parent.mkdir(parents=True, exist_ok=True)

        # Write file
        types_file.write_text(types_content)

        return True, f"Generated {types_file.relative_to(server_root)}"

    except Exception as e:
        # For test SQL files, treat exceptions as skips (they're often mocks/seeds)
        if sql_path.startswith("tests/sql/"):
            return True, f"Skipping {sql_path} (error during processing: {str(e)})"
        return False, f"Error processing {sql_path}: {str(e)}"


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

        for sql_file in sorted(sql_files):
            # Get relative path from server root
            sql_path = str(sql_file.relative_to(server_root))

            success, message = await generate_types_for_sql_file(
                sql_path, conn, server_root
            )

            if success:
                if "Skipping" not in message:
                    successes.append(message)
                    print(f"✅ {message}")
                else:
                    skipped.append(sql_path)
                    print(f"⏭️  {message}")
            else:
                # Store as tuple for better grouping
                errors.append((sql_path, message))
                print(f"❌ {sql_path}: {message}")

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

