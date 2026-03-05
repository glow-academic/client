"""Tests for save_call_upload."""

import json
from uuid import uuid4

from app.infra.tools.entries.save_call_upload import save_call_upload


def test_returns_relative_path(tmp_path):
    upload_id = uuid4()
    result = save_call_upload(
        call_id=uuid4(),
        tool_id=uuid4(),
        arguments={"name": "Dr. Smith"},
        output={"success": True},
        upload_id=upload_id,
        upload_folder=tmp_path,
    )
    assert result == f"call/{upload_id}.json"


def test_creates_file(tmp_path):
    upload_id = uuid4()
    save_call_upload(
        call_id=uuid4(),
        tool_id=uuid4(),
        arguments={"dept": "Cardiology"},
        output={"success": True},
        upload_id=upload_id,
        upload_folder=tmp_path,
    )

    full_path = tmp_path / "call" / f"{upload_id}.json"
    assert full_path.exists()


def test_creates_subfolder(tmp_path):
    upload_id = uuid4()
    save_call_upload(
        call_id=uuid4(),
        tool_id=uuid4(),
        arguments={},
        output={},
        upload_id=upload_id,
        upload_folder=tmp_path,
    )
    assert (tmp_path / "call").is_dir()


def test_has_correct_keys(tmp_path):
    upload_id = uuid4()
    save_call_upload(
        call_id=uuid4(),
        tool_id=uuid4(),
        arguments={"name": "Dr. Smith"},
        output={"success": True},
        upload_id=upload_id,
        upload_folder=tmp_path,
    )

    full_path = tmp_path / "call" / f"{upload_id}.json"
    data = json.loads(full_path.read_text(encoding="utf-8"))
    assert set(data.keys()) == {"call_id", "tool_id", "arguments", "output"}


def test_preserves_arguments(tmp_path):
    args = {"name": "Dr. Smith", "department": "Cardiology", "count": 3}
    upload_id = uuid4()
    save_call_upload(
        call_id=uuid4(),
        tool_id=uuid4(),
        arguments=args,
        output={},
        upload_id=upload_id,
        upload_folder=tmp_path,
    )

    full_path = tmp_path / "call" / f"{upload_id}.json"
    data = json.loads(full_path.read_text(encoding="utf-8"))
    assert data["arguments"] == args


def test_preserves_output(tmp_path):
    output = {"success": True, "message": "Created", "entry_id": "123"}
    upload_id = uuid4()
    save_call_upload(
        call_id=uuid4(),
        tool_id=uuid4(),
        arguments={},
        output=output,
        upload_id=upload_id,
        upload_folder=tmp_path,
    )

    full_path = tmp_path / "call" / f"{upload_id}.json"
    data = json.loads(full_path.read_text(encoding="utf-8"))
    assert data["output"] == output


def test_serializes_uuids(tmp_path):
    call_id = uuid4()
    tool_id = uuid4()
    upload_id = uuid4()
    save_call_upload(
        call_id=call_id,
        tool_id=tool_id,
        arguments={},
        output={},
        upload_id=upload_id,
        upload_folder=tmp_path,
    )

    full_path = tmp_path / "call" / f"{upload_id}.json"
    data = json.loads(full_path.read_text(encoding="utf-8"))
    assert data["call_id"] == str(call_id)
    assert data["tool_id"] == str(tool_id)
