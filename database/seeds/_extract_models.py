"""Extract model seed data from SQL files → Python dict definitions.

Run: python database/seeds/_extract_models.py
"""

import re
from pathlib import Path
from uuid import UUID

MODELS_DIR = Path(__file__).parent.parent / "modules" / "03-models"


def extract_artifact_id(sql: str) -> str | None:
    m = re.search(r"INSERT INTO public\.model_artifact.*?'([0-9a-f-]{36})'", sql)
    return m.group(1) if m else None


def extract_name(sql: str) -> str | None:
    m = re.search(r"INSERT INTO public\.names_resource.*?'([0-9a-f-]{36})',\s*'([^']+)'", sql)
    return m.group(2) if m else None


def extract_description(sql: str) -> str | None:
    m = re.search(r"INSERT INTO public\.descriptions_resource.*?'([0-9a-f-]{36})',\s*'((?:[^']|'')+)'", sql)
    if m:
        return m.group(2).replace("''", "'")
    return None


def extract_junction_ids(sql: str, pattern: str) -> list[str]:
    """Extract resource IDs from junction INSERT statements."""
    ids = []
    for m in re.finditer(pattern, sql):
        ids.append(m.group(1))
    return list(dict.fromkeys(ids))  # deduplicate preserving order


def extract_provider_ids(sql: str) -> list[str]:
    return extract_junction_ids(
        sql, r"model_providers_junction.*?'[0-9a-f-]{36}',\s*'([0-9a-f-]{36})'"
    )


def extract_flag_ids(sql: str) -> list[str]:
    return extract_junction_ids(
        sql, r"model_flags_junction.*?'[0-9a-f-]{36}',\s*'([0-9a-f-]{36})'"
    )


def extract_modality_ids(sql: str) -> list[str]:
    return extract_junction_ids(
        sql, r"model_modalities_junction.*?modalities_id\).*?'([0-9a-f-]{36})'\)"
    )


def extract_pricing_ids(sql: str) -> list[str]:
    return extract_junction_ids(
        sql, r"model_pricing_junction.*?pricing_id\).*?'([0-9a-f-]{36})'\)"
    )


def extract_reasoning_level_ids(sql: str) -> list[str]:
    return extract_junction_ids(
        sql, r"model_reasoning_levels_junction.*?'[0-9a-f-]{36}',\s*'([0-9a-f-]{36})'"
    )


def extract_temperature_level_ids(sql: str) -> list[str]:
    return extract_junction_ids(
        sql, r"model_temperature_levels_junction.*?'[0-9a-f-]{36}',\s*'([0-9a-f-]{36})'"
    )


def extract_value_ids(sql: str) -> list[str]:
    return extract_junction_ids(
        sql, r"model_values_junction.*?'[0-9a-f-]{36}',\s*'([0-9a-f-]{36})'"
    )


def process_model_file(path: Path) -> dict:
    sql = path.read_text()
    provider_dir = path.parent.name  # "openai" or "gemini"
    return {
        "file": path.name,
        "provider": provider_dir,
        "artifact_id": extract_artifact_id(sql),
        "name": extract_name(sql),
        "description": extract_description(sql),
        "provider_ids": extract_provider_ids(sql),
        "flag_ids": extract_flag_ids(sql),
        "modality_ids": extract_modality_ids(sql),
        "pricing_ids": extract_pricing_ids(sql),
        "reasoning_level_ids": extract_reasoning_level_ids(sql),
        "temperature_level_ids": extract_temperature_level_ids(sql),
        "value_ids": extract_value_ids(sql),
    }


def uuid_list_str(ids: list[str], indent: int = 8) -> str:
    if not ids:
        return "None"
    pad = " " * indent
    lines = [f'{pad}UUID("{uid}"),' for uid in ids]
    return "[\n" + "\n".join(lines) + f"\n{' ' * (indent - 4)}]"


