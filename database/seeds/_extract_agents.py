"""Extract agent seed data from SQL files → Python dict definitions.

Run: python3 database/seeds/_extract_agents.py
"""

import re
from pathlib import Path

AGENTS_DIR = Path(__file__).parent.parent / "modules" / "04-agents"


def extract_artifact_id(sql: str) -> str | None:
    m = re.search(r"INSERT INTO public\.agent_artifact.*?'([0-9a-f-]{36})'", sql)
    return m.group(1) if m else None


def extract_resource_id(sql: str) -> str | None:
    """Extract the agents_resource ID (used by systems to reference agents)."""
    m = re.search(r"INSERT INTO public\.agents_resource.*?id,.*?'([0-9a-f-]{36})'", sql)
    if m:
        return m.group(1)
    # Try alternate pattern — id might be at different position
    m = re.search(r"INSERT INTO public\.agents_resource\s*\([^)]*\)\s*VALUES\s*\([^)]*'([0-9a-f-]{36})'", sql)
    # Find the agent_agents_junction to get the resource id
    m = re.search(r"agent_agents_junction.*?'[0-9a-f-]{36}',\s*'([0-9a-f-]{36})'", sql)
    return m.group(1) if m else None


def extract_name(sql: str) -> str | None:
    # Get name from names_resource or from agents_resource
    m = re.search(r"INSERT INTO public\.names_resource.*?'([0-9a-f-]{36})',\s*'([^']+)'", sql)
    if m:
        return m.group(2)
    # Try agents_resource name field
    m = re.search(r"agents_resource.*?name.*?'([^']+)'", sql)
    return m.group(1) if m else None


def extract_description(sql: str) -> str | None:
    m = re.search(r"INSERT INTO public\.descriptions_resource.*?'([0-9a-f-]{36})',\s*'((?:[^']|'')+)'", sql)
    if m:
        return m.group(2).replace("''", "'")
    return None


def extract_junction_ids(sql: str, pattern: str) -> list[str]:
    ids = []
    for m in re.finditer(pattern, sql):
        ids.append(m.group(1))
    return list(dict.fromkeys(ids))


def extract_flag_ids(sql: str) -> list[str]:
    return extract_junction_ids(
        sql, r"agent_flags_junction.*?'[0-9a-f-]{36}',\s*'([0-9a-f-]{36})'"
    )


def extract_model_ids(sql: str) -> list[str]:
    """Extract model resource IDs from agent_models_junction."""
    return extract_junction_ids(
        sql, r"agent_models_junction.*?'[0-9a-f-]{36}',\s*'([0-9a-f-]{36})'"
    )


def process_agent_file(path: Path) -> dict:
    sql = path.read_text()
    return {
        "file": path.stem,
        "artifact_id": extract_artifact_id(sql),
        "resource_id": extract_resource_id(sql),
        "name": extract_name(sql),
        "description": extract_description(sql),
        "flag_ids": extract_flag_ids(sql),
        "model_ids": extract_model_ids(sql),
    }


def to_const_name(stem: str) -> str:
    """Convert file stem to Python constant name."""
    return stem.upper().replace("-", "_") + "_AGENT"


def main():
    agents = []
    for sql_file in sorted(AGENTS_DIR.glob("*.sql")):
        agents.append(process_agent_file(sql_file))

    # Print Python module
    print('"""Module 04 — Agent seed definitions.')
    print()
    print("Each dict maps directly to CreateAgentItem fields.")
    print("String fields (name, description) are resolved by the _impl function.")
    print()
    print("Note: Agent prompts and instructions are NOT included here — the")
    print("CreateAgentItem / create_agent_impl does not support prompt/instruction")
    print("junctions. These must be added separately after initial creation.")
    print('"""')
    print()
    print("from uuid import UUID")
    print()

    print("# ---------------------------------------------------------------------------")
    print("# Deterministic IDs — importable by other modules (e.g., systems.py)")
    print("# When created via _impl, artifact ID = resource ID.")
    print("# ---------------------------------------------------------------------------")
    print()

    for a in agents:
        const = to_const_name(a["file"])
        print(f'{const} = UUID("{a["artifact_id"]}")')

    # Check for agents with multiple entries (attempt-chat has 2 agents)
    # Handle special cases from systems.py references
    print()
    print("# Second attempt-chat agent (systems reference two agents for attempt-chat)")
    # Find attempt-chat resource ID if different from artifact ID
    attempt_chat = next((a for a in agents if a["file"] == "attempt-chat"), None)
    if attempt_chat and attempt_chat["resource_id"] and attempt_chat["resource_id"] != attempt_chat["artifact_id"]:
        print(f'ATTEMPT_CHAT_AGENT_2 = UUID("{attempt_chat["resource_id"]}")')
    else:
        print("# ATTEMPT_CHAT_AGENT_2 = <needs manual extraction>")

    print()
    print("# ---------------------------------------------------------------------------")
    print("# Agent definitions")
    print("# ---------------------------------------------------------------------------")
    print()
    print("agents = [")
    for a in agents:
        const = to_const_name(a["file"])
        name = a["name"] or a["file"].replace("-", " ").title()
        desc = (a["description"] or "").replace('"', '\\"')
        print("    dict(")
        print(f'        id={const},')
        print(f'        name="{name}",')
        if desc:
            print(f'        description="{desc}",')

        if a["flag_ids"]:
            if len(a["flag_ids"]) == 1:
                print(f'        flag_ids=[UUID("{a["flag_ids"][0]}")],')
            else:
                print(f"        flag_ids=[")
                for fid in a["flag_ids"]:
                    print(f'            UUID("{fid}"),')
                print(f"        ],")

        # Skip model_ids — these reference old resource IDs, not artifact IDs
        # The correct references will be from models.py constants
        if a["model_ids"]:
            print(f"        # model_ids reference: {a['model_ids']}")

        print("    ),")

    print("]")


if __name__ == "__main__":
    main()
