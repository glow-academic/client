"""Backwards-compat shim — canonical location is app.infra.attempt.grade."""

from app.infra.attempt.grade import AttemptGradeInternalResult as AttemptGradeInternalResult  # noqa: F401
from app.infra.attempt.grade import attempt_grade_internal_impl as attempt_grade_internal_impl  # noqa: F401
from app.infra.attempt.grade import attempt_grade_handler as attempt_grade_handler  # noqa: F401
