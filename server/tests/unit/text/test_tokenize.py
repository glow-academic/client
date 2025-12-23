"""
Tests for app.utils.text.tokenize
"""


class TestTokenize:
    """Tests for tokenize function."""

    def test_tokenize_success(self) -> None:
        """Test successful tokenize execution."""
        from utils.text.tokenize import tokenize

        # Test basic tokenization
        result = tokenize("Hello World Test")
        assert result == ["hello", "world", "test"]

    def test_tokenize_empty(self) -> None:
        """Test tokenize with empty string."""
        from utils.text.tokenize import tokenize

        # Test empty string
        result = tokenize("")
        assert result == []

    def test_tokenize_none(self) -> None:
        """Test tokenize with None input."""
        from utils.text.tokenize import tokenize

        # Test None handling
        result = tokenize(None)
        assert result == []

    def test_tokenize_whitespace_only(self) -> None:
        """Test tokenize with whitespace only."""
        from utils.text.tokenize import tokenize

        # Test whitespace only
        result = tokenize("   \n\t  ")
        assert result == []
