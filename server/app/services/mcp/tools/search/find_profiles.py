# find_profiles.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from typing import Any, Dict, List

from app.db import get_session
from app.models import Profiles
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def find_profiles(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find profiles by name
    ------------------------
    Fuzzy first/last/alias search.

    Input
      • query – Name or alias to search for
      • limit – Max results (default: 10)

    Returns
      [ { "id": "…", "full_name": "…", … }, … ]

    Quick-start
      ask:  "Find everyone named Jordan"
      call: find_profiles("Jordan")

    See also 👉 profile_overview() for detailed profile data.
    """
    session = next(get_session())
    try:
        # Split the query to handle full names
        query_parts = query.strip().split()

        if len(query_parts) >= 2:
            # Handle full name
            first_pattern = f"%{query_parts[0].lower()}%"
            last_pattern = f"%{query_parts[-1].lower()}%"

            primary_conditions = and_(
                func.lower(Profiles.first_name).like(first_pattern),
                func.lower(Profiles.last_name).like(last_pattern),
            )

            full_pattern = f"%{query.lower()}%"
            fallback_conditions = or_(
                func.lower(Profiles.first_name).like(first_pattern),
                func.lower(Profiles.last_name).like(last_pattern),
                func.lower(Profiles.alias).like(full_pattern),
            )

            stmt = (
                select(Profiles)
                .where(or_(primary_conditions, fallback_conditions))
                .limit(limit)
            )
        else:
            # Single name search
            search_pattern = f"%{query.lower()}%"
            stmt = (
                select(Profiles)
                .where(
                    or_(
                        func.lower(Profiles.first_name).like(search_pattern),
                        func.lower(Profiles.last_name).like(search_pattern),
                        func.lower(Profiles.alias).like(search_pattern),
                    )
                )
                .limit(limit)
            )

        profiles = session.exec(stmt).all()

        results = []
        for profile in profiles:
            full_name_parts = []
            if profile.first_name:
                full_name_parts.append(profile.first_name)
            if profile.last_name:
                full_name_parts.append(profile.last_name)
            full_name = (
                " ".join(full_name_parts)
                if full_name_parts
                else profile.alias or "Unknown"
            )

            results.append(
                {
                    "id": str(profile.id),
                    "first_name": profile.first_name,
                    "last_name": profile.last_name,
                    "alias": profile.alias,
                    "role": profile.role,
                    "full_name": full_name,
                }
            )

        return results

    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()
