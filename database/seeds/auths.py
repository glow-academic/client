"""Module 06 — Auth seed definitions."""

ITEMS = [
    {
        "id": "019b3be4-3117-7aa4-aa34-0041aa51d1d8",
        "name": "Google",
        "description": "Google Workspace",
        "slug": "google",
        "protocol": "google",
        "active_flag_id": "019be334-bfc4-79b2-949c-9f99ea25d2c0",
        "items": [
            {"id": "019b3be4-3119-7fdf-908e-6a6b9430f085", "name": "clientId", "description": "Google Client ID", "encrypted": True, "position": 2},
            {"id": "019b3be4-3119-7fae-9dea-08a64aff6240", "name": "clientSecret", "description": "Google Client Secret", "encrypted": True, "position": 1},
        ],
    },
    {
        "id": "019b3be4-3117-7afc-8d1d-a2815d70f294",
        "name": "Microsoft",
        "description": "Microsoft Entra ID OAuth configuration",
        "slug": "microsoft",
        "protocol": "oidc",
        "active_flag_id": "019be334-bfc4-79b2-949c-9f99ea25d2c0",
        "items": [
            {"id": "019b3be4-3119-7feb-9764-0741b7080380", "name": "clientSecret", "description": "Microsoft Entra ID Client Secret", "encrypted": True, "position": 1},
            {"id": "019b3be4-3119-7fed-b752-bf6209d31c1d", "name": "clientId", "description": "Microsoft Entra ID Client ID", "encrypted": True, "position": 2},
            {"id": "019b3be4-3119-7ff4-a277-aa213eac5632", "name": "tenantId", "description": "Microsoft Tenant ID", "encrypted": False, "position": 3},
            {"id": "019b3be4-3119-7ff8-9a20-27a9c8e586d5", "name": "userInfoUrl", "description": "Microsoft UserInfo Endpoint", "encrypted": False, "position": 4},
            {"id": "019b3be4-311a-7004-bc8a-cd80f62b310e", "name": "discoveryUrl", "description": "Microsoft Discovery URL", "encrypted": False, "position": 5},
            {"id": "019b3be4-311a-7008-8bba-868f8b70fe13", "name": "clientAuthMethod", "description": "Microsoft Client Auth Method", "encrypted": False, "position": 6},
            {"id": "019b3be4-311a-700d-8fc0-9ba72a9bd318", "name": "authorizationUrl", "description": "Microsoft Authorization Endpoint", "encrypted": False, "position": 7},
            {"id": "019b3be4-311a-7014-96a8-573949e45256", "name": "tokenUrl", "description": "Microsoft Token Endpoint", "encrypted": False, "position": 8},
        ],
    },
]
