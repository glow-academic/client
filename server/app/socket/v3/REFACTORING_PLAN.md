# Socket v3 Refactoring Plan

This document breaks down the socket folder refactoring into 10 independent batches that can be assigned to different agents. Each batch is self-contained with no cross-file dependencies.

## Batch A: Lifecycle Events (Critical Fixes)

**Files:**
- `server/app/socket/v3/connect.py`
- `server/app/socket/v3/disconnect.py`

**Issues to Fix:**
1. Remove `logger` import and all logging calls (line 9, 20 in connect.py)
2. Replace `get_pool` import with `get_db_connection` import (line 18 in connect.py)
3. Fix incomplete exception handlers (lines 88, 107, 117, 138 in connect.py)
4. Add missing `get_db_connection` import in connect.py
5. Replace `load_sql()` + `conn.fetchrow()` with `execute_sql_typed()` pattern
6. Ensure proper error handling (emit error events instead of silent failures)

**SQL Files to Check/Create:**
- `app/sql/v3/profile/update_profile_to_inactive_complete.sql` - ensure it's a PostgreSQL function
- `app/sql/v3/profile/update_profile_to_active_complete.sql` - ensure it's a PostgreSQL function

---

## Batch B: Rubric Agent + Tools

**Files:**
- `server/app/socket/v3/agents/rubric/generate.py`
- `server/app/socket/v3/agents/rubric/regenerate.py`
- `server/app/socket/v3/agents/rubric/progress.py`
- `server/app/socket/v3/agents/rubric/complete.py`
- `server/app/socket/v3/agents/rubric/error.py`
- `server/app/socket/v3/agents/rubric/tools/title/call.py`
- `server/app/socket/v3/agents/rubric/tools/title/complete.py`
- `server/app/socket/v3/agents/rubric/tools/title/error.py`
- `server/app/socket/v3/agents/rubric/tools/title/progress.py`
- `server/app/socket/v3/agents/rubric/tools/title/eval.py` (verify exists)
- `server/app/socket/v3/agents/rubric/tools/debug/*.py` (all 5 required files)
- `server/app/socket/v3/agents/rubric/tools/standard_description/*.py` (if exists, all 5 required files)

**Issues to Fix:**
1. Remove `json.dumps()` calls in `generate.py` (lines 296, 299) and `regenerate.py` (lines 270, 273)
2. Replace with composite type serialization or direct string formatting
3. Ensure `tools/title/call.py` uses `execute_sql_typed()` instead of `load_sql()` + `conn.fetchrow()`
4. Verify all tool files exist and follow standards (call, complete, error, progress, eval)
5. Ensure all SQL files use PostgreSQL functions, not raw queries

**SQL Files to Check:**
- `app/sql/v3/rubric/get_rubric_run_context_and_create_run_complete.sql`
- `app/sql/v3/rubric/get_rubric_regeneration_run_context_and_create_run_complete.sql`
- `app/sql/v3/rubric/rubric_generation_progress_complete.sql`
- `app/sql/v3/rubric/rubric_generation_complete_complete.sql`
- `app/sql/v3/rubric/rubric_generation_error_complete.sql`
- `app/sql/v3/rubric/update_rubric_name.sql` (should be `update_rubric_name_complete.sql` with function)

---

## Batch C: Scenario Agent + Tools

**Files:**
- `server/app/socket/v3/agents/scenario/generate.py`
- `server/app/socket/v3/agents/scenario/regenerate.py`
- `server/app/socket/v3/agents/scenario/progress.py`
- `server/app/socket/v3/agents/scenario/complete.py`
- `server/app/socket/v3/agents/scenario/error.py`
- `server/app/socket/v3/agents/scenario/tools/title/*.py` (all 5 required files)
- `server/app/socket/v3/agents/scenario/tools/question/*.py` (all 5 required files)
- `server/app/socket/v3/agents/scenario/tools/document/*.py` (all 5 required files)
- `server/app/socket/v3/agents/scenario/tools/image/*.py` (all 5 required files)
- `server/app/socket/v3/agents/scenario/tools/video/*.py` (all 5 required files)
- `server/app/socket/v3/agents/scenario/tools/objective/*.py` (all 5 required files)
- `server/app/socket/v3/agents/scenario/tools/statement/*.py` (all 5 required files)
- `server/app/socket/v3/agents/scenario/tools/debug/*.py` (all 5 required files)

**Issues to Fix:**
1. Remove all `json.loads()` calls in `generate.py` and `regenerate.py` (multiple instances)
2. Replace `load_sql()` + direct execution with `execute_sql_typed()` pattern
3. Convert JSONB parsing to composite types
4. Ensure all SQL files use PostgreSQL functions with composite types instead of JSONB
5. Verify all tool files exist and follow standards

