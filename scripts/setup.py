#!/usr/bin/env python3
"""Interactive setup wizard for Glow.

Discovers available modules, prompts for configuration, writes config.yaml,
and calls generate-env.py to produce .env.

No external dependencies — uses only Python stdlib.
"""

import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODULES_DIR = PROJECT_ROOT / "database" / "modules"
CONFIG_FILE = PROJECT_ROOT / "config.yaml"
EXAMPLE_FILE = PROJECT_ROOT / "config.example.yaml"

# Module directories that map to root-level YAML keys (order matters)
ROOT_MODULES = [
    ("providers", "01-providers"),
    ("agents", "03-agents"),
    ("tools", "04-tools"),
    ("auth", "05-auth"),
    ("rubrics", "06-rubrics"),
    ("evals", "07-evals"),
    ("profiles", "08-profiles"),
    ("settings", "09-settings"),
]

# ---------------------------------------------------------------------------
# Terminal helpers
# ---------------------------------------------------------------------------
CYAN = "\033[0;36m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
BOLD = "\033[1m"
NC = "\033[0m"


def color(text: str, c: str) -> str:
    return f"{c}{text}{NC}"


def prompt(label: str, default: str = "") -> str:
    """Prompt for a single value with an optional default."""
    suffix = f" [{default}]" if default else ""
    raw = input(f"  {label}{suffix}: ").strip()
    return raw if raw else default


def prompt_choice(label: str, options: list[str], default: str = "") -> str:
    """Prompt user to pick one option."""
    print(f"\n  {color(label, CYAN)}")
    for i, opt in enumerate(options, 1):
        marker = " (default)" if opt == default else ""
        print(f"    {i}) {opt}{marker}")
    while True:
        raw = input(f"  Choice [1-{len(options)}]: ").strip()
        if not raw and default:
            return default
        if raw.isdigit() and 1 <= int(raw) <= len(options):
            return options[int(raw) - 1]
        print(f"  {color('Invalid choice', RED)}")


def prompt_module_selection(label: str, items: list[str]) -> str | list[str]:
    """Prompt: [a]ll (recommended), [s]elect, [n]one."""
    print(f"\n  {color(label, CYAN)} ({len(items)} available)")
    print("    [a] All (recommended)  [s] Select individually  [n] None")
    while True:
        raw = input("  Choice [a/s/n]: ").strip().lower()
        if raw in ("a", ""):
            return "all"
        if raw == "n":
            return []
        if raw == "s":
            return _select_items(items)
        print(f"  {color('Enter a, s, or n', RED)}")


def _select_items(items: list[str]) -> list[str]:
    """Show numbered list, user enters space-separated numbers."""
    for i, item in enumerate(items, 1):
        print(f"    {i}) {item}")
    while True:
        raw = input("  Enter numbers (space-separated): ").strip()
        if not raw:
            continue
        selected = []
        valid = True
        for tok in raw.split():
            if tok.isdigit() and 1 <= int(tok) <= len(items):
                selected.append(items[int(tok) - 1])
            else:
                print(f"  {color(f'Invalid: {tok}', RED)}")
                valid = False
                break
        if valid and selected:
            return selected


# ---------------------------------------------------------------------------
# Module discovery
# ---------------------------------------------------------------------------
def list_sql_stems(directory: Path) -> list[str]:
    """List .sql file stems in a directory, sorted."""
    if not directory.is_dir():
        return []
    return sorted(p.stem for p in directory.iterdir() if p.suffix == ".sql")


def list_subdirs(directory: Path) -> list[str]:
    """List subdirectory names, sorted."""
    if not directory.is_dir():
        return []
    return sorted(d.name for d in directory.iterdir() if d.is_dir())


# ---------------------------------------------------------------------------
# YAML writer (stdlib, no pyyaml)
# ---------------------------------------------------------------------------
def yaml_scalar(value: str) -> str:
    """Format a scalar for YAML output."""
    if not value:
        return '""'
    # Quote if it contains special chars or looks like a number/bool
    if any(c in value for c in ":{}[]#&*!|>'\"%@`") or value.lower() in (
        "true",
        "false",
        "null",
        "yes",
        "no",
    ):
        return f'"{value}"'
    # Quote if purely numeric
    try:
        float(value)
        return f'"{value}"'
    except ValueError:
        pass
    return f'"{value}"'


