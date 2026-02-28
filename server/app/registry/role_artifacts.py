"""role → artifacts accessible to that role."""

from __future__ import annotations

ROLE_ARTIFACTS: dict[str, frozenset[str]] = {
    "admin": frozenset(
        {
            "attempt",
            "chat",
            "cohort",
            "dashboard",
            "group",
            "home",
            "leaderboard",
            "persona",
            "practice",
            "pricing",
            "record",
            "reports",
            "scenario",
            "simulation",
        }
    ),
    "guest": frozenset({"attempt", "chat", "practice"}),
    "instructional": frozenset(
        {
            "attempt",
            "chat",
            "cohort",
            "dashboard",
            "group",
            "home",
            "leaderboard",
            "persona",
            "practice",
            "pricing",
            "record",
            "reports",
            "scenario",
            "simulation",
        }
    ),
    "member": frozenset(
        {
            "attempt",
            "chat",
            "home",
            "leaderboard",
            "practice",
        }
    ),
    "superadmin": frozenset(
        {
            "attempt",
            "chat",
            "cohort",
            "dashboard",
            "group",
            "home",
            "leaderboard",
            "persona",
            "practice",
            "pricing",
            "record",
            "reports",
            "scenario",
            "simulation",
        }
    ),
}
