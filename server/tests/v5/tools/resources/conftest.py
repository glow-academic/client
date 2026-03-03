import pytest
from unittest.mock import AsyncMock, patch


@pytest.fixture(autouse=True)
def no_cache():
    with patch("app.utils.cache.get_cached.get_cached", new_callable=AsyncMock, return_value=None):
        with patch("app.utils.cache.set_cached.set_cached", new_callable=AsyncMock):
            with patch("app.utils.cache.invalidate_tags.invalidate_tags", new_callable=AsyncMock):
                yield
