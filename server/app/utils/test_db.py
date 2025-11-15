"""Test database utilities."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - runtime import happens lazily
    pass  # type: ignore


def get_test_db_url() -> str | None:
    """Get the test database connection URL (for test fixtures).

    Returns None if not in test mode or container not started.
    """
    from app.main import _test_container

    if _test_container is None:
        return None
    raw_url = _test_container.get_connection_url()
    return raw_url.replace("postgresql+psycopg2://", "postgresql://")  # type: ignore