def write_config(data: dict) -> str:
    """Serialize config dict to YAML string."""
    lines: list[str] = []
    lines.append(
        "# ============================================================================="
    )
    lines.append("# Glow Configuration — generated by setup wizard")
    lines.append(
        "# ============================================================================="
    )
    lines.append("")

    # --- Instance ---
    lines.append("# Instance")
    lines.append("instance:")
    lines.append(f"  name: {yaml_scalar(data['instance_name'])}")
    lines.append(f"  port: {data['instance_port']}")
    lines.append("")

    # --- Domain ---
    lines.append("# Domain")
    lines.append("domain:")
    lines.append(f"  origin: {yaml_scalar(data['domain_origin'])}")
    lines.append(f"  prefix: {yaml_scalar(data['domain_prefix'])}")
    lines.append("")

    # --- Institution ---
    lines.append("# Institution")
    lines.append("institution:")
    lines.append(f"  name: {yaml_scalar(data['institution_name'])}")
    lines.append(f"  email_domain: {yaml_scalar(data['institution_email'])}")
    lines.append("")

    # --- Database ---
    lines.append("# Database")
    lines.append("database:")
    lines.append(f"  user: {yaml_scalar(data['db_user'])}")
    lines.append(f"  password: {yaml_scalar(data['db_password'])}")
    lines.append(f"  name: {yaml_scalar(data['db_name'])}")
    lines.append(f"  operation: {yaml_scalar(data['db_operation'])}")
    lines.append("")

    # --- Auth ---
    lines.append("# Auth")
    lines.append("auth:")
    lines.append(f"  secret: {yaml_scalar(data.get('auth_secret', ''))}")
    lines.append(f"  secret_key: {yaml_scalar(data.get('auth_secret_key', ''))}")
    lines.append("  keycloak:")
    lines.append(
        f"    admin_password: {yaml_scalar(data.get('keycloak_password', 'admin'))}"
    )
    lines.append(f"    realm: {yaml_scalar(data.get('keycloak_realm', 'master'))}")
    lines.append(
        f"    client_id: {yaml_scalar(data.get('keycloak_client_id', 'glow-client'))}"
    )
    lines.append("  microsoft:")
    lines.append(f"    client_id: {yaml_scalar(data.get('microsoft_client_id', ''))}")
    lines.append(
        f"    client_secret: {yaml_scalar(data.get('microsoft_client_secret', ''))}"
    )
    lines.append("")

    # --- Providers ---
    lines.append("# AI Providers")
    lines.append("providers:")
    lines.append(f"  openai_api_key: {yaml_scalar(data.get('openai_api_key', ''))}")
    lines.append(f"  gemini_api_key: {yaml_scalar(data.get('gemini_api_key', ''))}")
    lines.append("")

    # --- Install ---
    lines.append("# Install Mode")
    lines.append("install:")
    lines.append("  use_prebuilt_images: false")
    lines.append('  image_tag: "latest"')
    lines.append("")

    # --- Modules ---
    lines.append("# Seed Modules")
    lines.append("modules:")
    modules = data["modules"]

    def write_module_list(key: str, indent: int = 2):
        val = modules.get(key)
        if val is None or val == []:
            return
        prefix = "  " * indent
        if val == "all":
            lines.append(f"{prefix}{key}: all")
        elif isinstance(val, list):
            lines.append(f"{prefix}{key}:")
            for item in val:
                lines.append(f"{prefix}  - {item}")
        elif isinstance(val, dict):
            lines.append(f"{prefix}{key}:")
            for sub_key, sub_val in val.items():
                if sub_val == "all":
                    lines.append(f"{prefix}  {sub_key}: all")
                elif isinstance(sub_val, list):
                    lines.append(f"{prefix}  {sub_key}:")
                    for item in sub_val:
                        lines.append(f"{prefix}    - {item}")

    # Root modules
    write_module_list("providers")
    lines.append("")

    # Models (nested by provider)
    if "models" in modules:
        write_module_list("models")
        lines.append("")

    write_module_list("agents")
    write_module_list("tools")
    write_module_list("auth")
    write_module_list("rubrics")
    write_module_list("evals")
    write_module_list("profiles")
    write_module_list("settings")
    lines.append("")

    # Setup type
    setup = modules.get("setup", "")
    if setup:
        lines.append(f"  setup: {setup}")
        lines.append("")

    # Organization modules
    if "organization" in modules and modules["organization"]:
        lines.append("  organization:")
        org = modules["organization"]
        for cat_key, cat_val in org.items():
            if cat_val == "all":
                lines.append(f"    {cat_key}: all")
            elif isinstance(cat_val, list) and cat_val:
                lines.append(f"    {cat_key}:")
                for item in cat_val:
                    lines.append(f"      - {item}")
        lines.append("")

    # Setup-specific modules (e.g. university)
    for setup_name in list_subdirs(MODULES_DIR / "10-setups"):
        if setup_name == "organization":
            continue
        if setup_name in modules and modules[setup_name]:
            lines.append(f"  {setup_name}:")
            setup_data = modules[setup_name]
            for cat_key, cat_val in setup_data.items():
                if cat_val == "all":
                    lines.append(f"    {cat_key}: all")
                elif isinstance(cat_val, list) and cat_val:
                    lines.append(f"    {cat_key}:")
                    for item in cat_val:
                        lines.append(f"      - {item}")
            lines.append("")

    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Main interactive flow
