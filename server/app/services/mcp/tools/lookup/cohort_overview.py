# cohort_overview.py
import uuid
from typing import Any, Dict

from app.db import get_session
from app.models import Cohorts, Profiles, Simulations
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def cohort_overview(cohort_id: str) -> Dict[str, Any]:
    """
    🔎 Cohort overview
    ------------------
    Cohort meta, roster, active sims, pass-rate.

    Input
      • cohort_id – UUID of the cohort

    Returns
      { "cohort": { … }, "roster": [ … ], "simulations": [ … ], "stats": { … } }

    Quick-start
      ask:  "How's Fall 2025 Cohort A doing?"
      call: cohort_overview("uuid-here")

    See also 👉 cohort_pass_matrix() for detailed pass/fail data.
    """
    try:
        cohort_uuid = uuid.UUID(cohort_id)
    except ValueError:
        return {"error": f"Invalid cohort_id format: {cohort_id}"}

    session = next(get_session())
    try:
        # Get cohort
        cohort = session.get(Cohorts, cohort_uuid)
        if not cohort:
            return {"error": f"Cohort not found: {cohort_id}"}

        cohort_data = {
            "id": str(cohort.id),
            "title": cohort.title,
            "description": cohort.description,
            "active": cohort.active,
            "created_at": cohort.created_at.isoformat() if cohort.created_at else None,
        }

        # Get roster
        roster = []
        if cohort.profile_ids:
            profiles_stmt = select(Profiles).where(Profiles.id.in_(cohort.profile_ids))
            profiles = session.exec(profiles_stmt).all()

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

        # FIX: Fetch all active simulations and filter in Python for robust array checking.
        all_active_sims_stmt = select(Simulations).where(Simulations.active == True)
        all_active_sims = session.exec(all_active_sims_stmt).all()
        cohort_sims = [sim for sim in all_active_sims if cohort_uuid in sim.cohort_ids]
        
        simulations_data = [
            {
                "id": str(sim.id),
                "title": sim.title,
                "active": sim.active,
                "time_limit": sim.time_limit,
            }
            for sim in cohort_sims
        ]

        # Calculate basic stats
        total_students = len(roster)
        active_simulations = len(simulations_data)

        return {
            "cohort": cohort_data,
            "roster": roster,
            "simulations": simulations_data,
            "stats": {
                "total_students": total_students,
                "active_simulations": active_simulations,
            },
        }

    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}
    finally:
        session.close()
