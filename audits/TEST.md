# Test Audit — Test Coverage & Quality Check

You are a test auditor for the GLOW project. Your job is to verify that all test files follow the canonical rules defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and violations.

Run each audit step in order. For each step, inspect the test files and compare against the rules. Collect all errors into a final report at the end.

---

## Database Credentials

```
psql postgresql://myuser:mypassword@localhost:5432/mydb
```

---

## The Three Test Tiers

| Tier | Location | What It Tests | Touches DB? | Speed |
|------|----------|--------------|-------------|-------|
| **Unit** | `server/tests/unit/` | Pure Python logic (permissions, utils, helpers) | No | Fast |
| **Integration** | `server/tests/integration/` | Endpoints, handlers, SQL queries, DB interactions | Yes (Testcontainers) | Medium |
| **E2E** | `server/tests/e2e/` | Full user flows through browser (Playwright) | Yes (live services) | Slow |

---

## 1:1 File Mapping

Every source module MUST have a corresponding test file. The mapping is:

### Integration tests — one file per endpoint/handler

```
server/app/api/v4/artifacts/{artifact}/{endpoint}.py
  → server/tests/integration/api/v4/artifacts/{artifact}/test_{endpoint}.py

server/app/api/v4/resources/{resource}/{endpoint}.py
  → server/tests/integration/api/v4/resources/{resource}/test_{endpoint}.py

server/app/api/v4/views/{view}/{endpoint}.py
  → server/tests/integration/api/v4/views/{view}/test_{endpoint}.py

server/app/socket/v4/artifacts/{artifact}/{handler}.py
  → server/tests/integration/socket/v4/artifacts/{artifact}/test_{handler}.py
```

**Excluded from integration stubs:** `__init__.py`, `docs.py`, `permissions.py`, `types.py`

### Unit tests — one file per logic module

```
server/app/api/v4/artifacts/{artifact}/permissions.py
  → server/tests/unit/api/v4/artifacts/{artifact}/test_permissions.py

server/app/socket/v4/artifacts/{artifact}/permissions.py
  → server/tests/unit/socket/v4/artifacts/{artifact}/test_permissions.py

server/app/utils/{module}.py
  → server/tests/unit/test_{module}.py

server/app/utils/{dir}/{module}.py
  → server/tests/unit/{dir}/test_{module}.py
```

### E2E tests — one file per artifact

```
server/tests/e2e/v4/test_{artifact}.py
```

Each E2E file covers the full CRUD lifecycle for one artifact.

### Audit step

1. Walk every source directory listed above.
2. For each `.py` file (excluding `__init__.py`, `docs.py`, `types.py`), verify a corresponding test file exists.
3. Report any source file missing its test counterpart.

---

## The Rules

### Rule 1: No inline SQL in tests

All database queries in integration tests MUST use `execute_sql_typed()` with a `.sql` file. No inline SQL strings. No `conn.fetch()`, `conn.fetchrow()`, or `conn.execute()` with raw SQL.

**Why:** When a migration changes a table, you update the SQL file once. Inline SQL scattered across tests becomes invisible tech debt that breaks silently.

**SQL test helper location:**
```
server/tests/sql/v4/integration/queries/{layer}/{domain}/test_{name}_v4_complete.sql
```

**Correct:**
```python
result = await execute_sql_typed(
    conn=db,
    sql_path="tests/sql/v4/integration/queries/api/profile/test_create_test_profile_v4_complete.sql",
    params=CreateTestProfileSqlParams(
        profile_first_name="Test",
        profile_last_name="User",
        profile_role="student",
        profile_active=True,
        profile_default_profile=False,
    ),
)
typed_result = CreateTestProfileSqlRow.model_validate(result.model_dump())
```

**Wrong:**
```python
result = await db.fetchrow("SELECT * FROM profiles WHERE first_name = $1", "Test")
```

**Audit step:** Search every integration test file for patterns: `conn.fetch`, `conn.execute`, `db.fetch`, `db.execute`, `"""SELECT`, `"""INSERT`, `"""UPDATE`, `"""DELETE`, `f"SELECT`, `f"INSERT`. Report all matches.

---

