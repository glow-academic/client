"""Auth module — shared types and route permissions.

All auth endpoints have been replaced by canonical artifact endpoints:
- /auth/profile → POST /artifacts/profiles/context
- /auth/settings → theme primitives in profile context response
- /auth/config → /.well-known/oauth-authorization-server

Remaining files:
- types.py — AnalyticsFacets, AnalyticsFilterFields, ResolveGroupApi*, SettingsAgentToolEntry
- route_permissions.py — ROUTE_PERMISSIONS, compute_available_sections
"""
