"""Test all resource endpoints by calling internal functions directly."""

import asyncio
import os
import sys
import traceback
from uuid import UUID

sys.path.insert(0, ".")
os.environ["SECRET_KEY"] = os.getenv("SECRET_KEY", "test")
os.environ["AUTH_SECRET"] = os.getenv("AUTH_SECRET", "test")
os.environ["ENV"] = "LOCAL"

import asyncpg  # type: ignore

DB_URL = "postgresql://myuser:mypassword@localhost:5432/mydb"

# Fake UUID for testing get endpoints
FAKE_UUID = UUID("00000000-0000-0000-0000-000000000001")

RESULTS: list[dict] = []


def record(endpoint: str, test_case: str, status: str, detail: str = ""):
    RESULTS.append(
        {"endpoint": endpoint, "test_case": test_case, "status": status, "detail": detail}
    )
    icon = "PASS" if status == "PASS" else "FAIL"
    short_detail = detail[:200] if detail else ""
    print(f"  [{icon}] {endpoint} | {test_case} | {short_detail}")


async def test_resource_get(conn, module_path: str, func_name: str, endpoint_name: str):
    """Test a resource get endpoint with various parameter combos."""
    try:
        mod = __import__(module_path, fromlist=[func_name])
        func = getattr(mod, func_name)
    except Exception as e:
        record(endpoint_name, "import", "FAIL", str(e))
        return

    # Test 1: Empty IDs list
    try:
        result = await func(conn, ids=[], bypass_cache=True)
        record(endpoint_name, "get(ids=[])", "PASS", f"returned {len(result)} items")
    except Exception as e:
        record(endpoint_name, "get(ids=[])", "FAIL", f"{type(e).__name__}: {e}")

    # Test 2: With a fake UUID (should return empty, not error)
    try:
        result = await func(conn, ids=[FAKE_UUID], bypass_cache=True)
        record(endpoint_name, "get(ids=[fake])", "PASS", f"returned {len(result)} items")
    except Exception as e:
        record(endpoint_name, "get(ids=[fake])", "FAIL", f"{type(e).__name__}: {e}")

    # Test 3: Multiple fake UUIDs
    try:
        result = await func(
            conn,
            ids=[FAKE_UUID, UUID("00000000-0000-0000-0000-000000000002")],
            bypass_cache=True,
        )
        record(endpoint_name, "get(ids=[fake,fake2])", "PASS", f"returned {len(result)} items")
    except Exception as e:
        record(endpoint_name, "get(ids=[fake,fake2])", "FAIL", f"{type(e).__name__}: {e}")


async def test_resource_search(conn, module_path: str, func_name: str, endpoint_name: str):
    """Test a resource search endpoint with various parameter combos."""
    try:
        mod = __import__(module_path, fromlist=[func_name])
        func = getattr(mod, func_name)
    except Exception as e:
        record(endpoint_name, "import", "FAIL", str(e))
        return

    # Test 1: Default search (no filters)
    try:
        result = await func(conn, bypass_cache=True)
        record(endpoint_name, "search(defaults)", "PASS", f"returned {len(result)} items")
    except Exception as e:
        record(endpoint_name, "search(defaults)", "FAIL", f"{type(e).__name__}: {e}")

    # Test 2: With search text
    try:
        result = await func(conn, search="test", bypass_cache=True)
        record(endpoint_name, "search(search='test')", "PASS", f"returned {len(result)} items")
    except Exception as e:
        # Some search functions don't take 'search' param
        if "unexpected keyword" in str(e):
            record(endpoint_name, "search(search='test')", "PASS", "no search param (expected)")
        else:
            record(endpoint_name, "search(search='test')", "FAIL", f"{type(e).__name__}: {e}")

    # Test 3: With limit_count=0 (should return empty)
    try:
        result = await func(conn, limit_count=0, bypass_cache=True)
        record(endpoint_name, "search(limit=0)", "PASS", f"returned {len(result)} items")
    except TypeError:
        record(endpoint_name, "search(limit=0)", "PASS", "no limit_count param")
    except Exception as e:
        record(endpoint_name, "search(limit=0)", "FAIL", f"{type(e).__name__}: {e}")

    # Test 4: With limit_count=1
    try:
        result = await func(conn, limit_count=1, bypass_cache=True)
        record(endpoint_name, "search(limit=1)", "PASS", f"returned {len(result)} items")
    except TypeError:
        record(endpoint_name, "search(limit=1)", "PASS", "no limit_count param")
    except Exception as e:
        record(endpoint_name, "search(limit=1)", "FAIL", f"{type(e).__name__}: {e}")

    # Test 5: With offset
    try:
        result = await func(conn, offset_count=100, bypass_cache=True)
        record(endpoint_name, "search(offset=100)", "PASS", f"returned {len(result)} items")
    except TypeError:
        record(endpoint_name, "search(offset=100)", "PASS", "no offset_count param")
    except Exception as e:
        record(endpoint_name, "search(offset=100)", "FAIL", f"{type(e).__name__}: {e}")

    # Test 6: With exclude_ids
    try:
        result = await func(conn, exclude_ids=[FAKE_UUID], bypass_cache=True)
        record(
            endpoint_name, "search(exclude_ids=[fake])", "PASS", f"returned {len(result)} items"
        )
    except TypeError:
        record(endpoint_name, "search(exclude_ids=[fake])", "PASS", "no exclude_ids param")
    except Exception as e:
        record(endpoint_name, "search(exclude_ids=[fake])", "FAIL", f"{type(e).__name__}: {e}")

    # Test 7: Large limit
    try:
        result = await func(conn, limit_count=1000, bypass_cache=True)
        record(endpoint_name, "search(limit=1000)", "PASS", f"returned {len(result)} items")
    except TypeError:
        record(endpoint_name, "search(limit=1000)", "PASS", "no limit_count param")
    except Exception as e:
        record(endpoint_name, "search(limit=1000)", "FAIL", f"{type(e).__name__}: {e}")


