"""Get first page of PDF as PNG image bytes."""

import base64


def pdf_first_page_to_image_bytes(full_path: str) -> bytes | None:
    """Get first page of PDF as PNG image bytes.

    Tries PyMuPDF (fitz) if available. If unavailable or errors, returns None.
    """
    try:  # Lazy import to avoid hard dependency
        import fitz  # type: ignore
    except Exception:
        return None

    try:
        doc = fitz.open(full_path)
        if len(doc) == 0:
            doc.close()
            return None

        # Get first page
        page = doc[0]
        pix = page.get_pixmap()
        png_bytes: bytes = pix.tobytes("png")
        doc.close()
        return png_bytes
    except Exception:
        # If rendering fails, return None
        return None

