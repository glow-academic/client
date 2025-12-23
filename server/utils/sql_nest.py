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


def _detect_nested_list_prefixes(
    rows: list[Mapping[str, Any]],
    top_level_prefix: str,
    sep: str = "__",
) -> set[str]:
    """Detect nested list prefixes within a top-level list prefix.

    Scans columns like `prefix__nested__field1`, `prefix__nested__field2` and detects
    that `nested` is a list prefix within `prefix`.

    Args:
        rows: List of row dictionaries
        top_level_prefix: Top-level prefix to scan within (e.g., "model_mapping")
        sep: Separator for nested keys (default: "__")

    Returns:
        Set of nested list prefixes (e.g., {"temperature_levels", "reasoning_options"})
    """
    nested_prefixes: set[str] = set()
    prefix_key = top_level_prefix + sep

    # Scan all columns to find nested list patterns
    for row in rows:
        for key in row.keys():
            if not key.startswith(prefix_key):
                continue

            # Remove top-level prefix to get remainder
            remainder = key[len(prefix_key):]
            if not remainder:
                continue

            # Split remainder to find nested prefix
            parts = remainder.split(sep)
            if len(parts) >= 2:
                # Pattern: prefix__nested__field -> nested is a list prefix
                nested_prefix = parts[0]
                nested_prefixes.add(nested_prefix)

    return nested_prefixes


def _process_nested_lists(
    items: list[dict[str, Any]],
    nested_prefixes: set[str],
    sep: str = "__",
) -> list[dict[str, Any]]:
    """Process nested lists within list items.

    For each item, groups nested list prefixes into lists.

    Args:
        items: List of item dictionaries (may have nested list columns)
        nested_prefixes: Set of nested list prefixes to group
        sep: Separator for nested keys (default: "__")

    Returns:
        List of items with nested lists grouped
    """
    if not nested_prefixes:
        # No nested lists, just nest the objects
        return [nest_row(item, sep=sep) for item in items]

    processed_items: list[dict[str, Any]] = []
    # Group items by their non-nested-list keys to aggregate nested lists
    item_groups: dict[tuple, dict[str, Any]] = {}

    for item in items:
        # Separate nested list columns from regular columns
        nested_data: dict[str, list[dict[str, Any]]] = {p: [] for p in nested_prefixes}
        regular_data: dict[str, Any] = {}

        for key, value in item.items():
            # Check if this key belongs to a nested list prefix
            found_nested = False
            for nested_prefix in nested_prefixes:
                nested_key = nested_prefix + sep
                if key.startswith(nested_key):
                    # Extract field name after nested prefix
                    field_name = key[len(nested_key):]
                    found_nested = True
                    # We'll process this in the grouping phase
                    break

            if not found_nested:
                regular_data[key] = value

        # Create a key from regular data to group items with same base values
        # Use a tuple of sorted items for grouping
        # Convert lists to tuples so they can be hashed (for dictionary key)
        def make_hashable(value: Any) -> Any:
            if isinstance(value, list):
                return tuple(make_hashable(item) for item in value)
            if isinstance(value, dict):
                return tuple(sorted((k, make_hashable(v)) for k, v in value.items()))
            return value
        
        group_key = tuple(sorted((k, make_hashable(v)) for k, v in regular_data.items()))

        if group_key not in item_groups:
            # First time seeing this group, initialize
            item_groups[group_key] = {
                **regular_data,
                **{p: [] for p in nested_prefixes},
            }

        # Collect nested list items for this group
        for nested_prefix in nested_prefixes:
            nested_key = nested_prefix + sep
            nested_item: dict[str, Any] = {}
            has_nested_data = False

            for key, value in item.items():
                if key.startswith(nested_key):
                    field_name = key[len(nested_key):]
                    nested_item[field_name] = value
                    if value is not None:
                        has_nested_data = True

            if has_nested_data and nested_item:
                # Check if this nested item is already in the list (deduplicate)
                if nested_item not in item_groups[group_key][nested_prefix]:
                    item_groups[group_key][nested_prefix].append(nested_item)

    # Convert grouped data back to list of items
    for group_data in item_groups.values():
        # Nest the regular data first
        nested_regular = nest_row(
            {k: v for k, v in group_data.items() if k not in nested_prefixes},
            sep=sep,
        )
        # Attach nested lists
        for nested_prefix in nested_prefixes:
            nested_regular[nested_prefix] = group_data[nested_prefix]
        processed_items.append(nested_regular)

    return processed_items


def nest_many(
    rows: Iterable[Mapping[str, Any]],
    *,
    list_prefixes: set[str] = set(),
    sep: str = "__",
    auto_detect_nested: bool = True,
) -> dict[str, Any]:
    """Convert multiple rows to nested dictionary with list aggregation.

    Automatically detects and handles nested list prefixes within top-level lists.

    Example:
        Input rows:
            [{"agentId": "123", "departments__id": "1", "departments__name": "Dept1"},
             {"agentId": "123", "departments__id": "2", "departments__name": "Dept2"}]
        Output:
            {"agentId": "123", "departments": [{"id": "1", "name": "Dept1"}, {"id": "2", "name": "Dept2"}]}

    Example with nested lists:
        Input rows:
            [{"model_mapping__id": "1", "model_mapping__name": "Model1",
              "model_mapping__temperature_levels__id": "t1", "model_mapping__temperature_levels__temp": "0.5"},
             {"model_mapping__id": "1", "model_mapping__name": "Model1",
              "model_mapping__temperature_levels__id": "t2", "model_mapping__temperature_levels__temp": "0.7"}]
        Output:
            {"model_mapping": [{
                "id": "1",
                "name": "Model1",
                "temperature_levels": [
                    {"id": "t1", "temp": "0.5"},
                    {"id": "t2", "temp": "0.7"}
                ]
            }]}

    Args:
        rows: Iterable of row dictionaries
        list_prefixes: Set of prefixes that should become lists (e.g., {"departments"})
        sep: Separator for nested keys (default: "__")
        auto_detect_nested: If True, automatically detect nested list prefixes (default: True)

    Returns:
        Nested dictionary with lists for specified prefixes and nested lists automatically grouped
    """
    rows_list = list(rows)
    if not rows_list:
        return {}

    # Detect nested list prefixes for each top-level prefix
    nested_prefix_map: dict[str, set[str]] = {}
    if auto_detect_nested:
        for prefix in list_prefixes:
            nested_prefixes = _detect_nested_list_prefixes(rows_list, prefix, sep=sep)
            if nested_prefixes:
                nested_prefix_map[prefix] = nested_prefixes

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
                # Use a simple check - if exact match exists, skip
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

    # Process nested lists for each top-level list
    for prefix, items in list_acc.items():
        if prefix in nested_prefix_map and nested_prefix_map[prefix]:
            # Process nested lists within this prefix
            base[prefix] = _process_nested_lists(
                items, nested_prefix_map[prefix], sep=sep
            )
        else:
            # No nested lists, just nest the objects
            base[prefix] = [nest_row(item, sep=sep) for item in items]

    return base

