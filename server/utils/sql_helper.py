"""SQL helper utility - DHH-style SQL file loading.

Routes have full control over transaction and execution.
This follows DHH principles - route owns the execution.
"""

from pathlib import Path


def load_sql(file_path: str) -> str:
    """Load SQL file content and return as string.

    Routes have full control over transaction and execution.
    This follows DHH principles - route owns the execution.

    Supports both app/sql/ and tests/sql/ paths.

    Args:
        file_path: Relative path from server root (e.g., "app/sql/v3/profile/get_profile.sql" or "tests/sql/integration/infra/activity/insert_test_profile.sql")

    Returns:
        SQL string with parameter placeholders ($1, $2, etc.)
    """
    sql_path = Path(__file__).parent.parent / file_path
    return sql_path.read_text()

