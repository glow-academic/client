# student_sim_report.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
# Refactored: SQL logic moved to profile_service.py

from typing import Any, Dict

import asyncpg  # type: ignore
from app.services.profile_service import ProfileService


async def student_sim_report(conn: asyncpg.Connection, profile_id: str, recent: int = 50) -> Dict[str, Any]:
    """
    Deep dive: every attempt, chat, grade, feedback
    Comprehensive student simulation report.

    Input
      • conn - Database connection from asyncpg
      • profile_id - UUID of the student profile
      • recent - Limit messages per chat (default: 50)

    Returns
      { "profile": { … }, "attempts": [ … ] }

    Quick-start
      ask:  "Full report on student X"
      call: student_sim_report(conn, "uuid-here")

    See also profile_overview() for summary view.
    """
    service = ProfileService(conn)
    return await service.get_student_simulation_report(profile_id, recent)
