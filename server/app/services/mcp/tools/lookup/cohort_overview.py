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

        # Load profiles from cohort_profiles junction table
        from app.models import t_cohort_profiles
        from sqlalchemy import select as sa_select
        
        profile_ids = list(session.connection().execute(  # type: ignore
            sa_select(t_cohort_profiles.c.profile_id)
            .where(t_cohort_profiles.c.cohort_id == cohort_uuid)
        ).scalars().all())
        
        roster = []
        if profile_ids:
            profiles_stmt = select(Profiles).where(Profiles.id.in_(profile_ids))
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

        # Load simulations from cohort_simulations junction table
        from app.models import t_cohort_simulations
        
        simulation_ids = list(session.connection().execute(  # type: ignore
            sa_select(t_cohort_simulations.c.simulation_id)
            .where(t_cohort_simulations.c.cohort_id == cohort_uuid)
        ).scalars().all())
        
        cohort_sims: list[Simulations] = []
        if simulation_ids:
            sims_stmt = select(Simulations).where(
                Simulations.id.in_(simulation_ids), Simulations.active
            )
            cohort_sims = list(session.exec(sims_stmt).all())

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