# ---------------------------------------------------------------------------
def main() -> None:
    print(f"\n{color('Glow Setup Wizard', BOLD)}")
    print("=" * 50)
    print("This wizard writes config.yaml and generates .env.\n")

    data: dict = {}

    # ── 1. Infrastructure ──────────────────────────────────────────────
    print(color("\n1. Infrastructure", BOLD))
    data["institution_name"] = prompt("Institution name", "University Name")
    data["institution_email"] = prompt("Email domain", "university.edu")
    data["domain_origin"] = prompt("Public URL (origin)", "https://glow.university.edu")
    data["domain_prefix"] = prompt("URL prefix (e.g. /glow, or empty)", "")
    data["instance_name"] = prompt("Docker project name", "glow")
    data["instance_port"] = prompt("External port", "3000")

    # ── 2. Database ────────────────────────────────────────────────────
    print(color("\n2. Database", BOLD))
    data["db_user"] = prompt("Database user", "myuser")
    data["db_password"] = prompt("Database password", "mypassword")
    data["db_name"] = prompt("Database name", "mydb")
    data["db_operation"] = prompt_choice(
        "Database operation mode:",
        ["auto", "modules", "restore", "skip"],
        default="auto",
    )

    # ── 3. Auth ────────────────────────────────────────────────────────
    print(color("\n3. Auth", BOLD))
    data["auth_secret"] = prompt("AUTH_SECRET (blank = auto-generate)", "")
    data["auth_secret_key"] = prompt("SECRET_KEY for JWT (blank = auto-generate)", "")
    data["keycloak_password"] = prompt("Keycloak admin password", "admin")
    data["keycloak_realm"] = prompt("Keycloak realm", "master")
    data["keycloak_client_id"] = prompt("Keycloak client ID", "glow-client")
    data["microsoft_client_id"] = prompt(
        "Microsoft Entra client ID (blank to skip)", ""
    )
    data["microsoft_client_secret"] = prompt("Microsoft Entra client secret", "")

    # ── 4. AI Providers ────────────────────────────────────────────────
    print(color("\n4. AI Providers", BOLD))
    data["openai_api_key"] = prompt("OpenAI API key (blank to skip)", "")
    data["gemini_api_key"] = prompt("Gemini API key (blank to skip)", "")

    # ── 5. Module Selection ────────────────────────────────────────────
    print(color("\n5. Module Selection", BOLD))
    modules: dict = {}

    # Root modules (excluding models which are nested)
    for yaml_key, folder in ROOT_MODULES:
        dir_path = MODULES_DIR / folder
        items = list_sql_stems(dir_path)
        if not items:
            continue
        result = prompt_module_selection(f"{yaml_key} ({folder}/)", items)
        if result:
            modules[yaml_key] = result

    # Models (grouped by provider)
    models_dir = MODULES_DIR / "02-models"
    providers = list_subdirs(models_dir)
    if providers:
        print(f"\n  {color('models (02-models/) — grouped by provider', CYAN)}")
        models_config: dict = {}
        for provider in providers:
            items = list_sql_stems(models_dir / provider)
            if not items:
                continue
            result = prompt_module_selection(f"  models/{provider}", items)
            if result:
                models_config[provider] = result
        if models_config:
            modules["models"] = models_config

    # ── 6. Setup Type ──────────────────────────────────────────────────
    print(color("\n6. Setup Type", BOLD))
    setups_dir = MODULES_DIR / "10-setups"
    setup_types = list_subdirs(setups_dir)

    if setup_types:
        # Organization is always loaded separately; pick the main setup type
        non_org = [s for s in setup_types if s != "organization"]
        if non_org:
            setup_type = prompt_choice("Setup type:", non_org, default=non_org[0])
            modules["setup"] = setup_type
        else:
            setup_type = ""

        # Organization modules (always shown if dir exists)
        org_dir = setups_dir / "organization"
        if org_dir.is_dir():
            print(color("\n  Organization modules (always available):", CYAN))
            org_config: dict = {}
            for cat_dir in sorted(org_dir.iterdir()):
                if not cat_dir.is_dir():
                    continue
                # Extract category name from dir like "01-departments" -> "departments"
                cat_name = (
                    cat_dir.name.split("-", 1)[1]
                    if "-" in cat_dir.name
                    else cat_dir.name
                )
                items = list_sql_stems(cat_dir)
                if not items:
                    continue
                result = prompt_module_selection(f"  organization/{cat_name}", items)
                if result:
                    org_config[cat_name] = result
            if org_config:
                modules["organization"] = org_config

        # Setup-specific categories
        if setup_type:
            setup_dir = setups_dir / setup_type
            if setup_dir.is_dir():
                print(color(f"\n  {setup_type} modules:", CYAN))
                setup_config: dict = {}
                for cat_dir in sorted(setup_dir.iterdir()):
                    if not cat_dir.is_dir():
                        continue
                    # Skip auth dirs (always loaded automatically)
                    if cat_dir.name.startswith("00-"):
                        continue
                    cat_name = (
                        cat_dir.name.split("-", 1)[1]
                        if "-" in cat_dir.name
                        else cat_dir.name
                    )
                    items = list_sql_stems(cat_dir)
                    if not items:
                        continue
                    result = prompt_module_selection(
                        f"  {setup_type}/{cat_name}", items
                    )
                    if result:
                        setup_config[cat_name] = result
                if setup_config:
                    modules[setup_type] = setup_config

    data["modules"] = modules

    # ── Write config.yaml ──────────────────────────────────────────────
    yaml_content = write_config(data)
    CONFIG_FILE.write_text(yaml_content)
    print(f"\n{color('Written:', GREEN)} {CONFIG_FILE}")

    # ── Generate .env ──────────────────────────────────────────────────
    print(f"\n{color('Generating .env...', CYAN)}")
    result = subprocess.run(
        [sys.executable, str(PROJECT_ROOT / "scripts" / "generate-env.py")],
        cwd=str(PROJECT_ROOT),
    )
    if result.returncode != 0:
        print(f"{color('Warning: .env generation failed', RED)}")

    # ── Summary ────────────────────────────────────────────────────────
    print(f"\n{color('Setup complete!', GREEN)}")
    print("\nNext steps:")
    print("  make deploy         # Build seed SQL and start services")
    print("  make deploy-clean   # Same but wipes volumes first")
    print("")


if __name__ == "__main__":
    main()
