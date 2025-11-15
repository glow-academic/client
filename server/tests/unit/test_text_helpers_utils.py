"""
Tests for app.utils.text_helpers
"""

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.utils.text_helpers import *  # type: ignore


class TestNormalize_Text:
    """Tests for normalize_text function."""

    def test_normalize_text_success(self) -> None:
        """Test successful normalize_text execution."""
        from app.utils.text_helpers import normalize_text

        # Test basic normalization
        result = normalize_text("Hello World")
        assert result == "hello world"

    def test_normalize_text_accents(self) -> None:
        """Test normalize_text with accents."""
        from app.utils.text_helpers import normalize_text

        # Test accent removal
        result = normalize_text("Café résumé")
        assert result == "cafe resume"

    def test_normalize_text_whitespace(self) -> None:
        """Test normalize_text with multiple whitespace."""
        from app.utils.text_helpers import normalize_text

        # Test whitespace collapse
        result = normalize_text("Hello    World  \n\t  Test")
        assert result == "hello world test"

    def test_normalize_text_none(self) -> None:
        """Test normalize_text with None input."""
        from app.utils.text_helpers import normalize_text

        # Test None handling
        result = normalize_text(None)
        assert result == ""


class TestTokenize:
    """Tests for tokenize function."""

    def test_tokenize_success(self) -> None:
        """Test successful tokenize execution."""
        from app.utils.text_helpers import tokenize

        # Test basic tokenization
        result = tokenize("Hello World Test")
        assert result == ["hello", "world", "test"]

    def test_tokenize_empty(self) -> None:
        """Test tokenize with empty string."""
        from app.utils.text_helpers import tokenize

        # Test empty string
        result = tokenize("")
        assert result == []

    def test_tokenize_none(self) -> None:
        """Test tokenize with None input."""
        from app.utils.text_helpers import tokenize

        # Test None handling
        result = tokenize(None)
        assert result == []

    def test_tokenize_whitespace_only(self) -> None:
        """Test tokenize with whitespace only."""
        from app.utils.text_helpers import tokenize

        # Test whitespace only
        result = tokenize("   \n\t  ")
        assert result == []


class TestWeighted_Choice:
    """Tests for weighted_choice function."""

    def test_weighted_choice_success(self) -> None:
        """Test successful weighted_choice execution."""
        from app.utils.text_helpers import weighted_choice

        # Test with valid weights
        items = [("a", 1.0), ("b", 2.0), ("c", 3.0)]
        result = weighted_choice(items)
        assert result in ["a", "b", "c"]

    def test_weighted_choice_empty_list(self) -> None:
        """Test weighted_choice with empty list."""
        from app.utils.text_helpers import weighted_choice

        # Test empty list
        result = weighted_choice([])
        assert result is None

    def test_weighted_choice_zero_weights(self) -> None:
        """Test weighted_choice with all zero weights."""
        from app.utils.text_helpers import weighted_choice

        # Test zero weights
        items = [("a", 0.0), ("b", 0.0)]
        result = weighted_choice(items)
        assert result is None

    def test_weighted_choice_negative_weights(self) -> None:
        """Test weighted_choice with negative weights."""
        from app.utils.text_helpers import weighted_choice

        # Test negative weights (should be treated as 0)
        items = [("a", -1.0), ("b", -2.0)]
        result = weighted_choice(items)
        assert result is None

    def test_weighted_choice_single_item(self) -> None:
        """Test weighted_choice with single item."""
        from app.utils.text_helpers import weighted_choice

        # Test single item
        items = [("only", 1.0)]
        result = weighted_choice(items)
        assert result == "only"


class TestWeighted_Sample_Without_Replacement:
    """Tests for weighted_sample_without_replacement function."""

    def test_weighted_sample_without_replacement_success(self) -> None:
        """Test successful weighted_sample_without_replacement execution."""
        from app.utils.text_helpers import weighted_sample_without_replacement

        # Test basic sampling
        items = ["a", "b", "c", "d"]
        scores = [1.0, 2.0, 3.0, 4.0]
        result = weighted_sample_without_replacement(items, scores, 2)

        assert len(result) == 2
        assert len(set(result)) == 2  # No duplicates
        assert all(item in items for item in result)

    def test_weighted_sample_without_replacement_k_greater_than_len(self) -> None:
        """Test weighted_sample_without_replacement with k > len(items)."""
        from app.utils.text_helpers import weighted_sample_without_replacement

        # Test k > len
        items = ["a", "b"]
        scores = [1.0, 2.0]
        result = weighted_sample_without_replacement(items, scores, 5)

        assert len(result) == 2  # Should return all items
        assert set(result) == {"a", "b"}

    def test_weighted_sample_without_replacement_zero_scores(self) -> None:
        """Test weighted_sample_without_replacement with zero scores."""
        from app.utils.text_helpers import weighted_sample_without_replacement

        # Test zero scores (should fall back to uniform random)
        items = ["a", "b", "c"]
        scores = [0.0, 0.0, 0.0]
        result = weighted_sample_without_replacement(items, scores, 2)

        assert len(result) == 2
        assert all(item in items for item in result)

    def test_weighted_sample_without_replacement_k_zero(self) -> None:
        """Test weighted_sample_without_replacement with k=0."""
        from app.utils.text_helpers import weighted_sample_without_replacement

        # Test k=0
        items = ["a", "b", "c"]
        scores = [1.0, 2.0, 3.0]
        result = weighted_sample_without_replacement(items, scores, 0)

        assert result == []


class TestRead_Document_Content_For_Similarity:
    """Tests for read_document_content_for_similarity function."""

    def test_read_document_content_for_similarity_text_file(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test reading text file."""
        from app.utils.text_helpers import read_document_content_for_similarity

        # Create a temporary text file
        test_file = tmp_path / "test.txt"
        test_file.write_text("Hello World Test Content")

        # Mock UPLOAD_FOLDER to use tmp_path
        monkeypatch.setattr("app.utils.text_helpers.UPLOAD_FOLDER", str(tmp_path))

        result = read_document_content_for_similarity("test.txt")
        assert result == "Hello World Test Content"

    def test_read_document_content_for_similarity_nonexistent_file(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test reading non-existent file."""
        from app.utils.text_helpers import read_document_content_for_similarity

        # Mock UPLOAD_FOLDER to use tmp_path
        monkeypatch.setattr("app.utils.text_helpers.UPLOAD_FOLDER", str(tmp_path))

        result = read_document_content_for_similarity("nonexistent.txt")
        assert result == ""

    def test_read_document_content_for_similarity_latin1_fallback(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test reading file with latin-1 encoding fallback."""
        from app.utils.text_helpers import read_document_content_for_similarity

        # Create a file with latin-1 encoding
        test_file = tmp_path / "latin1.txt"
        test_file.write_bytes(b"Hello \xe9 World")  # latin-1 encoded é

        # Mock UPLOAD_FOLDER to use tmp_path
        monkeypatch.setattr("app.utils.text_helpers.UPLOAD_FOLDER", str(tmp_path))

        result = read_document_content_for_similarity("latin1.txt")
        # Should successfully read with latin-1 fallback
        assert "Hello" in result
        assert "World" in result

    @pytest.mark.skip(reason="PDF reading requires pypdf library and actual PDF file")
    def test_read_document_content_for_similarity_pdf(self) -> None:
        """Test reading PDF file."""
        # This would require creating a valid PDF file which is complex
        pass
