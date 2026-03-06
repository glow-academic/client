"""Tests for infra.helpers — shared pure-Python utilities."""

from uuid import uuid4

from app.infra.helpers import dedupe_by_id


class FakeItem:
    def __init__(self, id=None, **kwargs):
        self.id = id
        for k, v in kwargs.items():
            setattr(self, k, v)


class TestDedupeById:
    def test_empty_list(self):
        assert dedupe_by_id([]) == []

    def test_no_duplicates(self):
        a, b = FakeItem(id=uuid4()), FakeItem(id=uuid4())
        result = dedupe_by_id([a, b])
        assert result == [a, b]

    def test_removes_duplicates_preserves_order(self):
        id1, id2 = uuid4(), uuid4()
        a = FakeItem(id=id1)
        b = FakeItem(id=id2)
        c = FakeItem(id=id1)  # duplicate of a
        result = dedupe_by_id([a, b, c])
        assert result == [a, b]

    def test_skips_none_id(self):
        a = FakeItem(id=None)
        b = FakeItem(id=uuid4())
        result = dedupe_by_id([a, b])
        assert result == [b]

    def test_skips_missing_attr(self):
        """Items without the id_attr are skipped."""
        item = object()  # no .id attribute
        b = FakeItem(id=uuid4())
        result = dedupe_by_id([item, b])
        assert result == [b]

    def test_custom_id_attr(self):
        id1 = uuid4()
        a = FakeItem(field_id=id1)
        b = FakeItem(field_id=id1)  # duplicate
        c = FakeItem(field_id=uuid4())
        result = dedupe_by_id([a, b, c], id_attr="field_id")
        assert result == [a, c]

    def test_mixed_none_and_valid(self):
        id1 = uuid4()
        a = FakeItem(id=id1)
        b = FakeItem(id=None)
        c = FakeItem(id=id1)  # duplicate
        d = FakeItem(id=uuid4())
        result = dedupe_by_id([a, b, c, d])
        assert result == [a, d]

    def test_all_same_id(self):
        id1 = uuid4()
        items = [FakeItem(id=id1) for _ in range(5)]
        result = dedupe_by_id(items)
        assert len(result) == 1
        assert result[0] is items[0]
