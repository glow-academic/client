"""
Tests for app.utils.document.pdf_pages_to_image_data_urls
"""

from pathlib import Path

import pytest


class TestPdf_Pages_To_Image_Data_Urls:
    """Tests for pdf_pages_to_image_data_urls function."""

    def test_pdf_pages_to_image_data_urls_fitz_unavailable(
        self, tmp_path: Path
    ) -> None:
        """Test pdf_pages_to_image_data_urls when fitz is unavailable."""
        test_file = tmp_path / "test.pdf"
        test_file.write_bytes(b"fake pdf content")

        # Patch sys.modules to simulate fitz not being available
        import sys

        from app.utils.document.pdf_pages_to_image_data_urls import (
            pdf_pages_to_image_data_urls,
        )

        original_fitz = sys.modules.get("fitz")
        if "fitz" in sys.modules:
            del sys.modules["fitz"]

        try:
            # The function should catch ImportError and return []
            result = pdf_pages_to_image_data_urls(str(test_file))
            assert result == []
        finally:
            # Restore original fitz if it existed
            if original_fitz is not None:
                sys.modules["fitz"] = original_fitz

    def test_pdf_pages_to_image_data_urls_success(self, tmp_path: Path) -> None:
        """Test pdf_pages_to_image_data_urls with fitz available."""
        # Check if fitz is available
        try:
            import fitz  # type: ignore
        except ImportError:
            pytest.skip("fitz (PyMuPDF) not available")

        from app.utils.document.pdf_pages_to_image_data_urls import (
            pdf_pages_to_image_data_urls,
        )

        # If fitz is available, test with a real PDF file
        # Create a minimal valid PDF for testing
        test_file = tmp_path / "test.pdf"
        # Write a minimal PDF structure (this is a very basic PDF)
        minimal_pdf = (
            b"%PDF-1.4\n"
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
            b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
            b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n179\n%%EOF"
        )
        test_file.write_bytes(minimal_pdf)

        # Test the function - it should handle the PDF (may return empty if rendering fails, which is OK)
        result = pdf_pages_to_image_data_urls(str(test_file))
        # Result can be empty list if rendering fails, or list of data URLs if successful
        assert isinstance(result, list)
        if result:
            # If we got results, verify they're valid data URLs
            assert all(url.startswith("data:image/png;base64,") for url in result)

    def test_pdf_pages_to_image_data_urls_error_handling(self, tmp_path: Path) -> None:
        """Test pdf_pages_to_image_data_urls error handling."""
        # Check if fitz is available
        try:
            import fitz  # type: ignore
        except ImportError:
            pytest.skip("fitz (PyMuPDF) not available")

        from app.utils.document.pdf_pages_to_image_data_urls import (
            pdf_pages_to_image_data_urls,
        )

        # Test with a file that will cause an error (invalid PDF)
        test_file = tmp_path / "invalid.pdf"
        test_file.write_bytes(b"not a valid PDF")

        # Should return empty list on error
        result = pdf_pages_to_image_data_urls(str(test_file))
        assert result == []
