# Test Coverage Priority Report

**Current Overall Coverage: 66%**  
**Target Coverage: 80%**  
**Gap: 14%**

## Summary

✅ **Completed**: All websocket utilities with 0% coverage now have 100% coverage (11 new test files created)

## Remaining Utilities Below 80% Coverage (Prioritized)

### HIGH PRIORITY - Core Agent Utilities (26-56% coverage)

These are critical for the agent system but are complex with database dependencies. **Recommendation: Integration tests rather than unit tests.**

1. **`server/app/utils/agents/run_guardrail_evaluation.py`** - **26% coverage** (50 statements, 37 missing)
   - Complex function with database connections, async operations, and external dependencies
   - **Priority**: High (core functionality)
   - **Complexity**: High (requires database fixtures, async mocking)
   - **Recommendation**: Integration tests in `server/tests/integration/`

2. **`server/app/utils/agents/get_input_guardrails.py`** - **52% coverage** (23 statements, 11 missing)
   - Creates input guardrails for agents
   - **Priority**: High (security-critical)
   - **Complexity**: Medium-High (requires database connection mocking)
   - **Recommendation**: Integration tests

3. **`server/app/utils/agents/get_output_guardrails.py`** - **56% coverage** (25 statements, 11 missing)
   - Creates output guardrails for agents
   - **Priority**: High (security-critical)
   - **Complexity**: Medium-High (requires database connection mocking)
   - **Recommendation**: Integration tests

4. **`server/app/utils/agents/build_hint_agent.py`** - **60% coverage** (15 statements, 6 missing)
   - Builds hint generation agent
   - **Priority**: Medium-High
   - **Complexity**: Medium (can be unit tested with mocks)
   - **Recommendation**: Unit tests in `server/tests/unit/agents/test_build_hint_agent.py`

### MEDIUM PRIORITY - Agent Tools (59-73% coverage)

These are utility functions for creating agent tools. Can be unit tested.

5. **`server/app/utils/agents/tools/create_objectives_function.py`** - **59% coverage** (17 statements, 7 missing)
   - Creates objectives function tool
   - **Priority**: Medium
   - **Complexity**: Low-Medium
   - **Recommendation**: Unit tests in `server/tests/unit/agents/test_create_objectives_function.py`

6. **`server/app/utils/agents/tools/create_title_description_function.py`** - **62% coverage** (16 statements, 6 missing)
   - Creates title/description function tool
   - **Priority**: Medium
   - **Complexity**: Low-Medium
   - **Recommendation**: Unit tests in `server/tests/unit/agents/test_create_title_description_function.py`

7. **`server/app/utils/agents/tools/create_evaluation_function.py`** - **64% coverage** (14 statements, 5 missing)
   - Creates evaluation function tool
   - **Priority**: Medium
   - **Complexity**: Low-Medium
   - **Recommendation**: Unit tests in `server/tests/unit/agents/test_create_evaluation_function.py`

8. **`server/app/utils/agents/tools/create_classification_function.py`** - **67% coverage** (15 statements, 5 missing)
   - Creates classification function tool
   - **Priority**: Medium
   - **Complexity**: Low-Medium
   - **Recommendation**: Unit tests in `server/tests/unit/agents/test_create_classification_function.py`

9. **`server/app/utils/agents/tools/create_summary_function.py`** - **67% coverage** (15 statements, 5 missing)
   - Creates summary function tool
   - **Priority**: Medium
   - **Complexity**: Low-Medium
   - **Recommendation**: Unit tests in `server/tests/unit/agents/test_create_summary_function.py`

10. **`server/app/utils/agents/tools/create_hint_function.py`** - **69% coverage** (13 statements, 4 missing)
    - Creates hint function tool
    - **Priority**: Medium
    - **Complexity**: Low-Medium
    - **Recommendation**: Unit tests in `server/tests/unit/agents/test_create_hint_function.py`

11. **`server/app/utils/agents/tools/create_grading_function.py`** - **73% coverage** (26 statements, 7 missing)
    - Creates grading function tool
    - **Priority**: Medium
    - **Complexity**: Medium (has async operations)
    - **Recommendation**: Unit tests in `server/tests/unit/agents/test_create_grading_function.py`

### LOW PRIORITY - Document & Chat Utilities (77-89% coverage)

These are close to 80% and have edge cases that may be less critical.

12. **`server/app/utils/document/format_document_info.py`** - **77% coverage** (66 statements, 15 missing)
    - Formats document information
    - **Priority**: Low-Medium
    - **Complexity**: Medium
    - **Recommendation**: Unit tests for edge cases in `server/tests/unit/document/test_format_document_info.py`

13. **`server/app/utils/chat/get_simulation_conversation_history.py`** - **85% coverage** (27 statements, 4 missing)
    - Gets conversation history
    - **Priority**: Low
    - **Complexity**: Low-Medium
    - **Recommendation**: Unit tests for edge cases

14. **`server/app/utils/document/pdf_pages_to_image_data_urls.py`** - **89% coverage** (18 statements, 2 missing)
    - Converts PDF pages to image data URLs
    - **Priority**: Low
    - **Complexity**: Low-Medium
    - **Recommendation**: Unit tests for edge cases

15. **`server/app/utils/csv/validate_csv_format.py`** - **89% coverage** (18 statements, 2 missing)
    - Validates CSV format
    - **Priority**: Low
    - **Complexity**: Low
    - **Recommendation**: Unit tests for edge cases

## Implementation Strategy

### Phase 1: Quick Wins (Target: +5% coverage)
- Implement unit tests for agent tools (#5-11)
- Add edge case tests for document/chat utilities (#12-15)
- **Estimated Impact**: ~5-7% coverage increase

### Phase 2: Integration Tests (Target: +7% coverage)
- Create integration tests for agent utilities (#1-3)
- These require database fixtures and are more complex
- **Estimated Impact**: ~7-9% coverage increase

### Phase 3: Final Push (Target: 80%+)
- Review any remaining gaps
- Add targeted tests for specific edge cases
- **Estimated Impact**: Reach 80%+ overall coverage

## Notes

- All websocket utilities now have 100% coverage (previously 0%)
- Core utilities (sql_helper, schema, permissions, search) already at 100%
- Most utilities are at 80%+ coverage
- The main gap is in agent-related utilities which are complex and integration-heavy

## Test File Structure

Following the new pattern of mirroring utils structure:
- `server/tests/unit/websocket/test_*.py` - One file per websocket utility ✅
- `server/tests/unit/agents/test_*.py` - One file per agent utility (to be created)
- `server/tests/integration/agents/test_*.py` - Integration tests for complex agent utilities (to be created)

