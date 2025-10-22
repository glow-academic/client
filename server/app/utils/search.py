"""
Shared search utilities for fuzzy text matching.
Provides normalization, tokenization, and query building helpers.

@AshokSaravanan222 & @siladiea
10/17/2025
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

_WS_RE = re.compile(r"\s+")


def normalize_text(s: str | None) -> str:
    """
    Lowercase, strip accents, collapse whitespace.

    Args:
        s: Text to normalize

    Returns:
        Normalized text string
    """
    s = s or ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return _WS_RE.sub(" ", s.strip().lower())


def tokenize(s: str | None) -> list[str]:
    """
    Split normalized text into tokens.

    Args:
        s: Text to tokenize

    Returns:
        List of tokens (non-empty strings)
    """
    return [t for t in normalize_text(s).split(" ") if t]


def build_fuzzy_conditions(
    field_names: list[str], query: str, start_param_idx: int = 1
) -> tuple[str, list[Any], int]:
    """
    Build SQL WHERE conditions for fuzzy text matching across multiple fields.

    Creates conditions for:
    - Exact matches (LOWER(field) = normalized_query)
    - Prefix matches (LOWER(field) LIKE 'query%')
    - Contains matches (LOWER(field) LIKE '%query%')
    - Token-based matches (each token checked across all fields)

    Args:
        field_names: List of SQL field names (e.g., ['s.name', 's.description'])
        query: User search query
        start_param_idx: Starting parameter index for SQL placeholders

    Returns:
        Tuple of (where_clause, params, next_param_idx)

    Example:
        >>> build_fuzzy_conditions(['s.name', 's.description'], 'test query', 1)
        ('LOWER(s.name) = $1 OR ... ', ['test query', ...], 15)
    """
    q_norm = normalize_text(query)
    tokens = tokenize(query)

    like_full = f"%{q_norm}%"
    like_prefix = f"{q_norm}%"
    token_patterns = [f"%{t}%" for t in tokens]

    where_conditions = []
    params: list[Any] = []
    param_idx = start_param_idx

    # Exact match for each field
    for field in field_names:
        where_conditions.append(f"LOWER({field}) = ${param_idx}")
        params.append(q_norm)
        param_idx += 1

    # Prefix match for each field
    for field in field_names:
        where_conditions.append(f"LOWER({field}) LIKE ${param_idx}")
        params.append(like_prefix)
        param_idx += 1

    # Contains match for each field
    for field in field_names:
        where_conditions.append(f"LOWER({field}) LIKE ${param_idx}")
        params.append(like_full)
        param_idx += 1

    # Token-based matching
    for pattern in token_patterns:
        field_conditions = " OR ".join(
            [f"LOWER({field}) LIKE ${param_idx}" for field in field_names]
        )
        where_conditions.append(f"({field_conditions})")
        params.append(pattern)
        param_idx += 1

    where_clause = " OR ".join(where_conditions)
    return where_clause, params, param_idx
