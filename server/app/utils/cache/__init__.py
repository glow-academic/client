"""Cache utilities package."""

from collections.abc import Awaitable, Iterable
from typing import Any, Callable

# (get_cached, set_cached) — inject to enable caching, omit for no-cache.
CacheFns = tuple[
    Callable[[str], Awaitable[dict[str, Any] | None]],
    Callable[[str, dict[str, Any], int, Iterable[str]], Awaitable[None]],
]
