"""Integration tests for app.infra.v4.evals.run_eval_worker."""

import pytest

from app.infra.v4.evals.run_eval_worker import run_eval_parallel

pytestmark = pytest.mark.asyncio


class TestRunEvalWorker:
    """Tests for run_eval_parallel function."""

    async def test_run_eval_parallel_structure(self) -> None:
        """Test run_eval_parallel function exists and is callable."""
        assert callable(run_eval_parallel)
