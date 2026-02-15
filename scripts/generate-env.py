#!/usr/bin/env python3
"""Generate .env from config.yaml.

No external dependencies — uses only Python stdlib.
Parses the specific YAML format used by config.yaml (flat/two-level nesting).

Usage:
    python3 scripts/generate-env.py                              # reads config.yaml
    python3 scripts/generate-env.py --config my-config.yaml      # reads specified file
    python3 scripts/generate-env.py --interactive                 # prompts for values
    python3 scripts/generate-env.py --output .env.production      # write to specific file
"""

import argparse
import re
import secrets
import sys
from datetime import UTC, datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# YAML → .env field mapping
# ---------------------------------------------------------------------------
# Each entry: (yaml_path, env_var, default, description)
FIELD_MAP = [
    # Instance
    ("instance.name", "COMPOSE_PROJECT_NAME", "glow", "Docker compose project name"),
    ("instance.port", "CLIENT_PORT", "3000", "External port (nginx)"),
    # Domain
    ("domain.origin", "ORIGIN", "http://localhost:3000", "Public URL origin"),
    ("domain.prefix", "APP_PREFIX", "", "URL prefix (e.g. /glow or empty)"),
    # Institution
    (
        "institution.name",
        "NEXT_PUBLIC_CAMPUS",
        "University Name",
        "Institution display name",
    ),
    # Database
    ("database.user", "DB_USER", "myuser", "Database username"),
    ("database.password", "DB_PASSWORD", "mypassword", "Database password"),
    ("database.name", "DB_NAME", "mydb", "Database name"),
    (
        "database.operation",
        "DB_OPERATION",
        "auto",
        "DB init mode: auto, modules, restore, or skip",
    ),
    # Auth
    (
        "auth.secret",
        "AUTH_SECRET",
        "__auto__",
        "Auth.js secret (auto-generated if blank)",
    ),
    (
        "auth.secret_key",
        "SECRET_KEY",
        "__auto__",
        "JWT signing key (auto-generated if blank)",
    ),
    (
        "auth.keycloak.admin_password",
        "KEYCLOAK_ADMIN_PASSWORD",
        "admin",
        "Keycloak admin password",
    ),
    ("auth.keycloak.realm", "KEYCLOAK_REALM", "master", "Keycloak realm"),
    (
        "auth.keycloak.client_id",
        "AUTH_KEYCLOAK_ID",
        "glow-client",
        "Keycloak client ID",
    ),
    (
        "auth.keycloak.client_secret",
        "AUTH_KEYCLOAK_SECRET",
        "",
        "Keycloak client secret",
    ),
    # Redis
    ("redis.url", "REDIS_URL", "redis://localhost:6380", "Redis URL"),
]

# These are always derived/constant — not in the YAML
DERIVED_VARS = [
    # APP_PREFIX is duplicated to NEXT_PUBLIC_APP_PREFIX
    ("NEXT_PUBLIC_APP_PREFIX", lambda v: v.get("APP_PREFIX", "")),
    # AUTH_URL derived from ORIGIN + APP_PREFIX
    ("AUTH_URL", lambda v: f"{v['ORIGIN']}{v['APP_PREFIX']}/api/auth"),
    # Keycloak URLs derived from ORIGIN + APP_PREFIX
    ("KEYCLOAK_PUBLIC_URL", lambda v: f"{v['ORIGIN']}{v['APP_PREFIX']}/auth"),
    ("NEXT_PUBLIC_KEYCLOAK_URL", lambda v: f"{v['ORIGIN']}{v['APP_PREFIX']}/auth"),
    (
        "NEXT_PUBLIC_AUTH_KEYCLOAK_ID",
        lambda v: v.get("AUTH_KEYCLOAK_ID", "glow-client"),
    ),
    # Compose bake
    ("COMPOSE_BAKE", lambda _: "true"),
    # Local defaults (overridden in Docker)
    ("DB_PORT", lambda _: "5432"),
    ("DB_HOST", lambda _: "localhost"),
    ("INTERNAL_API_BASE", lambda _: "http://localhost:8000"),
    ("NEXT_PUBLIC_API_BASE", lambda _: "http://localhost:8000"),
]


