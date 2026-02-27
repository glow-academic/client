#!/usr/bin/env python3
"""Generate registry files from database introspection and filesystem scanning.

Usage:
    python server/scripts/generate_registry.py all          # Generate all registry files
    python server/scripts/generate_registry.py resources     # Generate resources.py
    python server/scripts/generate_registry.py entries       # Generate entries.py
    python server/scripts/generate_registry.py entry_views   # Generate entry_views.py
    python server/scripts/generate_registry.py relations     # Generate relations.py
    python server/scripts/generate_registry.py artifacts     # Generate artifacts.py
    python server/scripts/generate_registry.py routes        # Generate routes.py
    python server/scripts/generate_registry.py validate      # Validate generated vs current
"""

from __future__ import annotations

import difflib
import sys
from pathlib import Path

# Ensure server/ is on the path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SERVER_DIR = PROJECT_ROOT / "server"
sys.path.insert(0, str(SERVER_DIR))

from scripts.registry_generators.formatter import (
    format_dict_of_dicts,
    format_dict_of_frozensets,
    format_dict_of_strings,
    write_registry_file,
)

REGISTRY_DIR = SERVER_DIR / "app" / "registry"


# ---------------------------------------------------------------------------
# Individual generators
# ---------------------------------------------------------------------------


def gen_resources() -> str:
    """Generate resources.py content."""
    from scripts.registry_generators.resources_gen import generate_resource_schemas
    from app.registry.manual import RESOURCE_OUTPUT_SCHEMAS

    schemas = generate_resource_schemas()

    parts = [
        '"""Per-resource-type column schemas.',
        "",
        "Business columns only — excludes system columns (id, created_at, active, generated, mcp)",
        "that are present on every resource table.",
        "",
        'Type strings: text, int, float, numeric, bool, uuid, array, enum, timestamp',
        '"""',
        "",
        format_dict_of_dicts(
            "RESOURCE_SCHEMAS",
            "dict[str, dict[str, str]]",
            schemas,
        ),
        "",
        "# resource_outputs_relation (resource_type → output schema fields)",
        "# Simplified types (string/number/boolean) for the tool-facing output contract.",
        _format_resource_output_schemas(RESOURCE_OUTPUT_SCHEMAS),
        "",
    ]
    return "\n".join(parts)


def _format_resource_output_schemas(data: dict[str, list[dict[str, str]]]) -> str:
    """Format RESOURCE_OUTPUT_SCHEMAS as Python source."""
    lines = ["RESOURCE_OUTPUT_SCHEMAS: dict[str, list[dict[str, str]]] = {"]
    for key in sorted(data.keys()):
        items = data[key]
        if len(items) == 1:
            item = items[0]
            lines.append(
                f'    "{key}": [{{"field_type": "{item["field_type"]}", "name": "{item["name"]}"}}],'
            )
        else:
            lines.append(f'    "{key}": [')
            for item in items:
                lines.append(
                    f'        {{"field_type": "{item["field_type"]}", "name": "{item["name"]}"}},'
                )
            lines.append("    ],")
    lines.append("}")
    return "\n".join(lines)


def gen_entries() -> str:
    """Generate entries.py content."""
    from scripts.registry_generators.entries_gen import generate_entry_schemas

    schemas = generate_entry_schemas()

    parts = [
        '"""Per-entry-type column schemas for tool-targetable entries.',
        "",
        "Only includes entry types reachable via entry_tools_relation or tool_bindings_junction.",
        "Business columns only — excludes system columns (id, created_at, active, generated, mcp).",
        "",
        "Entry type keys match the entry_type enum values (unprefixed).",
        "For highlights/replacements, columns come from the standalone tables (not attempt_* variants).",
        "",
        'Type strings: text, int, float, numeric, bool, uuid, array, enum, timestamp',
        '"""',
        "",
        format_dict_of_dicts(
            "ENTRY_SCHEMAS",
            "dict[str, dict[str, str]]",
            schemas,
        ),
    ]
    return "\n".join(parts)


