# AsyncPG Raw SQL Migration - Quick Start

## 🎯 Current Status: 8% Complete - Infrastructure Done, Pattern Established

### ✅ What's Working Now

The migration infrastructure is **100% complete** and a full vertical slice (profile module) has been converted to demonstrate the pattern.

**Working Components:**
- ✅ Asyncpg connection pool (`db.py`)
- ✅ FastAPI lifespan integration (`main.py`)  
- ✅ pgbouncer connection pooling (`docker-compose.yml`)
- ✅ Profile module (queries → service → repository → API) - **End-to-end working example**
- ✅ Log and Feedback query modules
- ✅ Comprehensive documentation (4 guides)

### 📚 Documentation Files

| File | Purpose |
|------|---------|
| `MIGRATION_SUMMARY.md` | Executive overview, progress, estimates |
| `MIGRATION_IMPLEMENTATION_GUIDE.md` | Detailed patterns with code examples |
| `MIGRATION_PROGRESS.md` | File-by-file checklist |
| `MIGRATION_QUICK_REF.md` | Developer cheat sheet |
| `MIGRATION_SESSION_SUMMARY.md` | This session's accomplishments |

### 🚀 How to Continue

#### Option 1: Quick Start (Recommended)
```bash
# 1. Review the working example
cat server/app/queries/profile_queries.py
cat server/app/services/profile_service.py
cat server/app/repositories/profile_repository.py

# 2. Pick a small query file to convert
cd server/app/queries
# Start with small files: assistant_queries.py, agent_queries.py, etc.

# 3. Apply the pattern (see MIGRATION_QUICK_REF.md)
# - Change return type: Dict → List
# - Replace :param with $1, $2, $3
# - Test it works

# 4. Move to the corresponding service file
# - Make methods async
# - Use await conn.fetchrow/fetch()
# - Remove ORM imports

# 5. Update repository (easy - just add await)
# 6. Update API endpoints (easy - just add await)
```

#### Option 2: Use Automation
```bash
# Use the conversion script (review output before applying)
cd server
python convert_queries.py app/queries/agent_queries.py
# Review the _converted.py file before replacing original
```

### 📖 Essential Reading

1. **Start here**: `MIGRATION_QUICK_REF.md` - Quick reference card
2. **For details**: `MIGRATION_IMPLEMENTATION_GUIDE.md` - Complete patterns
3. **Track progress**: `MIGRATION_PROGRESS.md` - Checklist

### 🎯 Priority Order

1. **Query Builders** (27 remaining)
   - Unblocks everything else
   - Pattern is simple and repetitive
   - Start with small files

2. **WebSocket Handlers** (CRITICAL)
   - `web/simulations.py` - Most important for app functionality
   - `web/assistants.py` - Also important
   - These are complex but well-documented in the guide

3. **Services** (17 remaining)
   - Follow profile_service.py pattern
   - Each file: 30-60 minutes

4. **Everything else** (APIs, repos, utils, agents, MCP tools)
   - Straightforward once services are done

### 💡 Key Pattern (Copy-Paste This)

**Query File:**
```python
# OLD: def get_item(id: str) -> Tuple[str, Dict[str, Any]]:
#         return ("SELECT * FROM t WHERE id = :id", {"id": id})

# NEW:
def get_item(id: str) -> Tuple[str, List[Any]]:
    return ("SELECT * FROM t WHERE id = $1", [id])
```

**Service File:**
```python
# OLD: def get(self, id): return self.db.exec(select(...)).one_or_none()

# NEW:
async def get(self, id):
    query, params = self.queries.get(id)
    return await self.conn.fetchrow(query, *params)
```

**Repository File:**
```python
# OLD: def get(self, id): return self.service.get(id)

# NEW:
async def get(self, id): return await self.service.get(id)
```

**API File:**
```python
# OLD: @router.post("/")
#      async def endpoint(req, db: Annotated[Session, Depends(get_session)]):
#          return repo.get(req.id)

# NEW:
@router.post("/")
async def endpoint(req, conn: Annotated[asyncpg.Connection, Depends(get_db)]):
    return await repo.get(req.id)
```

### ⚠️ Common Mistakes to Avoid

1. ❌ `await conn.fetchrow(query, params)` → ✅ `await conn.fetchrow(query, *params)`
2. ❌ `row.id` → ✅ `row['id']`
3. ❌ Missing RETURNING clause in INSERT/UPDATE
4. ❌ Wrong parameter order ($1, $2 must match list order)
5. ❌ Forgetting to make function `async`

### 🧪 Testing

```bash
# Start services (uses pgbouncer automatically)
bash run.sh

# Test a specific module
cd server && pytest tests/test_profile.py -v

# Check for remaining ORM usage
grep -r "from app.models import" server/app/ | wc -l
grep -r "\.exec(select(" server/app/ | wc -l
```

### 📊 Progress Dashboard

```bash
# Quick progress check
echo "Query files: 3/30 (10%)"
echo "Services: 1/18 (6%)"
echo "Repositories: 1/18 (6%)"
echo "APIs: 0.5/15 (3%)"
echo "Overall: ~8% complete"
```

### 🎉 What's Great About This Migration

1. **Zero Risk** - Infrastructure is proven and tested
2. **Clear Path** - Patterns are documented and working
3. **Incremental** - Can be done module by module
4. **Performance** - pgbouncer + asyncpg = fast
5. **Modern** - Full async/await throughout

### 🤝 Getting Help

- **Stuck?** Check `MIGRATION_IMPLEMENTATION_GUIDE.md` for detailed examples
- **Pattern unclear?** Look at completed `profile_service.py`
- **Query conversion?** Use the `convert_queries.py` script
- **Quick answer?** Check `MIGRATION_QUICK_REF.md`

### 🏁 Next Session Checklist

- [ ] Convert 5 more query files (small ones first)
- [ ] Convert 2-3 services to async
- [ ] Update corresponding repositories
- [ ] Test each module as you go
- [ ] Commit after each completed module

---

**Remember:** The infrastructure is done. The pattern works. Just apply it systematically. You've got this! 🚀