# ---------------------------------------------------------------------------
# Simple YAML parser (stdlib only, handles our specific format)
# ---------------------------------------------------------------------------
def parse_yaml(text: str) -> dict:
    """Parse a simple YAML file into a nested dict.

    Handles:
      - Comments (# ...)
      - Scalar values: key: "value" or key: value
      - Nested maps up to 3 levels deep (2-space indent per level)
      - Booleans: true/false
      - Numbers: integers
    """
    result: dict = {}
    stack: list[tuple[int, dict]] = [(-1, result)]

    for line in text.splitlines():
        stripped = line.rstrip()
        if not stripped or stripped.lstrip().startswith("#"):
            continue

        # Measure indent (before stripping)
        indent = len(stripped) - len(stripped.lstrip())
        stripped = stripped.strip()

        # Pop stack to find parent
        while stack and stack[-1][0] >= indent:
            stack.pop()

        parent = stack[-1][1] if stack else result

        # Parse key: value — extract key and raw remainder
        match = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)", stripped)
        if not match:
            continue

        key = match.group(1)
        raw_value = match.group(2).strip()

        if not raw_value:
            # This is a mapping key — create nested dict
            child: dict = {}
            parent[key] = child
            stack.append((indent, child))
        else:
            # Scalar value — parse with comment awareness
            parent[key] = _parse_scalar(raw_value)
            # Don't push to stack — scalars have no children

    return result


def _parse_scalar(s: str) -> str:
    """Parse a YAML scalar value to a Python string.

    Handles quoted strings (strips quotes first, ignoring trailing comments),
    unquoted strings (strips inline # comments), and booleans.
    """
    # Quoted string: find matching close quote, ignore everything after
    if s.startswith('"'):
        end = s.find('"', 1)
        if end != -1:
            return s[1:end]
        return s[1:]  # unclosed quote — take everything
    if s.startswith("'"):
        end = s.find("'", 1)
        if end != -1:
            return s[1:end]
        return s[1:]

    # Unquoted: strip inline comment (` # ...` or `  # ...`)
    s = re.sub(r"\s+#.*$", "", s).strip()
    # Boolean
    if s.lower() == "true":
        return "true"
    if s.lower() == "false":
        return "false"
    return s


def get_nested(d: dict, path: str, default: str = "") -> str:
    """Get a value from a nested dict using dot notation."""
    keys = path.split(".")
    current = d
    for k in keys:
        if not isinstance(current, dict) or k not in current:
            return default
        current = current[k]
    return str(current) if current is not None else default


# ---------------------------------------------------------------------------
# Interactive mode
# ---------------------------------------------------------------------------
def prompt_values() -> dict[str, str]:
    """Interactively prompt for configuration values."""
    print("Glow Configuration Setup")
    print("=" * 50)
    print("Press Enter to accept defaults shown in [brackets].\n")

    values: dict[str, str] = {}
    for yaml_path, env_var, default, description in FIELD_MAP:
        display_default = "(auto-generated)" if default == "__auto__" else default
        raw = input(f"  {description} [{display_default}]: ").strip()
        if raw:
            values[env_var] = raw
        elif default == "__auto__":
            values[env_var] = ""  # Will be auto-generated later
        else:
            values[env_var] = default

    return values


