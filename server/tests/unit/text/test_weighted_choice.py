"""
Tests for app.utils.text.weighted_choice
"""


class TestWeighted_Choice:
    """Tests for weighted_choice function."""

    def test_weighted_choice_success(self) -> None:
        """Test successful weighted_choice execution."""
        from app.utils.text.weighted_choice import weighted_choice

        # Test with valid weights
        items = [("a", 1.0), ("b", 2.0), ("c", 3.0)]
        result = weighted_choice(items)
        assert result in ["a", "b", "c"]

    def test_weighted_choice_empty_list(self) -> None:
        """Test weighted_choice with empty list."""
        from app.utils.text.weighted_choice import weighted_choice

        # Test empty list
        result = weighted_choice([])
        assert result is None

    def test_weighted_choice_zero_weights(self) -> None:
        """Test weighted_choice with all zero weights."""
        from app.utils.text.weighted_choice import weighted_choice

        # Test zero weights
        items = [("a", 0.0), ("b", 0.0)]
        result = weighted_choice(items)
        assert result is None

    def test_weighted_choice_negative_weights(self) -> None:
        """Test weighted_choice with negative weights."""
        from app.utils.text.weighted_choice import weighted_choice

        # Test negative weights (should be treated as 0)
        items = [("a", -1.0), ("b", -2.0)]
        result = weighted_choice(items)
        assert result is None

    def test_weighted_choice_single_item(self) -> None:
        """Test weighted_choice with single item."""
        from app.utils.text.weighted_choice import weighted_choice

        # Test single item
        items = [("only", 1.0)]
        result = weighted_choice(items)
        assert result == "only"
