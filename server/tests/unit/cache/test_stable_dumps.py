"""
Tests for app.utils.cache.stable_dumps
"""

import json

from app.utils.cache.stable_dumps import stable_dumps


class TestStable_Dumps:
    """Tests for stable_dumps function."""

    def test_stable_dumps_success(self) -> None:
        """Test successful stable_dumps execution."""
        obj = {"b": 2, "a": 1, "c": 3}
        result = stable_dumps(obj)

        assert isinstance(result, str)
        # Should be sorted keys
        assert result == '{"a":1,"b":2,"c":3}'

    def test_stable_dumps_empty_dict(self) -> None:
        """Test stable_dumps with empty dict."""
        result = stable_dumps({})
        assert result == "{}"

    def test_stable_dumps_nested(self) -> None:
        """Test stable_dumps with nested structures."""
        obj = {"z": {"b": 2, "a": 1}, "y": [3, 1, 2]}
        result = stable_dumps(obj)

        assert isinstance(result, str)
        parsed = json.loads(result)
        assert parsed == obj

