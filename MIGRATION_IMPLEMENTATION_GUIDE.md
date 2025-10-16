# AsyncPG Raw SQL Migration - Implementation Guide

## Overview

This guide documents the completed infrastructure and provides templates for completing the remaining conversions.

## ✅ Completed: Full Vertical Slice

### Infrastructure (Phase 1) - COMPLETE
- [x] `requirements.txt` - Removed SQLModel/psycopg2, added asyncpg 0.30.0
- [x] `db.py` - New async connection pool with `get_db()` dependency
- [x] `main.py` - Lifespan manager for pool init/shutdown
- [x] `docker-compose.yml` - Added pgbouncer, configured connection routing

### Working Example: Profile Module - COMPLETE
- [x] `queries/profile_queries.py` - Converted to positional params
- [x] `services/profile_service.py` - Async with asyncpg.Connection
- [x] `repositories/profile_repository.py` - Async wrapper
- [x] `api/v2/profile.py` - Auth endpoints converted to async

## 🔄 Conversion Patterns

### 1. Query Builder Conversion

**Before (Named Params):**
```python
def get_item(self, item_id: str) -> Tuple[str, Dict[str, Any]]:
    query = "SELECT * FROM items WHERE id = :item_id"
    return (query, {"item_id": item_id})
```

**After (Positional Params):**
```python
def get_item(self, item_id: str) -> Tuple[str, List[Any]]:
    query = "SELECT * FROM items WHERE id = $1"
    return (query, [item_id])
```

**Dynamic Query with Multiple Params:**
```python
def update_item(self, item_id: str, updates: Dict[str, Any]) -> Tuple[str, List[Any]]:
    set_clauses = []
    params: List[Any] = []
    param_counter = 1
    
    for key, value in updates.items():
        set_clauses.append(f"{key} = ${param_counter}")
        params.append(value)
        param_counter += 1
    
    set_clauses.append("updated_at = NOW()")
    params.append(item_id)  # Add ID as last param
    
    query = f"""
        UPDATE items SET {', '.join(set_clauses)}
        WHERE id = ${param_counter}
        RETURNING *
    """
    return (query, params)
```

### 2. Service Conversion

**Before (ORM):**
```python
from sqlalchemy.orm import Session
from app.models import Items

class ItemService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_item(self, item_id: str) -> Optional[ItemModel]:
        return self.db.exec(select(Items).where(Items.id == item_id)).one_or_none()
    
    def create_item(self, name: str) -> ItemModel:
        item = Items(name=name)
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item
```

**After (Raw SQL with asyncpg):**
```python
import asyncpg
from app.queries.item_queries import ItemQueries

class ItemService:
    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn
        self.queries = ItemQueries()
    
    async def get_item(self, item_id: str) -> Optional[ItemDict]:
        query, params = self.queries.get_item(item_id)
        result = await self.conn.fetchrow(query, *params)
        return dict(result) if result else None
    
    async def create_item(self, name: str) -> ItemDict:
        query = """
            INSERT INTO items (name, created_at)
            VALUES ($1, NOW())
            RETURNING *
        """
        result = await self.conn.fetchrow(query, name)
        return dict(result)
```

### 3. Repository Conversion

**Before:**
```python
class ItemRepository:
    def __init__(self, db: Session):
        self.service = ItemService(db)
    
    def get_item(self, item_id: str) -> Optional[ItemModel]:
        return self.service.get_item(item_id)
```

**After:**
```python
class ItemRepository:
    def __init__(self, conn: asyncpg.Connection):
        self.service = ItemService(conn)
    
    async def get_item(self, item_id: str) -> Optional[ItemDict]:
        return await self.service.get_item(item_id)
```

### 4. API Endpoint Conversion

**Before:**
```python
from app.db import get_session
from sqlalchemy.orm import Session

@router.post("/item")
async def get_item(
    request: ItemRequest,
    db: Annotated[Session, Depends(get_session)],
):
    repo = ItemRepository(db)
    return repo.get_item(request.itemId)
```

**After:**
```python
import asyncpg
from app.db import get_db

@router.post("/item")
async def get_item(
    request: ItemRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
):
    repo = ItemRepository(conn)
    return await repo.get_item(request.itemId)
```

### 5. WebSocket Handler Conversion

**Before (ORM with session):**
```python
from app.db import get_session
from app.models import Messages
from sqlmodel import select

def process_message(message_id: str):
    db = next(get_session())
    try:
        msg = db.exec(select(Messages).where(Messages.id == message_id)).one()
        new_msg = Messages(content="reply")
        db.add(new_msg)
        db.commit()
        db.refresh(new_msg)
        return new_msg
    finally:
        db.close()
```

**After (asyncpg with pool):**
```python
from app.db import get_pool

async def process_message(message_id: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        msg = await conn.fetchrow(
            "SELECT * FROM messages WHERE id = $1",
            message_id
        )
        new_msg = await conn.fetchrow(
            """INSERT INTO messages (content, created_at)
               VALUES ($1, NOW())
               RETURNING *""",
            "reply"
        )
        return dict(new_msg)
```

### 6. Transaction Pattern

**Simple Transaction:**
```python
from app.db import transaction

async with transaction(conn):
    await conn.execute(
        "INSERT INTO items (name) VALUES ($1)",
        "item1"
    )
    await conn.execute(
        "INSERT INTO logs (action) VALUES ($1)",
        "created item1"
    )
    # Auto-commits on success, rolls back on exception
```