def main():
    models = []
    for provider_dir in sorted(MODELS_DIR.iterdir()):
        if not provider_dir.is_dir():
            continue
        for sql_file in sorted(provider_dir.glob("*.sql")):
            models.append(process_model_file(sql_file))

    # Print Python module
    print('"""Module 03 — Model seed definitions.')
    print()
    print("Each dict maps directly to CreateModelItem fields.")
    print('String fields (name, description) are resolved by the _impl function.')
    print('"""')
    print()
    print("from uuid import UUID")
    print()
    print("from database.seeds.providers import OPENAI, GEMINI")
    print()

    # Provider mapping
    # Find provider resource IDs from SQL, map to our constants
    provider_map = {}
    for m in models:
        for pid in m["provider_ids"]:
            provider_map[pid] = m["provider"]

    print("# ---------------------------------------------------------------------------")
    print("# Provider resource IDs from existing SQL (mapped to seed constants)")
    print("# When created via _impl, artifact ID = resource ID, so we use")
    print("# the provider constants directly.")
    print("# ---------------------------------------------------------------------------")
    print()
    print("_PROVIDER = {")
    print(f'    "openai": OPENAI,')
    print(f'    "gemini": GEMINI,')
    print("}")
    print()

    print("# ---------------------------------------------------------------------------")
    print("# Deterministic IDs — importable by other modules")
    print("# ---------------------------------------------------------------------------")
    print()

    for m in models:
        const_name = m["name"].upper().replace("-", "_").replace(".", "_").replace(" ", "_")
        print(f'{const_name} = UUID("{m["artifact_id"]}")')
    print()

    # GPT-5.1 model is commonly referenced
    gpt51 = next((m for m in models if m["name"] == "gpt-5.1"), None)
    if gpt51:
        print(f"# Commonly referenced model")
        print(f"GPT_5_1 = {gpt51['name'].upper().replace('-', '_').replace('.', '_')}")
        print()

    print("# ---------------------------------------------------------------------------")
    print("# Model definitions")
    print("# ---------------------------------------------------------------------------")
    print()
    print("models = [")
    for m in models:
        const_name = m["name"].upper().replace("-", "_").replace(".", "_").replace(" ", "_")
        print("    dict(")
        print(f'        id={const_name},')
        print(f'        name="{m["name"]}",')
        desc = m["description"].replace('"', '\\"') if m["description"] else ""
        print(f'        description="{desc}",')
        print(f'        provider_ids=[_PROVIDER["{m["provider"]}"]],')

        if m["flag_ids"]:
            print(f"        flag_ids={uuid_list_str(m['flag_ids'], 12)},")

        if m["modality_ids"]:
            print(f"        modality_ids={uuid_list_str(m['modality_ids'], 12)},")

        if m["pricing_ids"]:
            print(f"        pricing_ids={uuid_list_str(m['pricing_ids'], 12)},")

        if m["reasoning_level_ids"]:
            print(f"        reasoning_level_ids={uuid_list_str(m['reasoning_level_ids'], 12)},")

        # For temperature levels, just note the count
        temp_count = len(m["temperature_level_ids"])
        if temp_count > 10:
            print(f"        # {temp_count} temperature levels — see _TEMP_LEVELS_FULL below")
            print(f"        temperature_level_ids=_TEMP_LEVELS_FULL,")
        elif m["temperature_level_ids"]:
            print(f"        temperature_level_ids={uuid_list_str(m['temperature_level_ids'], 12)},")

        print("    ),")

    print("]")

    # Print temperature level full set (used by models with many temp levels)
    # Find the model with the most temperature levels
    max_temps = max(models, key=lambda m: len(m["temperature_level_ids"]))
    if len(max_temps["temperature_level_ids"]) > 10:
        print()
        print()
        print("# ---------------------------------------------------------------------------")
        print(f"# Full temperature level set ({len(max_temps['temperature_level_ids'])} levels, 0.0–1.0)")
        print("# Used by models that support the full temperature range")
        print("# ---------------------------------------------------------------------------")
        print()
        print("_TEMP_LEVELS_FULL = [")
        for tid in max_temps["temperature_level_ids"]:
            print(f'    UUID("{tid}"),')
        print("]")


if __name__ == "__main__":
    main()
