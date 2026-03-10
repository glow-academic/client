"""Tests for low-level document helper utilities."""

import pypdf  # type: ignore
import pytest

from app.utils.document.pdf_first_page_to_image_bytes import (
    pdf_first_page_to_image_bytes,
)
from app.utils.document.pdf_pages_to_image_data_urls import (
    pdf_pages_to_image_data_urls,
)
from app.utils.document.read_pdf_text_pages import read_pdf_text_pages
from app.utils.document.read_text_file import read_text_file


def test_read_text_file_reads_utf8_and_strips_whitespace(tmp_path):
    path = tmp_path / "sample.txt"
    path.write_text("  hello world  \n", encoding="utf-8")

    assert read_text_file(str(path)) == "hello world"


def test_read_text_file_falls_back_to_latin_1(tmp_path):
    path = tmp_path / "latin1.txt"
    path.write_bytes("caf\xe9".encode("latin-1"))

    assert read_text_file(str(path)) == "café"


def test_read_text_file_raises_value_error_for_missing_file(tmp_path):
    with pytest.raises(ValueError, match="Error reading file"):
        read_text_file(str(tmp_path / "missing.txt"))


def test_read_pdf_text_pages_returns_one_entry_per_page(tmp_path):
    path = tmp_path / "blank.pdf"
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.add_blank_page(width=200, height=200)
    with path.open("wb") as file:
        writer.write(file)

    assert read_pdf_text_pages(str(path)) == ["", ""]


def test_read_pdf_text_pages_raises_value_error_for_missing_file(tmp_path):
    with pytest.raises(ValueError, match="Error reading PDF file"):
        read_pdf_text_pages(str(tmp_path / "missing.pdf"))


def test_pdf_image_helpers_fail_softly_for_missing_file(tmp_path):
    missing = str(tmp_path / "missing.pdf")

    assert pdf_first_page_to_image_bytes(missing) is None
    assert pdf_pages_to_image_data_urls(missing) == []