**Complex Multi-Step Transaction:**
```python
from app.db import transaction

async def create_simulation_with_scenarios(conn, sim_data, scenario_ids):
    async with transaction(conn):
        # Insert simulation
        sim = await conn.fetchrow(
            """INSERT INTO simulations (name, description, created_at)
               VALUES ($1, $2, NOW())
               RETURNING *""",
            sim_data['name'], sim_data['description']
        )
        
        # Insert scenario junctions
        for position, scenario_id in enumerate(scenario_ids):
            await conn.execute(
                """INSERT INTO simulation_scenarios (simulation_id, scenario_id, position)
                   VALUES ($1, $2, $3)""",
                sim['id'], scenario_id, position
            )
        
        return dict(sim)
```

### 7. Agent Service Pattern (ModelRuns)

**Before (ORM):**
```python
from app.models import ModelRuns

model_run = ModelRuns(
    provider_id=provider_id,
    model_id=model_id,
    input_tokens=100,
    output_tokens=50
)
db.add(model_run)
db.commit()
db.refresh(model_run)
return model_run.id
```

**After (Raw SQL):**
```python
model_run = await conn.fetchrow(
    """INSERT INTO model_runs 
       (provider_id, model_id, input_tokens, output_tokens, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *""",
    provider_id, model_id, 100, 50
)
return model_run['id']
```

## 📝 Systematic Conversion Checklist

For each module, follow this order:

### Query File (e.g., `queries/item_queries.py`)
- [ ] Change return type: `Tuple[str, Dict[str, Any]]` → `Tuple[str, List[Any]]`
- [ ] Replace `:param` with `$1`, `$2`, etc.
- [ ] Build `params` as List instead of Dict
- [ ] Handle dynamic queries with param counter

### Service File (e.g., `services/item_service.py`)
- [ ] Remove `from app.models import *`
- [ ] Change constructor: `Session` → `asyncpg.Connection`
- [ ] Add `async` to all methods
- [ ] Replace `db.execute(text(query), params)` with `await conn.fetchrow/fetch(query, *params)`
- [ ] Replace ORM ops (`db.add`, `db.commit`) with INSERT/UPDATE queries
- [ ] Change `result.column` to `result['column']` (dict access)

### Repository File (e.g., `repositories/item_repository.py`)
- [ ] Change constructor: `Session` → `asyncpg.Connection`
- [ ] Add `async` to all methods
- [ ] Add `await` to all service calls
- [ ] Update factory function signature

### API File (e.g., `api/v2/items.py`)
- [ ] Change import: `get_session` → `get_db`
- [ ] Change import: Remove `sqlalchemy.orm.Session`, add `asyncpg`
- [ ] Change dependency: `Session` → `asyncpg.Connection`
- [ ] Add `await` to all repository/service calls
- [ ] Verify all handlers are `async`

## 🚀 Next Steps

### Priority 1: Complete Query Conversions
Convert all remaining query builders (~29 files) to positional params. This unblocks all downstream conversions.

**Files:**
- All files in `queries/*.py`
- All files in `queries/analytics/*.py`

### Priority 2: WebSocket Handlers (CRITICAL)
These are the most complex conversions with heavy ORM usage:
- `web/simulations.py` (~1035 lines)
- `web/assistants.py`

### Priority 3: Remaining Services
Apply service conversion pattern to ~17 remaining services.

### Priority 4: Agent Services
Convert agent collection services that create ModelRuns and DebugInfo.

### Priority 5: MCP Tools
Convert MCP tools that use ORM select() queries.

### Priority 6: Utils
Convert utility files that import from models.py.

### Priority 7: API Endpoints
Complete conversion of all API endpoint files.

### Priority 8: Testing & Cleanup
- Update test mocks to use asyncpg.Connection
- Run full test suite
- Delete `models.py` (1091 lines)
- Verify no ORM imports remain

## 🎯 Quick Reference

### Common Conversions

| ORM Pattern | AsyncPG Pattern |
|-------------|-----------------|
| `db.exec(select(...)).one_or_none()` | `await conn.fetchrow(query, *params)` |
| `db.exec(select(...)).all()` | `await conn.fetch(query, *params)` |
| `db.add(obj); db.commit()` | `await conn.execute(insert_query, *params)` |
| `db.refresh(obj)` | Use `RETURNING *` in INSERT/UPDATE |
| `db.commit()` | Use `transaction()` context manager |
| `result.column` | `result['column']` |
| `:param` in query | `$1, $2, $3` in query |
| `params = {"key": val}` | `params = [val]` |

### asyncpg Query Methods

| Method | Use Case | Returns |
|--------|----------|---------|
| `fetchrow()` | Get single row | `asyncpg.Record` or `None` |
| `fetch()` | Get multiple rows | `List[asyncpg.Record]` |
| `fetchval()` | Get single value | Any type or `None` |
| `execute()` | INSERT/UPDATE/DELETE | `str` (status) |

### Accessing Results

```python
# Single row
row = await conn.fetchrow("SELECT * FROM items WHERE id = $1", item_id)
if row:
    item_id = row['id']  # Dict-like access
    name = row['name']

# Multiple rows
rows = await conn.fetch("SELECT * FROM items")
for row in rows:
    print(row['name'])

# Convert to dict
item_dict = dict(row) if row else None
```

## ⚠️ Common Pitfalls

1. **Forgetting `*params` unpacking**: `await conn.fetchrow(query, *params)` not `await conn.fetchrow(query, params)`
2. **Not using RETURNING**: Add `RETURNING *` to INSERT/UPDATE to get the created/updated row
3. **Dict vs Record access**: asyncpg returns `Record` objects, access with `[]` not `.`
4. **Param order**: Must match $1, $2, $3 order exactly
5. **Transaction scope**: Use `transaction()` context manager, don't manage manually
6. **Pool vs Connection**: WebSockets should use `get_pool().acquire()`, APIs use `Depends(get_db)`

## 📊 Progress Tracking

See `MIGRATION_PROGRESS.md` for current status and detailed file-by-file progress.

