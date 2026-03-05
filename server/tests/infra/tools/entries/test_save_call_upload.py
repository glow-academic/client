"""Tests for save_call_upload."""

import json
from uuid import uuid4

from app.infra.tools.entries.build_call_payload import build_call_payload
from app.infra.tools.entries.save_call_upload import save_call_upload


def _make_payload(**overrides):
    defaults = {
        "call_id": uuid4(),
        "tool_id": uuid4(),
        "arguments": {"name": "Dr. Smith"},
        "output": {"success": True},
    }
    defaults.update(overrides)
    return build_call_payload(**defaults)


def test_returns_relative_path(tmp_path):
    upload_id = uuid4()
    result = save_call_upload(_make_payload(), upload_id, tmp_path)
    assert result == f"call/{upload_id}.json"


def test_creates_file(tmp_path):
    upload_id = uuid4()
    save_call_upload(_make_payload(), upload_id, tmp_path)

    full_path = tmp_path / "call" / f"{upload_id}.json"
    assert full_path.exists()


def test_creates_subfolder(tmp_path):
    upload_id = uuid4()
    save_call_upload(_make_payload(), upload_id, tmp_path)
    assert (tmp_path / "call").is_dir()


def test_writes_payload_as_json(tmp_path):
    upload_id = uuid4()
    payload = _make_payload()
    save_call_upload(payload, upload_id, tmp_path)

    full_path = tmp_path / "call" / f"{upload_id}.json"
    data = json.loads(full_path.read_text(encoding="utf-8"))
    assert data == payload


def test_preserves_arguments(tmp_path):
    args = {"name": "Dr. Smith", "department": "Cardiology", "count": 3}
    upload_id = uuid4()
    payload = _make_payload(arguments=args)
    save_call_upload(payload, upload_id, tmp_path)

    full_path = tmp_path / "call" / f"{upload_id}.json"
    data = json.loads(full_path.read_text(encoding="utf-8"))
    assert data["arguments"] == args


def test_preserves_output(tmp_path):
    output = {"success": True, "message": "Created", "entry_id": "123"}
    upload_id = uuid4()
    payload = _make_payload(output=output)
    save_call_upload(payload, upload_id, tmp_path)

    full_path = tmp_path / "call" / f"{upload_id}.json"
    data = json.loads(full_path.read_text(encoding="utf-8"))
    assert data["output"] == output
