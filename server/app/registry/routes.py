"""
Route-derived registry constants.
Derived from ROUTE_PERMISSIONS in route_permissions.py.
"""

from __future__ import annotations

# role → artifacts accessible to that role
ROLE_ARTIFACTS: dict[str, frozenset[str]] = {
    "admin": frozenset(
        {
            "activity",
            "agent",
            "attempt",
            "benchmark",
            "chat",
            "cohort",
            "dashboard",
            "document",
            "field",
            "group",
            "health",
            "home",
            "invocation",
            "leaderboard",
            "model",
            "parameter",
            "persona",
            "practice",
            "pricing",
            "profile",
            "provider",
            "record",
            "reports",
            "scenario",
            "session",
            "setting",
            "simulation",
            "test",
            "tool",
        }
    ),
    "custom": frozenset({"benchmark", "invocation", "test"}),
    "guest": frozenset({"attempt", "chat", "practice"}),
    "instructional": frozenset(
        {
            "activity",
            "attempt",
            "benchmark",
            "chat",
            "cohort",
            "dashboard",
            "group",
            "home",
            "invocation",
            "leaderboard",
            "persona",
            "practice",
            "pricing",
            "record",
            "reports",
            "scenario",
            "session",
            "simulation",
            "test",
        }
    ),
    "member": frozenset({"attempt", "chat", "home", "leaderboard", "practice"}),
    "superadmin": frozenset(
        {
            "activity",
            "agent",
            "attempt",
            "auth",
            "benchmark",
            "chat",
            "cohort",
            "dashboard",
            "department",
            "document",
            "eval",
            "field",
            "group",
            "health",
            "home",
            "invocation",
            "leaderboard",
            "model",
            "parameter",
            "persona",
            "practice",
            "pricing",
            "profile",
            "provider",
            "record",
            "reports",
            "rubric",
            "scenario",
            "session",
            "setting",
            "simulation",
            "test",
            "tool",
        }
    ),
}

# artifact → route paths it unlocks
ARTIFACT_ROUTES: dict[str, frozenset[str]] = {
    "activity": frozenset({"/analytics/activity"}),
    "agent": frozenset(
        {
            "/intelligence/agents",
            "/intelligence/agents/[agentId]",
            "/intelligence/agents/new",
        }
    ),
    "attempt": frozenset(
        {"/attempt/[attemptId]", "/home/[attemptId]", "/practice/[attemptId]"}
    ),
    "auth": frozenset({"/system/auth", "/system/auth/[authId]", "/system/auth/new"}),
    "benchmark": frozenset({"/benchmark"}),
    "chat": frozenset(
        {
            "/chat/[chatId]",
            "/home/[attemptId]/[trainingId]",
            "/practice/[attemptId]/[trainingId]",
        }
    ),
    "cohort": frozenset(
        {"/training/cohorts", "/training/cohorts/[cohortId]", "/training/cohorts/new"}
    ),
    "dashboard": frozenset({"/analytics/dashboard"}),
    "department": frozenset(
        {
            "/system/departments",
            "/system/departments/[departmentId]",
            "/system/departments/new",
        }
    ),
    "document": frozenset(
        {
            "/management/documents",
            "/management/documents/[documentId]",
            "/management/documents/new",
        }
    ),
    "eval": frozenset({"/system/evals", "/system/evals/[evalId]", "/system/evals/new"}),
    "field": frozenset(
        {"/management/fields", "/management/fields/[fieldId]", "/management/fields/new"}
    ),
    "group": frozenset({"/analytics/pricing/[groupId]", "/group/[groupId]"}),
    "health": frozenset({"/health"}),
    "home": frozenset({"/home"}),
    "invocation": frozenset(
        {"/benchmark/[testId]/[suiteId]", "/invocation/[invocationId]"}
    ),
    "leaderboard": frozenset({"/leaderboard"}),
    "model": frozenset(
        {
            "/intelligence/models",
            "/intelligence/models/[modelId]",
            "/intelligence/models/new",
        }
    ),
    "parameter": frozenset(
        {
            "/management/parameters",
            "/management/parameters/[parameterId]",
            "/management/parameters/new",
        }
    ),
    "persona": frozenset(
        {
            "/training/personas",
            "/training/personas/[personaId]",
            "/training/personas/new",
        }
    ),
    "practice": frozenset({"/practice"}),
    "pricing": frozenset({"/analytics/pricing"}),
    "profile": frozenset(
        {"/management/staff", "/management/staff/[profileId]", "/management/staff/new"}
    ),
    "provider": frozenset(
        {
            "/intelligence/providers",
            "/intelligence/providers/[providerId]",
            "/intelligence/providers/new",
        }
    ),
    "record": frozenset({"/analytics/reports/[profileId]", "/record/[recordId]"}),
    "reports": frozenset({"/analytics/reports"}),
    "rubric": frozenset(
        {"/system/rubrics", "/system/rubrics/[rubricId]", "/system/rubrics/new"}
    ),
    "scenario": frozenset(
        {
            "/training/scenarios",
            "/training/scenarios/[scenarioId]",
            "/training/scenarios/new",
        }
    ),
    "session": frozenset({"/analytics/activity/[sessionId]", "/session/[sessionId]"}),
    "setting": frozenset({"/settings", "/settings/[settingId]", "/settings/new"}),
    "simulation": frozenset(
        {
            "/training/simulations",
            "/training/simulations/[simulationId]",
            "/training/simulations/new",
        }
    ),
    "test": frozenset({"/benchmark/[testId]", "/test/[testId]"}),
    "tool": frozenset(
        {
            "/intelligence/tools",
            "/intelligence/tools/[toolId]",
            "/intelligence/tools/new",
        }
    ),
}
