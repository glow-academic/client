"""Backwards-compat shim — canonical location is app.infra.attempt.message."""

from app.infra.attempt.message import AttemptMessageInternalResult as AttemptMessageInternalResult  # noqa: F401
from app.infra.attempt.message import attempt_message_internal_impl as attempt_message_internal_impl  # noqa: F401
from app.infra.attempt.message import attempt_message_handler as attempt_message_handler  # noqa: F401
