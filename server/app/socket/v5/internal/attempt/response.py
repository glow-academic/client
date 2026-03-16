"""Backwards-compat shim — canonical location is app.infra.attempt.response."""

from app.infra.attempt.response import AttemptResponseInternalResult as AttemptResponseInternalResult  # noqa: F401
from app.infra.attempt.response import attempt_response_internal_impl as attempt_response_internal_impl  # noqa: F401
from app.infra.attempt.response import attempt_response_handler as attempt_response_handler  # noqa: F401
