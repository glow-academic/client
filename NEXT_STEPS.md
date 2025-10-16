# AsyncPG Migration - Next Steps

## Current Status: 35% Complete (40 of 115 files)

### ✅ What's Working Right Now

**4 Complete Modules (queries → service → repo → API):**
1. Profile module ✅
2. Log module ✅
3. Feedback module ✅
4. Agent module ✅

**Infrastructure:**
- async pg pool ✅
- pgbouncer ✅
- FastAPI async lifecycle ✅
- Transaction support ✅

**Query Layer: 73% (22/30 files)**

## 🚀 Quick Wins (Do These Next)

### Batch 1: Services Ready Now (5-6 hours)
These services have all their query dependencies met:

1. **provider_service.py** → provider_repository.py → api/v2/providers.py
2. **parameter_service.py** → parameter_repository.py → api/v2/parameters.py
3. **persona_service.py** → persona_repository.py → api/v2/personas.py
4. **rubric_service.py** → rubric_repository.py → api/v2/rubrics.py
5. **department_service.py** → department_repository.py → api/v2/departments.py
6. **cohort_service.py** → cohort_repository.py → api/v2/cohorts.py

Each module: ~1 hour → 6 modules = 6 hours → **45% total complete**

### Batch 2: Finish Queries (3-4 hours)
2 large files remaining:

1. **scenario_queries.py** (556 lines)
2. **simulation_queries.py** (1025 lines)

Then convert:
- scenario_service.py → scenario_repository.py → api/v2/scenarios.py
- simulation_service.py → simulation_repository.py → api/v2/simulations.py

After this: **55% total complete**

### Batch 3: WebSocket Handlers (4-6 hours)
Critical for app functionality:

1. **web/simulations.py** (1035 lines)
   - Heavy ORM usage
   - Most complex conversion
   - Critical for chat functionality

2. **web/assistants.py**
   - Similar to simulations.py
   - Also critical

After this: **60% total complete**

### Batch 4: Analytics (2-3 hours)
1. **analytics_service.py** (queries already done ✅)
2. **analytics_repository.py**
3. **api/v2/analytics/*.py** (9 files)

After this: **65% total complete**

### Batch 5: Everything Else (10-15 hours)
- Agent services (9 files)
- MCP tools (10 files)  
- Utils (9 files)
- Remaining repos/APIs

After this: **95% total complete**

### Batch 6: Cleanup & Testing (4-6 hours)
- Delete models.py
- Remove all ORM imports
- Run full test suite
- Update AGENTS.md
- Performance testing

After this: **100% COMPLETE** 🎉

## 📋 Step-by-Step Conversion Guide

### For Each Module:

**1. Service File (~30-45 min)**
```python
# Change imports
from sqlalchemy.orm import Session → import asyncpg
from app.models import X → # Remove

# Change constructor
def __init__(self, db: Session) → def __init__(self, conn: asyncpg.Connection)

# Update methods
def method(self) → async def method(self)
self.db.execute(text(query), params) → await self.conn.fetchrow/fetch(query, *params)
result.column → result['column']
```

**2. Repository File (~10-15 min)**
```python
# Change constructor
def __init__(self, db: Session) → def __init__(self, conn: asyncpg.Connection)

# Add await to all service calls
return self.service.method() → return await self.service.method()
```

**3. API File (~10-15 min)**
```python
# Change imports
from app.db import get_session → from app.db import get_db
from sqlalchemy.orm import Session → import asyncpg

# Update dependency
db: Session = Depends(get_session) → conn: asyncpg.Connection = Depends(get_db)

# Add await
return repo.method() → return await repo.method()
```

**Total per module: ~1 hour**

## 🎯 Recommended Execution Plan

### Week 1: Services Sprint
- **Day 1**: Convert 3 services (provider, parameter, persona)
- **Day 2**: Convert 3 services (rubric, department, cohort)
- **Day 3**: Finish large queries (scenario, simulation)
- **Day 4**: Convert scenario/simulation services
- **Day 5**: Analytics service + endpoints

**End of Week 1: ~60% complete**

### Week 2: Complex Components
- **Day 1-2**: WebSocket handlers (simulations, assistants)
- **Day 3**: Agent services
- **Day 4**: MCP tools
- **Day 5**: Utils

**End of Week 2: ~85% complete**

### Week 3: Polish
- **Day 1-2**: Remaining files
- **Day 3**: Delete models.py, remove ORM imports
- **Day 4-5**: Testing, optimization, documentation

**End of Week 3: 100% COMPLETE** 🎉

## 📚 Reference Documents

Quick access to guides:

1. **MIGRATION_QUICK_REF.md** - Cheat sheet
2. **MIGRATION_IMPLEMENTATION_GUIDE.md** - Detailed patterns
3. **MIGRATION_FINAL_SUMMARY.md** - This summary
4. **MIGRATION_PROGRESS_LATEST.md** - Latest progress

Working examples:
- services/profile_service.py
- services/log_service.py
- services/feedback_service.py
- services/agent_service.py

## ⚡ Quick Commands

```bash
# Check remaining ORM usage
grep -r "from app.models import" server/app/ | wc -l

# Check remaining Session usage
grep -r "from sqlalchemy.orm import Session" server/app/ | wc -l

# Check conversion progress
ls server/app/services/*service.py | wc -l  # Total services
grep -l "asyncpg.Connection" server/app/services/*service.py | wc -l  # Converted

# Test converted modules
cd server && pytest tests/test_profile.py tests/test_log.py tests/test_feedback.py tests/test_agent.py -v
```

## 🎉 Major Milestones Achieved

- ✅ Infrastructure 100% complete
- ✅ pgbouncer configured and working
- ✅ Query layer 73% complete
- ✅ 4 complete working modules
- ✅ Pattern proven across multiple domains
- ✅ Comprehensive documentation
- ✅ 35% of entire migration complete

## 💪 Why This is Going Well

1. **Clear Architecture** - Clean separation of layers
2. **Existing Structure** - Query builders already existed
3. **Good Patterns** - Consistent code style
4. **Incremental** - Can test each module
5. **Documentation** - Every pattern documented

## 🏁 Path to Completion

**Current: 35%** → **50% (Batch 1)** → **60% (Batch 2+3)** → **85% (Batch 4+5)** → **100% (Batch 6)**

**Total Remaining Time: 25-35 hours of focused work**

The foundation is rock-solid. The pattern is proven. The path is clear.

**Let's finish this! 🚀**