def gen_entry_views() -> str:
    """Generate entry_views.py content."""
    from scripts.registry_generators.entry_views_gen import generate_entry_view_schemas

    schemas, names = generate_entry_view_schemas()

    parts = [
        '"""Per-entry-type materialized view schemas.',
        "",
        "Each tool-targetable entry type has a corresponding MV that consumers read from.",
        "These schemas represent the SELECT columns of each MV — distinct from ENTRY_SCHEMAS",
        "which represent the table columns tools write to.",
        "",
        "Differences from ENTRY_SCHEMAS:",
        "- IDs renamed: entry.id → {type}_id (e.g. analysis_id, content_id)",
        "- Joined columns added (e.g. standard_id on feedbacks, question_id/option_id on responses)",
        "- Computed columns (e.g. idx via ROW_NUMBER on contents/hints)",
        "- Type casts (e.g. total::float on feedbacks, score::float on grades)",
        "- Internal columns dropped (e.g. call_id, updated_at filtered out by most MVs)",
        "",
        "MV name mapping:",
    ]

    # Add MV name mapping comments
    for entry_key in sorted(names.keys()):
        mv_name = names[entry_key]
        parts.append(f"  {entry_key:14s} → {mv_name}")

    parts.extend([
        "",
        'Type strings: text, int, float, numeric, bool, uuid, array, enum, timestamp',
        '"""',
        "",
        format_dict_of_dicts(
            "ENTRY_VIEW_SCHEMAS",
            "dict[str, dict[str, str]]",
            schemas,
        ),
        "",
        format_dict_of_strings(
            "ENTRY_VIEW_NAMES",
            "dict[str, str]",
            names,
        ),
    ])
    return "\n".join(parts)


def gen_relations() -> str:
    """Generate relations.py content."""
    from scripts.registry_generators.relations_gen import generate_all_relations

    # Get resource keys that should have modalities
    # Read current file to determine which resources have modalities
    from app.registry.relations import RESOURCE_MODALITIES as current_modalities

    relations = generate_all_relations(
        modality_resource_keys=sorted(current_modalities.keys()),
    )

    parts = [
        '"""',
        "Domain registry — static enum-to-enum mappings.",
        "Mirrors seed-only _relation tables from the database.",
        '"""',
        "",
        "from __future__ import annotations",
        "",
    ]

    # ARTIFACT_FLAGS
    parts.append(
        format_dict_of_frozensets(
            "ARTIFACT_FLAGS",
            "dict[str, frozenset[str]]",
            relations["ARTIFACT_FLAGS"],
            comment="artifact_flags_relation (artifact_type → flag_type)",
        )
    )
    parts.append("")

    # ARTIFACT_ROLES
    parts.append(
        format_dict_of_frozensets(
            "ARTIFACT_ROLES",
            "dict[str, frozenset[str]]",
            relations["ARTIFACT_ROLES"],
            comment="artifact_roles_relation (artifact_type → profile_type)",
        )
    )
    parts.append("")

    # ENTRY_RESOURCES
    parts.append("# entry_resource_relation (entry_type → resource_type)")
    parts.append("# Generated by: python server/scripts/generate_registry.py")
    parts.append(
        format_dict_of_frozensets(
            "ENTRY_RESOURCES",
            "dict[str, frozenset[str]]",
            relations["ENTRY_RESOURCES"],
        )
    )
    parts.append("")

    # RESOURCE_ENTRIES
    parts.append("# resource_entry_relation (resource_type → entry_type)")
    parts.append("# Generated by: python server/scripts/generate_registry.py")
    parts.append(
        format_dict_of_frozensets(
            "RESOURCE_ENTRIES",
            "dict[str, frozenset[str]]",
            relations["RESOURCE_ENTRIES"],
        )
    )
    parts.append("")

    # RESOURCE_MODALITIES
    parts.append(
        format_dict_of_frozensets(
            "RESOURCE_MODALITIES",
            "dict[str, frozenset[str]]",
            relations["RESOURCE_MODALITIES"],
            comment="resource_modalities_relation (resource_type → modality_type)",
        )
    )
    parts.append("")

    # VIEW_RESOURCES
    parts.append(
        format_dict_of_frozensets(
            "VIEW_RESOURCES",
            "dict[str, frozenset[str]]",
            relations["VIEW_RESOURCES"],
            comment="view_resource_relation (view_type → resource_type)",
        )
    )
    parts.append("")

    # ARTIFACT_RESOURCES
    parts.append("# artifact_resources_relation (artifact_type → resource_type)")
    parts.append("# Generated by: python server/scripts/generate_registry.py")
    parts.append(
        format_dict_of_frozensets(
            "ARTIFACT_RESOURCES",
            "dict[str, frozenset[str]]",
            relations["ARTIFACT_RESOURCES"],
        )
    )
    parts.append("")

    # ARTIFACT_VIEWS
    parts.append(
        format_dict_of_frozensets(
            "ARTIFACT_VIEWS",
            "dict[str, frozenset[str]]",
            relations["ARTIFACT_VIEWS"],
            comment="artifact_view_relation (artifact_type → view_type)",
        )
    )
    parts.append("")

    # VIEW_ENTRIES
    parts.append(
        format_dict_of_frozensets(
            "VIEW_ENTRIES",
            "dict[str, frozenset[str]]",
            relations["VIEW_ENTRIES"],
            comment="view_entry_relation (view_type → entry_type)",
        )
    )
    parts.append("")

    # TOOL_ENTRY_TYPES
    parts.append("# entry_tools_relation (tool_id → entry_type)")
    parts.append(
        format_dict_of_strings(
            "TOOL_ENTRY_TYPES",
            "dict[str, str]",
            relations["TOOL_ENTRY_TYPES"],
        )
    )
    parts.append("")

    # ARTIFACT_ENTRIES (computed)
    parts.extend([
        "# artifact_view_relation + view_entry_relation combined (artifact_type → entry_types)",
        "# Computed from ARTIFACT_VIEWS × VIEW_ENTRIES",
        "ARTIFACT_ENTRIES: dict[str, list[str]] = {}",
        "for _art, _views in ARTIFACT_VIEWS.items():",
        "    _ents: set[str] = set()",
        "    for _v in _views:",
        "        if _v in VIEW_ENTRIES:",
        "            _ents.update(VIEW_ENTRIES[_v])",
        "    if _ents:",
        "        ARTIFACT_ENTRIES[_art] = sorted(_ents)",
    ])

    return "\n".join(parts)


