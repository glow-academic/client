# find_profiles.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
#
# LIKE-only fuzzy-ish profile search (first, last, alias).

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List

from app.db import get_session
from app.models import Profiles
from sqlalchemy import func, literal, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select

_WS_RE = re.compile(r"\s+")


def _norm(s: str) -> str:
    """Lowercase, strip accents, collapse whitespace."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return _WS_RE.sub(" ", s.strip().lower())


def _tokens(s: str) -> List[str]:
    return [t for t in _norm(s).split(" ") if t]


def _score_profile(
    q_norm: str,
    toks: List[str],
    first: str | None,
    last: str | None,
    alias: str | None,
) -> int:
    """Heuristic ranking. Bigger is better."""
    first_n = _norm(first or "")
    last_n = _norm(last or "")
    alias_n = _norm(alias or "")

    full_n = (first_n + " " + last_n).strip()

    score = 0

    # Exact full-name match
    if full_n and full_n == q_norm:
        score += 100

    # Exact single-field matches
    if first_n and first_n == q_norm:
        score += 90
    if last_n and last_n == q_norm:
        score += 90
    if alias_n and alias_n == q_norm:
        score += 90

    # Prefix bumps (full query)
    if first_n.startswith(q_norm):
        score += 60
    if last_n.startswith(q_norm):
        score += 60
    if alias_n.startswith(q_norm):
        score += 40

    # Per-token prefix + contains bumps
    for t in toks:
        if first_n.startswith(t):
            score += 30
        if last_n.startswith(t):
            score += 30
        if alias_n.startswith(t):
            score += 20

        if t in first_n:
            score += 10
        if t in last_n:
            score += 10
        if t in alias_n:
            score += 5

    # Whole-query contains bump
    if q_norm in first_n or q_norm in last_n or q_norm in alias_n:
        score += 5

    return score


def find_profiles(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find profiles by name
    ------------------------
    Fuzzy first/last/alias search.

    Input
      • query - Name or alias to search for
      • limit - Max results (default: 10)

    Returns
      [
        {
          "id": str,           # Profile UUID
          "first_name": str | None,
          "last_name": str | None,
          "alias": str | None,
          "role": str | None,
          "full_name": str,    # "First Last" or alias or "Unknown"
          "score": int         # Heuristic match score
        },
        ...
      ]

    Quick-start
      ask:  "Find everyone named Jordan"
      call: find_profiles("Jordan")

    See also 👉 profile_overview() for detailed profile data.
    """
    q_norm = _norm(query)
    toks = _tokens(query)

    if not q_norm:
        return []

    session = next(get_session())
    try:
        # Field handles (lowered once for SQL)
        f_first = func.lower(Profiles.first_name)
        f_last = func.lower(Profiles.last_name)
        f_alias = func.lower(Profiles.alias)

        like_full = f"%{q_norm}%"
        like_prefix = f"{q_norm}%"

        # Token ORs (contains)
        token_ors = []
        for t in toks:
            p = f"%{t}%"
            token_ors.append(or_(f_first.like(p), f_last.like(p), f_alias.like(p)))

        # Build broad candidate predicate
        broad_pred = or_(
            # exact (lower())
            f_first == q_norm,
            f_last == q_norm,
            f_alias == q_norm,
            # prefix
            f_first.like(like_prefix),
            f_last.like(like_prefix),
            f_alias.like(like_prefix),
            # contains full query
            f_first.like(like_full),
            f_last.like(like_full),
            f_alias.like(like_full),
            # token contains (OR-of-ORs)
            or_(*token_ors) if token_ors else literal(False),
        )

        stmt = (
            select(Profiles)
            .where(broad_pred)
            .limit(limit * 5)  # fetch a pool; score & trim in Python
        )

        profiles = session.exec(stmt).all()

        results: List[Dict[str, Any]] = []
        for profile in profiles:
            first = profile.first_name
            last = profile.last_name
            alias = profile.alias
            full_name = " ".join(x for x in (first, last) if x) or alias or "Unknown"

            score = _score_profile(q_norm, toks, first, last, alias)

            results.append(
                {
                    "id": str(profile.id),
                    "first_name": first,
                    "last_name": last,
                    "alias": alias,
                    "role": profile.role,
                    "full_name": full_name,
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["full_name"]))
        return results[:limit]

    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()