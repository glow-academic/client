"""Pydantic models for test-domain internal bus emits.

Each model represents a dict payload passed to ``internal_sio.emit()``.
Construct the model, then call ``.model_dump(mode="json")``
before sending via internal_sio.emit(..., model.model_dump(mode="json")).
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class TestProgressData(BaseModel):
    type: str = "progress"
    sid: str | None = None
    invocation_id: str
    run_id: str | None = None
    current_run: int | None = None
    total_runs: int | None = None
    message: str | None = None


class TestRunCompleteData(BaseModel):
    type: str = "run_complete"
    sid: str | None = None
    invocation_id: str
    run_id: str | None = None
    original_run_resource_id: str | None = None
    tool_calls: Any | None = None
    current_run: int = 1
    total_runs: int = 1
    remaining_runs: int = 0


class TestGradedData(BaseModel):
    type: str = "graded"
    sid: str | None = None
    invocation_id: str
    grade_id: str | None = None
    score: int | None = None
    passed: bool | None = None
    feedback: str | None = None


class TestErrorData(BaseModel):
    type: str = "error"
    sid: str | None = None
    invocation_id: str | None = None
    run_id: str | None = None
    message: str
    error_type: str | None = None