### Rule 2: Arrange-Act-Assert structure

Every test method MUST follow the Arrange-Act-Assert (AAA) pattern with clear section comments.

**Why:** AAA makes tests readable as specifications. The reader can instantly see what's being set up, what's being tested, and what the expected outcome is — without parsing tangled setup-and-verify logic.

**Correct:**
```python
async def test_insert_activity_success(self, db: asyncpg.Connection) -> None:
    """Test successful activity insertion."""
    # Arrange
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/.../test_create_test_profile_v4_complete.sql",
        params=CreateTestProfileSqlParams(profile_first_name="Test", ...),
    )
    profile_id = CreateTestProfileSqlRow.model_validate(result.model_dump()).profile_id

    # Act
    await insert_activity(
        message="Test activity message",
        endpoint="/api/v4/test",
        profile_id=str(profile_id),
        error=False,
        conn=db,
    )

    # Assert
    activity = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/.../test_get_activity_by_message_v4_complete.sql",
        params=TestGetActivityByMessageSqlParams(p_message="Test activity message"),
    )
    typed = TestGetActivityByMessageSqlRow.model_validate(activity.model_dump())
    assert typed.message == "Test activity message"
    assert typed.profile_id == profile_id
```

**Wrong:**
```python
async def test_insert_activity(self, db):
    # Does setup, calls function, and asserts all in one tangled block
    profile = await db.fetchrow("INSERT INTO profiles ...")
    await insert_activity(message="Test", endpoint="/test", profile_id=str(profile["id"]), error=False, conn=db)
    row = await db.fetchrow("SELECT * FROM activity WHERE message = 'Test'")
    assert row is not None
    assert row["message"] == "Test"
```

**Audit step:** For each test method, verify it has `# Arrange`, `# Act`, and `# Assert` comments (or `# Arrange & Act` when trivial). Report tests that lack the AAA structure.

---

### Rule 3: Test business logic, not implementation details

Tests MUST verify **what the function does**, not **how the function does it**. Assert on outcomes and observable behavior, not on internal SQL shapes or intermediate state.

**Why:** If the function under test has a bug, a test handcrafted to match its internals will pass too. Tests should be an independent specification of correct behavior.

**Correct — tests the contract:**
```python
class TestComputeCanEdit:
    def test_superadmin_can_edit_any(self) -> None:
        assert compute_can_edit("superadmin", target_is_self=False, target_department_ids=[]) is True

    def test_staff_cannot_edit_others(self) -> None:
        assert compute_can_edit("staff", target_is_self=False, target_department_ids=[]) is False
```

**Correct — tests observable DB state:**
```python
# Act
await insert_activity(message="Test", endpoint="/api/v4/test", profile_id=str(pid), error=False, conn=db)

# Assert — verify by reading back, not by checking SQL was called
activity = await execute_sql_typed(conn=db, sql_path="tests/sql/.../test_get_activity.sql", ...)
assert typed.message == "Test"
assert typed.error is False
```

**Wrong — tests implementation details:**
```python
# Asserts on the exact SQL that was generated
mock_db.execute.assert_called_with("INSERT INTO activity (message, endpoint, ...) VALUES ($1, $2, ...)", ...)
```

**Audit step:** Look for `assert_called_with` on database mocks, assertions on SQL strings, or assertions that mirror the exact internal logic of the function. Report these as coupling violations.

---

### Rule 4: Unit tests need no database

Unit tests MUST NOT import `asyncpg`, `execute_sql_typed`, or any database utility. They test pure Python functions with plain arguments and return values.

**Why:** Unit tests run in milliseconds with zero infrastructure. If a test needs a database, it's an integration test — put it in the right tier.

**Belongs in unit:**
- `permissions.py` — role-based boolean logic
- `utils/` — text processing, formatting, calculations
- `types.py` — Pydantic model validation (if tested)

**Belongs in integration:**
- `get.py`, `list.py`, `save.py` — endpoint handlers that call SQL
- `generate.py`, `complete.py` — socket handlers that emit events
- Anything that calls `execute_sql_typed()` or `get_db()`

**Audit step:** Scan `server/tests/unit/` for imports of `asyncpg`, `execute_sql_typed`, `get_db`, `get_db_connection`. Report any found.