def gen_artifacts() -> str:
    """Generate artifacts.py content."""
    from scripts.registry_generators.artifacts_gen import generate_artifacts

    artifacts = generate_artifacts(PROJECT_ROOT)

    # Split into CRUD and VIEW
    crud_items: dict[str, dict] = {}
    view_items: dict[str, dict] = {}
    for name, meta in sorted(artifacts.items()):
        if meta["kind"] == "crud":
            crud_items[name] = meta
        else:
            view_items[name] = meta

    parts = [
        '"""',
        "Per-artifact metadata — kind, section, endpoints, socket events.",
        "",
        "Data sources:",
        "- CRUD vs view: server/app/api/v4/router.py (lines 105-138)",
        "- Socket handlers: server/app/socket/v4/__init__.py",
        "- Per-artifact endpoints: each server/app/api/v4/artifacts/{artifact}/__init__.py",
        "- Section mapping: derived from ARTIFACT_ROUTES route prefixes",
        '"""',
        "",
        "from __future__ import annotations",
        "",
        "from enum import Enum",
        "",
        "",
        'class ArtifactKind(str, Enum):',
        '    crud = "crud"',
        '    view = "view"',
        "",
        "",
        "class ArtifactMeta:",
        '    __slots__ = ("kind", "section", "endpoints", "socket_events")',
        "",
        "    def __init__(",
        "        self,",
        "        kind: ArtifactKind,",
        "        section: str,",
        "        endpoints: frozenset[str],",
        "        socket_events: frozenset[str] = frozenset(),",
        "    ) -> None:",
        "        self.kind = kind",
        "        self.section = section",
        "        self.endpoints = endpoints",
        "        self.socket_events = socket_events",
        "",
        "    def __repr__(self) -> str:",
        "        return (",
        '            f"ArtifactMeta(kind={self.kind.value!r}, section={self.section!r}, "',
        '            f"endpoints={sorted(self.endpoints)}, socket_events={sorted(self.socket_events)})"',
        "        )",
        "",
        "",
        "# Standard endpoint sets",
        "_CRUD_ENDPOINTS = frozenset(",
        '    {"get", "list", "save", "delete", "duplicate", "draft", "docs"}',
        ")",
        '_SOCKET_EVENTS = frozenset({"generate", "complete", "progress", "error"})',
        "",
        "# ---------------------------------------------------------------------------",
        "# 17 CRUD artifacts",
        "# ---------------------------------------------------------------------------",
        "_CRUD: dict[str, tuple[str, bool]] = {",
        "    # (section, has_socket)",
    ]

    for name, meta in sorted(crud_items.items()):
        has_socket = len(meta["socket_events"]) > 0
        parts.append(f'    "{name}": ("{meta["section"]}", {has_socket}),')

    parts.extend([
        "}",
        "",
        "# ---------------------------------------------------------------------------",
        "# 18 view artifacts (endpoints derived from each __init__.py)",
        "# ---------------------------------------------------------------------------",
        "_VIEWS: dict[str, tuple[str, frozenset[str]]] = {",
        "    # (section, endpoints)",
    ])

    for name, meta in sorted(view_items.items()):
        endpoints = meta["endpoints"]
        if not endpoints:
            parts.append(f'    "{name}": ("{meta["section"]}", frozenset()),')
        elif len(endpoints) <= 3:
            items = ", ".join(f'"{e}"' for e in sorted(endpoints))
            parts.append(f'    "{name}": ("{meta["section"]}", frozenset({{{items}}})),')
        else:
            parts.append(f'    "{name}": (')
            parts.append(f'        "{meta["section"]}",')
            parts.append("        frozenset(")
            items = ", ".join(f'"{e}"' for e in sorted(endpoints))
            parts.append(f"            {{{items}}}")
            parts.append("        ),")
            parts.append("    ),")

    parts.extend([
        "}",
        "",
        "# ---------------------------------------------------------------------------",
        "# Combined registry",
        "# ---------------------------------------------------------------------------",
        "ARTIFACTS: dict[str, ArtifactMeta] = {}",
        "",
        "for _name, (_section, _has_socket) in _CRUD.items():",
        "    ARTIFACTS[_name] = ArtifactMeta(",
        "        kind=ArtifactKind.crud,",
        "        section=_section,",
        "        endpoints=_CRUD_ENDPOINTS,",
        "        socket_events=_SOCKET_EVENTS if _has_socket else frozenset(),",
        "    )",
        "",
        "for _name, (_section, _endpoints) in _VIEWS.items():",
        "    ARTIFACTS[_name] = ArtifactMeta(",
        "        kind=ArtifactKind.view,",
        "        section=_section,",
        "        endpoints=_endpoints,",
        "    )",
        "",
        "# Clean up module namespace",
        "del _name, _section, _has_socket, _endpoints, _CRUD, _VIEWS",
    ])

    return "\n".join(parts)


