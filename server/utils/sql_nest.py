"""Nesting helper for SQL results using __ convention.

Converts flat rows with `agent__name` to nested `{"agent": {"name": ...}}`.
"""

from typing import Any, Iterable, Mapping


def nest_row(row: Mapping[str, Any], sep: str = "__") -> dict[str, Any]:
    """Convert flat row with nested keys to nested dictionary.

    Example:
        Input: {"agent__name": "Test", "agent__id": "123", "success": True}
        Output: {"agent": {"name": "Test", "id": "123"}, "success": True}

    Args:
        row: Flat row dictionary with keys like "agent__name"
        sep: Separator for nested keys (default: "__")

    Returns:
        Nested dictionary
    """
    out: dict[str, Any] = {}

    for key, value in row.items():
        if sep not in key:
            out[key] = value
            continue

        # Split on separator and build nested structure
        parts = key.split(sep)
        cur: dict[str, Any] = out

        # Navigate/create nested dictionaries
        for p in parts[:-1]:
            nxt = cur.get(p)
            if not isinstance(nxt, dict):
                nxt = {}
                cur[p] = nxt
            cur = nxt

        # Set the final value
        cur[parts[-1]] = value

    return out


def nest_many(
    rows: Iterable[Mapping[str, Any]],
    *,
    list_prefixes: set[str] = set(),
    sep: str = "__",
) -> dict[str, Any]:
    """Convert multiple rows to nested dictionary with list aggregation.

    Groups rows by list prefixes (e.g., `departments__id` → `departments: [{id: ...}]`).

    Example:
        Input rows:
            [{"agentId": "123", "departments__id": "1", "departments__name": "Dept1"},
             {"agentId": "123", "departments__id": "2", "departments__name": "Dept2"}]
        Output:
            {"agentId": "123", "departments": [{"id": "1", "name": "Dept1"}, {"id": "2", "name": "Dept2"}]}

    Args:
        rows: Iterable of row dictionaries
        list_prefixes: Set of prefixes that should become lists (e.g., {"departments"})
        sep: Separator for nested keys (default: "__")

    Returns:
        Nested dictionary with lists for specified prefixes
    """
    rows_list = list(rows)
    if not rows_list:
        return {}

    # Start with first row's scalar + nested (non-list) fields
    base: dict[str, Any] = {}
    list_acc: dict[str, list[dict[str, Any]]] = {p: [] for p in list_prefixes}

    for row in rows_list:
        row_dict = dict(row)

        # Build an item dict per list prefix from columns like "departments__id"
        for prefix in list_prefixes:
            item: dict[str, Any] = {}
            prefix_key = prefix + sep

            for k, v in row_dict.items():
                if k.startswith(prefix_key):
                    # Remove prefix and separator to get the field name
                    field_name = k[len(prefix_key):]
                    item[field_name] = v

            # If the row has no items for this prefix (LEFT JOIN), item might be all None
            if item and any(v is not None for v in item.values()):
                # Check if this item is already in the accumulator (deduplicate)
                if item not in list_acc[prefix]:
                    list_acc[prefix].append(item)

        # Build base once from the first row excluding list columns
        if not base:
            filtered = {
                k: v
                for k, v in row_dict.items()
                if not any(k.startswith(p + sep) for p in list_prefixes)
            }
            base = nest_row(filtered, sep=sep)

    # Attach lists to base
    for prefix, items in list_acc.items():
        base[prefix] = items

    return base

