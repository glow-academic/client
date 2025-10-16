# AsyncPG Migration - Quick Reference Card

## 🚀 Getting Started

```bash
# Read the guides
cat MIGRATION_SUMMARY.md           # Overview & progress
cat MIGRATION_IMPLEMENTATION_GUIDE.md  # Detailed patterns
cat MIGRATION_PROGRESS.md          # File-by-file checklist

# Install new dependencies
cd server && pip install -r requirements.txt

# Test locally (requires pgbouncer)
bash run.sh
```

## 📝 Conversion Cheat Sheet

### Query Builder
```python
# OLD
def get(id: str) -> Tuple[str, Dict[str, Any]]:
    return ("SELECT * FROM t WHERE id = :id", {"id": id})

# NEW  
def get(id: str) -> Tuple[str, List[Any]]:
    return ("SELECT * FROM t WHERE id = $1", [id])
```

### Service
```python
# OLD
from sqlalchemy.orm import Session
from app.models import Items

class Service:
    def __init__(self, db: Session):
        self.db = db
    
    def get(self, id):
        return self.db.exec(select(Items).where(Items.id == id)).one_or_none()

# NEW
import asyncpg
from app.queries.item_queries import ItemQueries

class Service:
    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn
        self.queries = ItemQueries()
    
    async def get(self, id):
        query, params = self.queries.get(id)
        return await self.conn.fetchrow(query, *params)
```

### Repository
```python
# OLD
def get(self, id): return self.service.get(id)

# NEW
async def get(self, id): return await self.service.get(id)
```

### API Endpoint
```python
# OLD
from app.db import get_session
from sqlalchemy.orm import Session

@router.post("/item")
async def get_item(req: Req, db: Annotated[Session, Depends(get_session)]):
    return repo.get(req.id)

# NEW
import asyncpg
from app.db import get_db

@router.post("/item")
async def get_item(req: Req, conn: Annotated[asyncpg.Connection, Depends(get_db)]):
    return await repo.get(req.id)
```

## 🔍 Common Operations

```python
# Get single row
row = await conn.fetchrow("SELECT * FROM t WHERE id = $1", id)
if row: name = row['name']

# Get multiple rows
rows = await conn.fetch("SELECT * FROM t WHERE active = $1", True)
for row in rows: print(row['name'])

# Get single value
count = await conn.fetchval("SELECT COUNT(*) FROM t")

# INSERT with RETURNING
new_row = await conn.fetchrow(
    "INSERT INTO t (name) VALUES ($1) RETURNING *", 
    "name"
)

# UPDATE
await conn.execute(
    "UPDATE t SET name = $1 WHERE id = $2",
    "new_name", id
)

# Transaction
from app.db import transaction
async with transaction(conn):
    await conn.execute(...)
    await conn.execute(...)
```

## ⚠️ Watch Out For

1. **Unpack params**: `await conn.fetchrow(query, *params)` ← note the `*`
2. **Use RETURNING**: Add to INSERT/UPDATE to get created/updated row
3. **Dict access**: `row['id']` not `row.id`
4. **Positional order**: $1, $2, $3 must match param list order exactly
5. **Await everything**: Don't forget `await` on async calls
6. **WebSocket pool**: Use `get_pool().acquire()` not `Depends(get_db)`

## 📂 Priority Order

1. ✅ Infrastructure (DONE)
2. 🔄 Query builders (START HERE - 29 files)
3. 🔄 Services (17 files)
4. 🔄 WebSockets (2 files - CRITICAL)
5. 🔄 API endpoints (14 files)
6. 🔄 Agent services (9 files)
7. 🔄 MCP tools (10 files)
8. 🔄 Utils (9 files)
9. 🔄 Repositories (17 files)
10. 🧪 Testing & cleanup

## 🎯 Example: Converting a Query File

```bash
# 1. Open file
vim server/app/queries/cohort_queries.py

# 2. Find/replace pattern
:%s/: Tuple\[str, Dict\[str, Any\]\]/: Tuple[str, List[Any]]/g
:%s/params: Dict\[str, Any\]/params: List[Any]/g
:%s/params = {/params = [/g
:%s/}/]/g

# 3. Manual fixes
# - Replace :param with $1, $2, $3...
# - Change dict values to list items
# - Handle dynamic queries with counter

# 4. Test
cd server && python -m pytest tests/test_cohort.py
```

## 📊 Progress Check

```bash
# Count remaining ORM imports
grep -r "from app.models import" server/app/ | wc -l

# Count remaining Session imports
grep -r "from sqlalchemy.orm import Session" server/app/ | wc -l

# Count remaining select() calls  
grep -r "\.exec(select(" server/app/ | wc -l

# Find un-awaited calls (potential bugs)
grep -r "repo\." server/app/api | grep -v "await"
```

## 🐛 Debugging

```python
# Print query and params
query, params = queries.get_item(id)
print(f"Query: {query}")
print(f"Params: {params}")

# Test query directly
result = await conn.fetch(query, *params)
print(f"Result: {result}")

# Check connection
pool = get_pool()
print(f"Pool size: {pool.get_size()}")
print(f"Free connections: {pool.get_idle_size()}")
```

## 🚦 Testing Migration

```bash
# Start with pgbouncer
bash run.sh

# Run specific test
cd server && pytest tests/test_profile.py -v

# Run all tests
cd server && make test

# Check for errors
tail -f server/logs/*.log | grep ERROR
```

## 📞 Need Help?

- Check `MIGRATION_IMPLEMENTATION_GUIDE.md` for detailed examples
- Look at completed `services/profile_service.py` for reference
- Search for pattern: `git grep "await conn.fetchrow"`
- The infrastructure is solid - just apply the pattern!

## ⚡ Quick Tips

- Work on one module at a time (query → service → repo → API)
- Test after each file conversion
- Commit frequently with clear messages
- Use the completed profile module as reference
- When stuck, check the implementation guide

**Remember: The pattern works. Trust it. Apply it. Test it. Move on.**

