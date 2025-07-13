# class_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

from app.db import get_session
from app.models import Classes, Profiles, Scenarios
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def class_overview(class_id: str) -> Dict[str, Any]:
    """
    🔎 Class overview
    -----------------
    Class record, roster, topics, scenarios.

    Input
      • class_id – UUID of the class

    Returns
      { "class": { … }, "roster": [ … ], "scenarios": [ … ] }

    Quick-start
      ask:  "Summarise CS-7643 Spring 30"
      call: class_overview("uuid-here")

    See also 👉 find_classes() to search by name/code.
    """
    try:
        class_uuid = uuid.UUID(class_id)
    except ValueError:
        return {"error": f"Invalid class_id format: {class_id}"}

    session = next(get_session())
    try:
        # Get class
        class_obj = session.get(Classes, class_uuid)
        if not class_obj:
            return {"error": f"Class not found: {class_id}"}

        class_data = {
            "id": str(class_obj.id),
            "name": class_obj.name,
            "class_code": class_obj.class_code,
            "year": class_obj.year,
            "term": class_obj.term,
            "description": class_obj.description,
            "created_at": class_obj.created_at.isoformat(),
        }

        # Get roster - profiles that have this class in their class_ids
        roster_stmt = select(Profiles).where(class_uuid in Profiles.class_ids)
        profiles = session.exec(roster_stmt).all()

        roster = [
            {
                "id": str(profile.id),
                "first_name": profile.first_name,
                "last_name": profile.last_name,
                "alias": profile.alias,
                "role": profile.role,
            }
            for profile in profiles
        ]

        # Get scenarios
        scenarios_stmt = select(Scenarios).where(Scenarios.class_id == class_uuid)
        scenarios = session.exec(scenarios_stmt).all()

        scenarios_data = [
            {
                "id": str(scenario.id),
                "name": scenario.name,
                "description": scenario.description,
                "default_scenario": scenario.default_scenario,
            }
            for scenario in scenarios
        ]

        return {"class": class_data, "roster": roster, "scenarios": scenarios_data}

    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}
    finally:
        session.close()
