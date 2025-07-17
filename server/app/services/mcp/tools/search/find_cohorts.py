# find_cohorts.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
#
# LIKE-only fuzzy-ish cohort search (title + description).
#
# Usage:
#   find_cohorts("Fall 2025 freshmen")
#
# Returns:
#   [
#     {
#       "id": "...",
#       "title": "...",
#       "active": True,
#       "description": "...",
#       "profile_count": 42,
#       "score": 137,
#     },
#     ...
#   ]
#

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List

from app.db import get_session
from app.models import Cohorts
from sqlalchemy import func, literal, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


# ---------------------------
# Normalization helpers
# ---------------------------

_WS_RE = re.compile(r"\s+")


def _norm(s: str) -> str:
    """Lowercase, strip accents, collapse whitespace."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return _WS_RE.sub(" ", s.strip().lower())


def _tokens(s: str) -> List[str]:
    return [t for t in _norm(s).split(" ") if t]


# ---------------------------
# Scoring heuristic
# ---------------------------

def _score_cohort(q_norm: str, toks: List[str], title: str | None, desc: str | None) -> int:
    """
    Rank candidates. Title is much stronger than description.
    """
    t_norm = _norm(title or "")
    d_norm = _norm(desc or "")

    score = 0

    # Exact whole-title match
    if t_norm == q_norm:
        score += 100

    # Exact description match (rare, low weight)
    if d_norm and d_norm == q_norm:
        score += 40

    # Prefix on full query
    if t_norm.startswith(q_norm):
        score += 60
    if d_norm.startswith(q_norm):
        score += 20

    # Token boosts
    for tok in toks:
        if t_norm.startswith(tok):
            score += 25
        if tok in t_norm:
            score += 10

        if d_norm.startswith(tok):
            score += 8
        if tok in d_norm:
            score += 4

    # Whole query appears somewhere
    if q_norm in t_norm or q_norm in d_norm:
        score += 5

    # Length proximity bonus (favor tight title matches)
    gap = abs(len(t_norm) - len(q_norm))
    score += max(0, 10 - gap)

    return score


# ---------------------------
# Public search function
# ---------------------------

def find_cohorts(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find cohorts by title/description
    ------------------------------------
    Fuzzy, case-insensitive search on cohort title and description.

    Input
        • query - Cohort title or description to search for
        • limit - Max results (default: 10)

    Returns
        [ 
            { 
                "id": "...", 
                "title": "...", 
                "active": <bool>, 
                "description": "...", 
                "profile_count": <int>, 
                "score": <int> 
            }, 
            ... 
        ]

    Quick-start
        ask:  "Find all Fall 2025 cohorts"
        call: find_cohorts("Fall 2025")

    See also 👉 cohort_overview() for detailed cohort data.
    """
    q_norm = _norm(query)
    toks = _tokens(query)

    if not q_norm:
        return []

    session = next(get_session())
    try:
        c_title = func.lower(Cohorts.title)
        c_desc = func.lower(Cohorts.description)

        like_full = f"%{q_norm}%"
        like_prefix = f"{q_norm}%"

        # token ORs across both fields
        token_ors = []
        for t in toks:
            p = f"%{t}%"
            token_ors.append(or_(c_title.like(p), c_desc.like(p)))

        broad_pred = or_(
            c_title == q_norm,
            c_desc == q_norm,
            c_title.like(like_prefix),
            c_desc.like(like_prefix),
            c_title.like(like_full),
            c_desc.like(like_full),
            or_(*token_ors) if token_ors else literal(False),
        )

        stmt = (
            select(Cohorts)
            .where(broad_pred)
            .limit(limit * 5)  # candidate pool
        )

        cohorts = session.exec(stmt).all()

        results: List[Dict[str, Any]] = []
        for c in cohorts:
            score = _score_cohort(q_norm, toks, c.title, c.description)
            results.append(
                {
                    "id": str(c.id),
                    "title": c.title,
                    "active": c.active,
                    "description": c.description,
                    "profile_count": len(c.profile_ids or []),
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["title"] or ""))
        return results[:limit]

    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()