def gen_routes() -> str:
    """Generate routes.py content."""
    from scripts.registry_generators.routes_gen import generate_artifact_routes, generate_role_artifacts
    from app.registry.manual import ARTIFACT_ROLES

    # We need the full artifacts dict to map routes
    from app.registry.artifacts import ARTIFACTS

    artifact_routes = generate_artifact_routes(PROJECT_ROOT, ARTIFACTS)

    # ROLE_ARTIFACTS comes from route_permissions.py (has view artifacts too)
    # Import the current one since it includes view artifacts
    from app.registry.routes import ROLE_ARTIFACTS as current_role_artifacts

    parts = [
        '"""',
        "Route-derived registry constants.",
        "Derived from ROUTE_PERMISSIONS in route_permissions.py.",
        '"""',
        "",
        "from __future__ import annotations",
        "",
        "# role → artifacts accessible to that role",
        format_dict_of_frozensets(
            "ROLE_ARTIFACTS",
            "dict[str, frozenset[str]]",
            {k: sorted(v) for k, v in current_role_artifacts.items()},
        ),
        "",
        "# artifact → route paths it unlocks",
        format_dict_of_frozensets(
            "ARTIFACT_ROUTES",
            "dict[str, frozenset[str]]",
            artifact_routes,
        ),
    ]
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def validate() -> bool:
    """Compare generated output against current files. Returns True if all match."""
    generators = {
        "resources.py": gen_resources,
        "entries.py": gen_entries,
        "entry_views.py": gen_entry_views,
        "relations.py": gen_relations,
        "artifacts.py": gen_artifacts,
        "routes.py": gen_routes,
    }

    all_match = True
    for filename, gen_func in generators.items():
        filepath = REGISTRY_DIR / filename
        if not filepath.exists():
            print(f"MISSING: {filename}")
            all_match = False
            continue

        current = filepath.read_text()
        try:
            generated = gen_func()
        except Exception as e:
            print(f"ERROR generating {filename}: {e}")
            all_match = False
            continue

        # Normalize whitespace for comparison (ruff may format differently)
        current_lines = current.strip().splitlines()
        generated_lines = generated.strip().splitlines()

        if current_lines != generated_lines:
            print(f"DIFF: {filename}")
            diff = difflib.unified_diff(
                current_lines,
                generated_lines,
                fromfile=f"current/{filename}",
                tofile=f"generated/{filename}",
                lineterm="",
            )
            for line in list(diff)[:50]:  # Limit diff output
                print(f"  {line}")
            all_match = False
        else:
            print(f"OK: {filename}")

    return all_match


# ---------------------------------------------------------------------------
# Main CLI
# ---------------------------------------------------------------------------


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    file_generators = {
        "resources": ("resources.py", gen_resources),
        "entries": ("entries.py", gen_entries),
        "entry_views": ("entry_views.py", gen_entry_views),
        "relations": ("relations.py", gen_relations),
        "artifacts": ("artifacts.py", gen_artifacts),
        "routes": ("routes.py", gen_routes),
    }

    if command == "validate":
        ok = validate()
        sys.exit(0 if ok else 1)
    elif command == "all":
        for name, (filename, gen_func) in file_generators.items():
            print(f"Generating {filename}...")
            try:
                content = gen_func()
                write_registry_file(REGISTRY_DIR / filename, content)
                print(f"  → {filename} written")
            except Exception as e:
                print(f"  ERROR: {e}")
                import traceback
                traceback.print_exc()
    elif command in file_generators:
        filename, gen_func = file_generators[command]
        print(f"Generating {filename}...")
        content = gen_func()
        write_registry_file(REGISTRY_DIR / filename, content)
        print(f"  → {filename} written")
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
