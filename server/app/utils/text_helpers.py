# utils/text_helpers.py

import os
import random
import re
import unicodedata
from typing import Any

import pypdf  # type: ignore

from app.extensions import UPLOAD_FOLDER


def normalize_text(text: str | None) -> str:
    """Normalize text by removing accents, converting to lowercase, and collapsing whitespace."""
    text = text or ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text.strip().lower())


def tokenize(text: str | None) -> list[str]:
    """Tokenize normalized text into words."""
    return [t for t in normalize_text(text).split(" ") if t]


def weighted_choice(weighted_items: list[tuple[Any, float]]) -> Any | None:
    """Return one item chosen with probability proportional to its weight.

    Returns None when all weights are non-positive or list is empty.
    """
    if not weighted_items:
        return None
    # Ensure non-negative weights
    weights = [max(0.0, float(w)) for _, w in weighted_items]
    total = sum(weights)
    if total <= 0.0:
        return None
    r = random.random() * total
    cumsum = 0.0
    for item, w in weighted_items:
        cumsum += max(0.0, float(w))
        if r <= cumsum:
            return item
    return weighted_items[-1][0]


def weighted_sample_without_replacement(
    items: list[Any], scores: list[float], k: int
) -> list[Any]:
    """Sample up to k unique items proportionally to scores without replacement.

    Falls back to fewer items if necessary.
    """
    selected: list[Any] = []
    pool_items = list(items)
    pool_scores = [max(0.0, float(s)) for s in scores]
    for _ in range(min(k, len(pool_items))):
        total = sum(pool_scores)
        if total <= 0.0:
            # pick uniformly at random from remaining
            choice_idx = random.randrange(len(pool_items))
        else:
            r = random.random() * total
            cumsum = 0.0
            choice_idx = 0
            for i, s in enumerate(pool_scores):
                cumsum += s
                if r <= cumsum:
                    choice_idx = i
                    break
        selected.append(pool_items.pop(choice_idx))
        pool_scores.pop(choice_idx)
    return selected


def read_document_content_for_similarity(file_path: str) -> str:
    """Read textual content from a document under UPLOAD_FOLDER for similarity scoring.

    - PDFs: extract per-page text via pypdf
    - Text files: read with UTF-8, fallback to latin-1
    """
    full_path = os.path.join(UPLOAD_FOLDER, file_path)
    content = ""
    if file_path.lower().endswith(".pdf"):
        try:
            with open(full_path, "rb") as fh:  # noqa: PTH123
                reader = pypdf.PdfReader(fh)
                for page in reader.pages:
                    content += (page.extract_text() or "") + "\n"
        except Exception:
            return ""
    else:
        try:
            with open(full_path, encoding="utf-8") as fh:  # noqa: PTH123
                content = fh.read()
        except UnicodeDecodeError:
            try:
                with open(full_path, encoding="latin-1") as fh:  # noqa: PTH123
                    content = fh.read()
            except Exception:
                return ""
        except Exception:
            return ""

    return content.strip()