# ---------------------------------------------------------------------------
# Generate .env
# ---------------------------------------------------------------------------
def generate_env(config_path: str | None, interactive: bool, output_path: str) -> None:
    values: dict[str, str] = {}

    if interactive:
        values = prompt_values()
    elif config_path:
        path = Path(config_path)
        if not path.exists():
            print(f"ERROR: Config file not found: {config_path}", file=sys.stderr)
            print(
                "Copy config.example.yaml to config.yaml and fill in your values.",
                file=sys.stderr,
            )
            sys.exit(1)

        data = parse_yaml(path.read_text())

        for yaml_path, env_var, default, _desc in FIELD_MAP:
            raw = get_nested(data, yaml_path, "")
            if raw:
                values[env_var] = raw
            elif default == "__auto__":
                values[env_var] = ""  # Will be auto-generated
            else:
                values[env_var] = default

    # Auto-generate secrets if blank
    for secret_var in ("AUTH_SECRET", "SECRET_KEY"):
        if not values.get(secret_var):
            values[secret_var] = secrets.token_urlsafe(32)
            print(f"  Auto-generated {secret_var}")

    # Compute derived variables
    for env_var, derive_fn in DERIVED_VARS:
        values[env_var] = derive_fn(values)

    # Write .env
    timestamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [
        "# Do not edit — auto-generated from config.yaml",
        "# Generated by: python3 scripts/generate-env.py",
        f"# Timestamp: {timestamp}",
        f"# Source: {config_path or 'interactive'}",
        "",
        "# Instance",
        f'COMPOSE_PROJECT_NAME="{values["COMPOSE_PROJECT_NAME"]}"',
        f'CLIENT_PORT="{values["CLIENT_PORT"]}"',
        "",
        "# Domain",
        f'ORIGIN="{values["ORIGIN"]}"',
        f'APP_PREFIX="{values["APP_PREFIX"]}"',
        f'NEXT_PUBLIC_APP_PREFIX="{values["NEXT_PUBLIC_APP_PREFIX"]}"',
        "",
        "# Institution",
        f'NEXT_PUBLIC_CAMPUS="{values["NEXT_PUBLIC_CAMPUS"]}"',
        "",
        "# Database",
        f'DB_USER="{values["DB_USER"]}"',
        f'DB_PASSWORD="{values["DB_PASSWORD"]}"',
        f'DB_NAME="{values["DB_NAME"]}"',
        f'DB_OPERATION="{values["DB_OPERATION"]}"',
        f'COMPOSE_BAKE="{values["COMPOSE_BAKE"]}"',
        "",
        "# Auth",
        f'AUTH_SECRET="{values["AUTH_SECRET"]}"',
        f'SECRET_KEY="{values["SECRET_KEY"]}"',
        f'AUTH_URL="{values["AUTH_URL"]}"',
        f'KEYCLOAK_ADMIN_PASSWORD="{values["KEYCLOAK_ADMIN_PASSWORD"]}"',
        f'KEYCLOAK_REALM="{values["KEYCLOAK_REALM"]}"',
        f'AUTH_KEYCLOAK_ID="{values["AUTH_KEYCLOAK_ID"]}"',
        f'AUTH_KEYCLOAK_SECRET="{values["AUTH_KEYCLOAK_SECRET"]}"',
        f'KEYCLOAK_PUBLIC_URL="{values["KEYCLOAK_PUBLIC_URL"]}"',
        f'NEXT_PUBLIC_KEYCLOAK_URL="{values["NEXT_PUBLIC_KEYCLOAK_URL"]}"',
        f'NEXT_PUBLIC_AUTH_KEYCLOAK_ID="{values["NEXT_PUBLIC_AUTH_KEYCLOAK_ID"]}"',
        "",
        "# Redis",
        f'REDIS_URL="{values["REDIS_URL"]}"',
        "",
        "# Network (defaults — overridden inside Docker)",
        f'DB_PORT="{values["DB_PORT"]}"',
        f'DB_HOST="{values["DB_HOST"]}"',
        f'INTERNAL_API_BASE="{values["INTERNAL_API_BASE"]}"',
        f'NEXT_PUBLIC_API_BASE="{values["NEXT_PUBLIC_API_BASE"]}"',
        "",
    ]

    Path(output_path).write_text("\n".join(lines))
    print(f"\n  Generated {output_path}")
    print(f"  DB_OPERATION={values['DB_OPERATION']}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Generate .env from config.yaml")
    parser.add_argument(
        "--config",
        "-c",
        default="config.yaml",
        help="Path to YAML config file (default: config.yaml)",
    )
    parser.add_argument(
        "--interactive",
        "-i",
        action="store_true",
        help="Prompt for values interactively",
    )
    parser.add_argument(
        "--output", "-o", default=".env", help="Output .env file path (default: .env)"
    )
    args = parser.parse_args()

    generate_env(
        config_path=None if args.interactive else args.config,
        interactive=args.interactive,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
