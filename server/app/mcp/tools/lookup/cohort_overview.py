# cohort_overview.py
from typing import Any, Dict

import asyncpg  # type: ignore
from app.services.cohort_service import CohortService


async def cohort_overview(conn: asyncpg.Connection, cohort_id: str) -> Dict[str, Any]:
    """Cohort meta, roster, active sims, and pass-rate."""
    service = CohortService(conn)
    return await service.get_cohort_overview(cohort_id)