**SQL Files to Check:**
- `app/sql/v3/scenario/get_scenario_run_context_and_create_run.sql` (should be `_complete.sql` with function)
- `app/sql/v3/scenario/get_scenario_regeneration_run_context_and_create_run.sql` (should be `_complete.sql` with function)
- All scenario-related SQL files in `app/sql/v3/scenario/`

---

## Batch D: Simulation Agent + Tools

**Files:**
- `server/app/socket/v3/agents/simulation/generate.py`
- `server/app/socket/v3/agents/simulation/progress.py`
- `server/app/socket/v3/agents/simulation/complete.py`
- `server/app/socket/v3/agents/simulation/error.py`
- `server/app/socket/v3/agents/simulation/tools/debug/*.py` (all 5 required files)
- `server/app/socket/v3/agents/simulation/tools/speak/*.py` (all 5 required files)

**Issues to Fix:**
1. Remove `json.loads()` calls in `generate.py` (lines 755, 863)
2. Replace `load_sql()` + direct execution with `execute_sql_typed()` pattern
3. Convert JSONB parsing to composite types
4. Determine if `regenerate.py` is needed (may not be required for simulations)
5. Verify all tool files exist and follow standards

**SQL Files to Check:**
- `app/sql/v3/simulation/*.sql` files
- Ensure all use PostgreSQL functions with composite types

---

## Batch E: Hint Agent + Tools

**Files:**
- `server/app/socket/v3/agents/hint/generate.py`
- `server/app/socket/v3/agents/hint/progress.py`
- `server/app/socket/v3/agents/hint/complete.py`
- `server/app/socket/v3/agents/hint/error.py`
- `server/app/socket/v3/agents/hint/tools/debug/*.py` (all 5 required files)
- `server/app/socket/v3/agents/hint/tools/hint/*.py` (all 5 required files)

**Issues to Fix:**
1. Remove `json.loads()` calls in `generate.py` (lines 140, 420)
2. Replace `load_sql()` + direct execution with `execute_sql_typed()` pattern
3. Convert JSONB parsing to composite types
4. Determine if `regenerate.py` is needed
5. Verify all tool files exist and follow standards

**SQL Files to Check:**
- `app/sql/v3/simulations/generate_hints_complete.sql`
- `app/sql/v3/simulations/get_simulation_messages.sql` (should be `_complete.sql` with function)

---

## Batch F: Grade Agent + Tools

**Files:**
- `server/app/socket/v3/agents/grade/generate.py`
- `server/app/socket/v3/agents/grade/progress.py`
- `server/app/socket/v3/agents/grade/complete.py`
- `server/app/socket/v3/agents/grade/error.py`
- `server/app/socket/v3/agents/grade/tools/debug/*.py` (all 5 required files)
- `server/app/socket/v3/agents/grade/tools/grade/*.py` (all 5 required files)
- `server/app/socket/v3/agents/grade/tools/strength/*.py` (all 5 required files)
- `server/app/socket/v3/agents/grade/tools/improvement/*.py` (all 5 required files)
- `server/app/socket/v3/agents/grade/tools/audio/*.py` (all 5 required files)

**Issues to Fix:**
1. Remove `json.loads()` calls in `generate.py` (lines 170, 175)
2. Remove `json.dumps()` calls in tool files (`strength/call.py`, `improvement/call.py`)
3. Replace `load_sql()` + direct execution with `execute_sql_typed()` pattern
4. Convert JSONB parsing to composite types
5. Determine if `regenerate.py` is needed
6. Verify all tool files exist and follow standards

**SQL Files to Check:**
- `app/sql/v3/grading/get_grading_run_context_and_create_run.sql` (should be `_complete.sql` with function)
- `app/sql/v3/grading/create_grade_complete.sql`
- `app/sql/v3/grading/update_grade_final.sql` (should be `_complete.sql` with function)
- All grading-related SQL files

---

## Batch G: Document Agent + Tools

**Files:**
- `server/app/socket/v3/agents/document/generate.py`
- `server/app/socket/v3/agents/document/progress.py`
- `server/app/socket/v3/agents/document/complete.py`
- `server/app/socket/v3/agents/document/error.py`
- `server/app/socket/v3/agents/document/tools/debug/*.py` (all 5 required files)
- `server/app/socket/v3/agents/document/tools/title/*.py` (all 5 required files)

**Issues to Fix:**
1. Remove `json.loads()` and `json.dumps()` calls in `generate.py` (lines 337, 430, 486, 522)
2. Replace `load_sql()` + direct execution with `execute_sql_typed()` pattern
3. Convert JSONB parsing to composite types
4. Determine if `regenerate.py` is needed
5. Verify all tool files exist and follow standards