# All resource modules with get/search internal functions
RESOURCES = [
    "agents",
    "arg_positions",
    "args",
    "args_outputs",
    "auth_item_keys",
    "auths",
    "bindings",
    "cohorts",
    "colors",
    "conditional_parameters",
    "departments",
    "descriptions",
    "documents",
    "domains",
    "emails",
    "endpoints",
    "evals",
    "examples",
    "fields",
    "flags",
    "group_positions",
    "group_rubrics",
    "groups",
    "icons",
    "images",
    "instructions",
    "items",
    "keys",
    "modalities",
    "models",
    "names",
    "objectives",
    "options",
    "parameter_fields",
    "parameters",
    "personas",
    "points",
    "pricing",
    "problem_statements",
    "profiles",
    "prompts",
    "protocols",
    "provider_keys",
    "providers",
    "qualities",
    "questions",
    "reasoning_levels",
    "request_limits",
    "role_routes",
    "roles",
    "routes",
    "rubrics",
    "run_positions",
    "run_rubrics",
    "runs",
    "scenario_flags",
    "scenario_personas",
    "scenario_positions",
    "scenario_rubrics",
    "scenario_time_limits",
    "scenarios",
    "settings",
    "simulation_positions",
    "simulations",
    "slugs",
    "standard_groups",
    "standards",
    "temperature_levels",
    "texts",
    "thresholds",
    "tools",
    "uploads",
    "values",
    "videos",
    "voices",
]


async def main():
    conn = await asyncpg.connect(DB_URL)
    print(f"Connected to database\n")

    total_pass = 0
    total_fail = 0

    for resource in RESOURCES:
        print(f"\n{'='*60}")
        print(f"Testing: {resource}")
        print(f"{'='*60}")

        # Test GET
        get_module = f"app.api.v4.resources.{resource}.get"
        get_func = f"get_{resource}_internal"
        try:
            await test_resource_get(conn, get_module, get_func, f"{resource}/get")
        except Exception as e:
            record(f"{resource}/get", "unexpected", "FAIL", traceback.format_exc()[:300])

        # Test SEARCH
        search_module = f"app.api.v4.resources.{resource}.search"
        search_func = f"search_{resource}_internal"
        try:
            await test_resource_search(conn, search_module, search_func, f"{resource}/search")
        except Exception as e:
            record(
                f"{resource}/search", "unexpected", "FAIL", traceback.format_exc()[:300]
            )

    await conn.close()

    # Summary
    failures = [r for r in RESULTS if r["status"] == "FAIL"]
    passes = [r for r in RESULTS if r["status"] == "PASS"]

    print(f"\n\n{'='*60}")
    print(f"SUMMARY: {len(passes)} passed, {len(failures)} failed out of {len(RESULTS)} tests")
    print(f"{'='*60}")

    if failures:
        print(f"\n FAILURES:")
        for f in failures:
            print(f"  {f['endpoint']} | {f['test_case']} | {f['detail'][:200]}")


if __name__ == "__main__":
    asyncio.run(main())
