# cohort_pass_matrix.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
# Refactored: SQL logic moved to cohort_service.py

from typing import Any, Dict

import asyncpg  # type: ignore
from app.services.cohort_service import CohortService


async def cohort_pass_matrix(conn: asyncpg.Connection, cohort_id: str) -> Dict[str, Any]:
    """
    Cohort pass/fail matrix across simulations
    Show pass/fail rates for all students in a cohort.

    Input
      • conn - Database connection from asyncpg
      • cohort_id - UUID of the cohort

    Returns
      { "cohort": {…}, "matrix": [{…}], "summary": {…} }

    Quick-start
      ask:  "Show pass rates for cohort X"
      call: cohort_pass_matrix(conn, "uuid-here")

    See also cohort_overview() for cohort details.
    """
    service = CohortService(conn)
    return await service.get_cohort_pass_matrix(cohort_id)