**SQL Files to Check:**
- All document-related SQL files in `app/sql/v3/document/`

---

## Batch H: Voice Agent + Tools

**Files:**
- `server/app/socket/v3/agents/voice/generate.py`
- `server/app/socket/v3/agents/voice/progress.py`
- `server/app/socket/v3/agents/voice/complete.py`
- `server/app/socket/v3/agents/voice/error.py`
- `server/app/socket/v3/agents/voice/tools/debug/*.py` (all 5 required files)
- `server/app/socket/v3/agents/voice/tools/speak/*.py` (all 5 required files)

**Issues to Fix:**
1. Remove `json.dumps()` calls in `generate.py` (line 516)
2. Remove `json.loads()` calls in `progress.py` (line 480)
3. Replace `load_sql()` + direct execution with `execute_sql_typed()` pattern
4. Convert JSONB parsing to composite types
5. Determine if `regenerate.py` is needed
6. Verify all tool files exist and follow standards

**SQL Files to Check:**
- All voice-related SQL files in `app/sql/v3/simulation_voice/`

---

## Batch I: Video, Audio, Image Agents + Tools

**Files:**
- `server/app/socket/v3/agents/video/generate.py`
- `server/app/socket/v3/agents/video/progress.py`
- `server/app/socket/v3/agents/video/complete.py`
- `server/app/socket/v3/agents/video/error.py`
- `server/app/socket/v3/agents/video/tools/debug/*.py` (all 5 required files)
- `server/app/socket/v3/agents/video/tools/title/*.py` (all 5 required files)
- `server/app/socket/v3/agents/audio/generate.py`
- `server/app/socket/v3/agents/audio/progress.py`
- `server/app/socket/v3/agents/audio/complete.py`
- `server/app/socket/v3/agents/audio/error.py`
- `server/app/socket/v3/agents/audio/tools/debug/*.py` (all 5 required files)
- `server/app/socket/v3/agents/image/generate.py`
- `server/app/socket/v3/agents/image/progress.py`
- `server/app/socket/v3/agents/image/complete.py`
- `server/app/socket/v3/agents/image/error.py`
- `server/app/socket/v3/agents/image/tools/debug/*.py` (all 5 required files)
- `server/app/socket/v3/agents/image/tools/title/*.py` (all 5 required files)

**Issues to Fix:**
1. Remove `json.loads()` calls in `audio/generate.py` (lines 162, 167)
2. Replace `load_sql()` + direct execution with `execute_sql_typed()` pattern
3. Convert JSONB parsing to composite types
4. Determine if `regenerate.py` is needed for any of these agents
5. Verify all tool files exist and follow standards

**SQL Files to Check:**
- All video-related SQL files
- All audio-related SQL files
- All image-related SQL files

---

## Batch J: Member, Classify Agents + Simulations Operations + SQL Audit

**Files:**
- `server/app/socket/v3/agents/member/generate.py`
- `server/app/socket/v3/agents/member/progress.py`
- `server/app/socket/v3/agents/member/complete.py`
- `server/app/socket/v3/agents/member/error.py`
- `server/app/socket/v3/agents/member/tools/conversation/*.py` (all 5 required files)
- `server/app/socket/v3/agents/classify/generate.py`
- `server/app/socket/v3/agents/classify/progress.py`
- `server/app/socket/v3/agents/classify/complete.py`
- `server/app/socket/v3/agents/classify/error.py`
- `server/app/socket/v3/agents/classify/tools/debug/*.py` (all 5 required files)
- `server/app/socket/v3/agents/classify/tools/classification/*.py` (all 5 required files)
- `server/app/socket/v3/simulations/start.py`
- `server/app/socket/v3/simulations/advance.py`
- `server/app/socket/v3/simulations/next.py`
- `server/app/socket/v3/simulations/end.py`
- `server/app/socket/v3/simulations/enter.py`
- `server/app/socket/v3/simulations/join.py`
- `server/app/socket/v3/simulations/leave.py`
- `server/app/socket/v3/simulations/stop.py`

**Issues to Fix:**
1. Replace `load_sql()` + direct execution with `execute_sql_typed()` pattern in all simulation operation files
2. Convert JSONB parsing to composite types
3. Verify all tool files exist and follow standards
4. Audit all SQL files in `app/sql/v3/simulations/` for JSONB usage
5. Ensure all SQL files use PostgreSQL functions with composite types

**SQL Files to Check:**
- All simulation operation SQL files
- `app/sql/v3/simulations/start_simulation_attempt_complete.sql` (has JSONB - needs conversion)
- All member and classify-related SQL files