---

### Rule 5: Class-based grouping per function

Tests MUST be organized in classes, one class per function or logical group. Class name: `Test{FunctionName}` in PascalCase. Method name: `test_{scenario}` in snake_case.

**Why:** Classes group related tests visually and in test output. When a function breaks, you see `TestComputeCanEdit::test_staff_cannot_edit_others FAILED` — immediately clear what broke and where.

**Correct:**
```python
class TestComputeCanEdit:
    def test_superadmin_can_edit_any(self) -> None: ...
    def test_staff_can_edit_self(self) -> None: ...
    def test_staff_cannot_edit_others(self) -> None: ...
    def test_learner_cannot_edit(self) -> None: ...

class TestComputeCanDelete:
    def test_cannot_delete_self(self) -> None: ...
    def test_superadmin_can_delete_others(self) -> None: ...
```

**Wrong:**
```python
def test_permissions_1(): ...
def test_permissions_2(): ...
def test_edit_and_delete(): ...  # mixing concerns
```

**Audit step:** Verify each test file uses class-based organization. Report files with only top-level functions (unless there's a single test class worth of tests).

---

### Rule 6: Typed params and rows for SQL helpers

Integration tests that use `execute_sql_typed()` MUST use generated `*SqlParams` and `*SqlRow` types from `tests/sql/types.py`. No untyped dicts or positional args.

**Why:** The same type flow that powers the app (`SQL → types.py → Pydantic`) applies to test SQL helpers. When a migration changes a column, the type breaks at compile time, not at runtime.

**Type generation:** After creating or modifying test SQL files, run `make sql-compile` to regenerate `tests/sql/types.py`.

**Correct:**
```python
from tests.sql.types import CreateTestProfileSqlParams, CreateTestProfileSqlRow

result = await execute_sql_typed(
    conn=db,
    sql_path="tests/sql/.../test_create_test_profile_v4_complete.sql",
    params=CreateTestProfileSqlParams(profile_first_name="Test", profile_last_name="User", ...),
)
typed = CreateTestProfileSqlRow.model_validate(result.model_dump())
assert typed.profile_id is not None
```

**Wrong:**
```python
result = await execute_sql_typed(conn=db, sql_path="...", params={"first_name": "Test"})
assert result["profile_id"] is not None  # untyped dict access
```

**Audit step:** Verify every `execute_sql_typed()` call uses a typed `*SqlParams` object (not a dict) and validates the result via `*SqlRow.model_validate()`. Report untyped usages.

---

### Rule 7: E2E tests follow the lifecycle pattern

Each E2E test file covers one artifact and follows a 9-step lifecycle:

```
1. Fetch /new defaults via API
2. Create via UI — fill form, submit
3. Navigate to detail page — verify fields
4. Navigate to list page — verify card visible
5. Search — verify filters to the item
6. Edit — update a field, submit, verify change
7. Duplicate — verify copy appears
8. Delete duplicate — confirm dialog, verify gone
9. Delete original — confirm dialog, verify gone
```

**Cleanup:** Use `try/finally` with API-based deletion of all created IDs.

**Audit step:**
1. Verify each artifact has exactly one E2E file: `server/tests/e2e/v4/test_{artifact}.py`.
2. Verify the test function is named `test_{artifact}_lifecycle`.
3. Check that cleanup uses `try/finally` with ID tracking.
4. Report artifacts missing E2E coverage.

---

### Rule 8: Tests must collect without errors

`pytest --collect-only` MUST report zero collection errors for both unit and integration tiers. Collection errors mean a test file imports a module that no longer exists — the test is stale and must be deleted or updated.

**Verification:**
```bash
cd server
../.venv/bin/python -m pytest tests/unit/ --collect-only 2>&1 | tail -5
../.venv/bin/python -m pytest tests/integration/ --collect-only 2>&1 | tail -5
```

Both should show `N tests collected` with no `errors` count.

**Audit step:** Run both commands. Report any collection errors with the file path and the `ModuleNotFoundError` or `ImportError` message.

---

### Rule 9: No test pollution — transaction rollback isolation

Integration tests rely on automatic transaction rollback for isolation. Tests MUST NOT:
- Commit transactions
- Call `conn.execute("COMMIT")`
- Use `conn.reset()` or connection pool operations
- Depend on state from a previous test

The `db` fixture wraps each test in a transaction and rolls back after yield.

**Audit step:** Search integration tests for `COMMIT`, `conn.reset`, `pool.`, or test methods that reference instance state set by other tests (e.g., `self.created_id` set in `test_create` and read in `test_get`). Report violations.

---

## Running the Audit

Execute these checks in order:

```bash
# 1. Collection health (Rule 8)
cd server
../.venv/bin/python -m pytest tests/unit/ --collect-only 2>&1 | tail -5
../.venv/bin/python -m pytest tests/integration/ --collect-only 2>&1 | tail -5

# 2. Inline SQL violations (Rule 1)
rg -n '(conn|db)\.(fetch|execute)' tests/integration/ --glob '*.py'
rg -n '"""(SELECT|INSERT|UPDATE|DELETE)' tests/integration/ --glob '*.py'
rg -n "f\"(SELECT|INSERT|UPDATE|DELETE)" tests/integration/ --glob '*.py'

# 3. Missing AAA comments (Rule 2)
# For each test file, check for # Arrange / # Act / # Assert

# 4. Database imports in unit tests (Rule 4)
rg -n 'import asyncpg|from asyncpg|execute_sql_typed|get_db' tests/unit/ --glob '*.py'

# 5. Untyped SQL params (Rule 6)
rg -n 'execute_sql_typed' tests/integration/ --glob '*.py' -A2 | grep 'params={'

# 6. Transaction pollution (Rule 9)
rg -n 'COMMIT|conn\.reset|pool\.' tests/integration/ --glob '*.py'
```

---

## Test Infrastructure

### Fixtures (conftest.py hierarchy)

| File | Scope | Provides |
|------|-------|----------|
| `tests/conftest.py` | session | `initialize_test_db` (Testcontainers PostgreSQL + seed data) |
| `tests/conftest.py` | function | `db` (per-test connection with auto-rollback transaction) |
| `tests/integration/conftest.py` | session | Mock agents library, FastAPI `client` with dependency override |
| `tests/integration/socket/v4/conftest.py` | function | Mock Socket.IO, patched `sio` instance and `get_db_connection` |
| `tests/e2e/conftest.py` | function | Playwright `page`, `context`, signed test headers |
| `tests/e2e/v4/conftest.py` | — | `post_json()`, `resolve_profile_ids()`, `generate_unique_name()` |

### Test SQL helpers

```
server/tests/sql/v4/integration/queries/
  api/{domain}/test_{name}_v4_complete.sql     — Arrange/Assert helpers for API tests
  infra/{domain}/test_{name}_v4_complete.sql   — Arrange/Assert helpers for infra tests
  socket/{domain}/test_{name}_v4_complete.sql  — Arrange/Assert helpers for socket tests
```

After creating or modifying test SQL files: `make sql-compile` to regenerate `tests/sql/types.py`.

### Test profiles

| Profile | ID | Role | Used In |
|---------|-----|------|---------|
| API test | `019b3be4-36f0-7ebd-ac27-52e3dba461f1` | superadmin | Integration tests |
| E2E admin | `6a2518eb-eba7-4650-aee0-d387c3fb8265` | admin | E2E tests |
| E2E guest | `965bd24f-dfae-4063-b370-e1373df46322` | guest | E2E tests |

---

## Report Format

After running all audit steps, produce a report:

```
# Test Audit Report — {date}

## Summary
- Total source modules: X
- Covered by tests: Y
- Missing test files: Z
- Rule violations: N

## Missing Test Files
| Source File | Expected Test File |
|------------|-------------------|
| ... | ... |

## Rule Violations
| Rule | File:Line | Description |
|------|-----------|-------------|
| Rule 1 (inline SQL) | tests/integration/.../test_x.py:42 | Uses `db.fetchrow()` |
| Rule 2 (no AAA) | tests/integration/.../test_y.py:15 | Missing `# Arrange` / `# Act` / `# Assert` |
| ... | ... | ... |
```
