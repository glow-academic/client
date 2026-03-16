"""Backwards-compat shim — canonical location is app.infra.attempt.stop."""

from app.infra.attempt.stop import AttemptStopInternalResult as AttemptStopInternalResult  # noqa: F401
from app.infra.attempt.stop import attempt_stop_internal_impl as attempt_stop_internal_impl  # noqa: F401
from app.infra.attempt.stop import attempt_stop_handler as attempt_stop_handler  # noqa: F401
