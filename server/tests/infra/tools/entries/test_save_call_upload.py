"""Tests for save_call_upload."""

import json
from uuid import uuid4

from app.infra.tools.entries.save_call_upload import save_call_upload


def test_returns_relative_path(tmp_path):
    upload_id = uuid4()
    result = save_call_upload({"key": "value"}, upload_id, tmp_path)

    assert result == f"call/{upload_id}.json"


def test_creates_file(tmp_path):
    upload_id = uuid4()
    data = {"tool": "use_voices", "args": [1, 2, 3]}
    save_call_upload(data, upload_id, tmp_path)

    full_path = tmp_path / "call" / f"{upload_id}.json"

    assert full_path.exists()
    assert json.loads(full_path.read_text(encoding="utf-8")) == data


def test_creates_subfolder(tmp_path):
    upload_id = uuid4()
    save_call_upload({}, upload_id, tmp_path)

    assert (tmp_path / "call").is_dir()
