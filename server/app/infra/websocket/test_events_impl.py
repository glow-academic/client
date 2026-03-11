"""Compatibility re-export for moved test workflow logic.

The canonical test workflow implementation now lives in `app.infra.test.workflows`.
This module remains only so older imports do not break while the rest of the stack
is cleaned up.
"""

from app.infra.test.workflows import (  # noqa: F401
    test_error_impl,
    test_grade_complete_impl,
    test_group_impl,
    test_next_impl,
    test_proceed_impl,
    test_progress_impl,
    test_run_done_impl,
    test_run_impl,
    test_start_impl,
)
