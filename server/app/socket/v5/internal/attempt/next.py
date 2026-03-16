"""Backwards-compat shim — canonical location is app.infra.attempt.next."""

from app.infra.attempt.next import attempt_next_internal_impl as attempt_next_internal_impl  # noqa: F401
from app.infra.attempt.next import attempt_next_handler as attempt_next_handler  # noqa: F401
