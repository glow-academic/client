"""
Tests for app.utils.text.weighted_sample_without_replacement
"""


class TestWeighted_Sample_Without_Replacement:
    """Tests for weighted_sample_without_replacement function."""

    def test_weighted_sample_without_replacement_success(self) -> None:
        """Test successful weighted_sample_without_replacement execution."""
        from app.utils.text.weighted_sample_without_replacement import (
            weighted_sample_without_replacement,
        )

        # Test basic sampling
        items = ["a", "b", "c", "d"]
        scores = [1.0, 2.0, 3.0, 4.0]
        result = weighted_sample_without_replacement(items, scores, 2)

        assert len(result) == 2
        assert len(set(result)) == 2  # No duplicates
        assert all(item in items for item in result)

    def test_weighted_sample_without_replacement_k_greater_than_len(self) -> None:
        """Test weighted_sample_without_replacement with k > len(items)."""
        from app.utils.text.weighted_sample_without_replacement import (
            weighted_sample_without_replacement,
        )

        # Test k > len
        items = ["a", "b"]
        scores = [1.0, 2.0]
        result = weighted_sample_without_replacement(items, scores, 5)

        assert len(result) == 2  # Should return all items
        assert set(result) == {"a", "b"}

    def test_weighted_sample_without_replacement_zero_scores(self) -> None:
        """Test weighted_sample_without_replacement with zero scores."""
        from app.utils.text.weighted_sample_without_replacement import (
            weighted_sample_without_replacement,
        )

        # Test zero scores (should fall back to uniform random)
        items = ["a", "b", "c"]
        scores = [0.0, 0.0, 0.0]
        result = weighted_sample_without_replacement(items, scores, 2)

        assert len(result) == 2
        assert all(item in items for item in result)

    def test_weighted_sample_without_replacement_k_zero(self) -> None:
        """Test weighted_sample_without_replacement with k=0."""
        from app.utils.text.weighted_sample_without_replacement import (
            weighted_sample_without_replacement,
        )

        # Test k=0
        items = ["a", "b", "c"]
        scores = [1.0, 2.0, 3.0]
        result = weighted_sample_without_replacement(items, scores, 0)

        assert result == []
