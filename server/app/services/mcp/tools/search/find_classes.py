# find_classes.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
#
# LIKE-only fuzzy-ish class search (name + class_code).

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List

from app.db import get_session
from app.models import Classes
from sqlalchemy import func, literal, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select

_WS_RE = re.compile(r"\s+")


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return _WS_RE.sub(" ", s.strip().lower())


def _tokens(s: str) -> List[str]:
    return [t for t in _norm(s).split(" ") if t]


def _score_class(
    q_norm: str,
    toks: List[str],
    name: str | None,
    code: str | None,
) -> int:
    """Heuristic score; higher = better."""
    name_n = _norm(name or "")
    code_n = _norm(code or "")

    score = 0

    # Exact field matches
    if code_n and code_n == q_norm:
        score += 120  # class_code is usually the strongest signal
    if name_n and name_n == q_norm:
        score += 100

    # Prefix on full query
    if code_n.startswith(q_norm):
        score += 80
    if name_n.startswith(q_norm):
        score += 60

    # Token-wise
    for t in toks:
        if code_n.startswith(t):
            score += 40
        if name_n.startswith(t):
            score += 30
        if t in code_n:
            score += 15
        if t in name_n:
            score += 10

    # Whole query appears anywhere
    if q_norm in code_n or q_norm in name_n:
        score += 5

    # Length proximity (favor shorter/tighter names/codes)
    gap = abs(len(name_n or code_n) - len(q_norm))
    score += max(0, 10 - gap)

    return score


def find_classes(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find classes by name/code
    ----------------------------
    Fuzzy class code/name search.

    Input
        • query - Class code or name to search for
        • limit - Max results (default: 10)

    Returns
        [ { "id": "…", "class_code": "…", "name": "…", … }, … ]

    Quick-start
        ask:  "Search for 'BIOL-1102'"
        call: find_classes("BIOL-1102")

    See also 👉 class_overview() for detailed class data.
    """
    q_norm = _norm(query)
    toks = _tokens(query)

    if not q_norm:
        return []

    session = next(get_session())
    try:
        c_code = func.lower(Classes.class_code)
        c_name = func.lower(Classes.name)

        like_full = f"%{q_norm}%"
        like_prefix = f"{q_norm}%"

        # token ORs (contains) across name/code
        token_ors = []
        for t in toks:
            p = f"%{t}%"
            token_ors.append(or_(c_code.like(p), c_name.like(p)))

        broad_pred = or_(
            c_code == q_norm,
            c_name == q_norm,
            c_code.like(like_prefix),
            c_name.like(like_prefix),
            c_code.like(like_full),
            c_name.like(like_full),
            or_(*token_ors) if token_ors else literal(False),
        )

        stmt = (
            select(Classes)
            .where(broad_pred)
            .limit(limit * 5)  # grab a pool; rank in Python
        )

        classes = session.exec(stmt).all()

        results: List[Dict[str, Any]] = []
        for cls in classes:
            score = _score_class(q_norm, toks, cls.name, cls.class_code)
            results.append(
                {
                    "id": str(cls.id),
                    "class_code": cls.class_code,
                    "name": cls.name,
                    "year": cls.year,
                    "term": cls.term,
                    "description": cls.description,
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["class_code"] or r["name"]))
        return results[:limit]

    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()

