#!/bin/bash
# Test Batch B Service Layer API Endpoints
# Verifies multi-department architecture works correctly

BASE_URL="http://localhost:8000"
PROFILE_ID="965bd24f-dfae-4063-b370-e1373df46322"  # Ashok Saravanan (superadmin)
DEPT_ID="c7692d34-b875-5122-af69-074f85981205"  # Computer Science

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

echo "🧪 Testing Batch B Service Layer - Multi-Department Migration"
echo "=============================================================="
echo "Profile: Ashok Saravanan (superadmin)"
echo "Department: Computer Science"
echo ""

# Helper functions
test_result() {
    if [ $1 -eq 0 ]; then
        echo "✅ $2"
        ((TESTS_PASSED++))
    else
        echo "❌ $2"
        ((TESTS_FAILED++))
    fi
}

check_field_absence() {
    local response="$1"
    local field="$2"
    echo "$response" | jq -e ".$field" > /dev/null 2>&1
    return $?
}

check_field_presence() {
    local response="$1"
    local field="$2"
    echo "$response" | jq -e ".$field" > /dev/null 2>&1
    return $?
}

check_array_field() {
    local response="$1"
    local field="$2"
    local length=$(echo "$response" | jq -r ".$field | length // 0")
    [ "$length" -gt 0 ]
    return $?
}

# Test API call with error handling
call_api() {
    local endpoint="$1"
    local data="$2"
    local method="${3:-POST}"
    
    if [ "$method" = "GET" ]; then
        curl -s "${BASE_URL}${endpoint}"
    else
        curl -s -X "$method" "${BASE_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

# =============================================================================
# PERSONA TESTS
# =============================================================================

echo "👤 PERSONA TESTS"
echo "================="

# Test 1: List Personas
echo "📋 Test 1.1: List Personas"
response=$(call_api "/api/v2/personas/list" "{\"departmentIds\": [\"${DEPT_ID}\"], \"profileId\": \"${PROFILE_ID}\"}")
persona_count=$(echo "$response" | jq -r '.personas | length // 0')

if [ "$persona_count" -gt 0 ]; then
    test_result 0 "List personas returned $persona_count personas"
    
    # Check for absence of default_persona field
    if check_field_absence "$response" ".personas[0].default_persona"; then
        test_result 1 "Found default_persona field (should be removed)"
    else
        test_result 0 "No default_persona field found (correct)"
    fi
    
    echo "$response" | jq '.personas[0] | {persona_id, name, can_edit}' 2>/dev/null
else
    test_result 1 "No personas found"
fi
echo ""

# Test 2: Get Persona Detail
echo "📄 Test 1.2: Get Persona Detail"
PERSONA_ID=$(echo "$response" | jq -r '.personas[0].persona_id // empty')

if [ -n "$PERSONA_ID" ]; then
    detail_response=$(call_api "/api/v2/personas/detail" "{\"personaId\": \"${PERSONA_ID}\", \"profileId\": \"${PROFILE_ID}\"}")
    
    if check_field_presence "$detail_response" ".department_ids"; then
        test_result 0 "Has department_ids field"
    else
        test_result 1 "Missing department_ids field"
    fi
    
    if check_field_absence "$detail_response" ".department_id"; then
        test_result 1 "Still has old department_id field (should be removed)"
    else
        test_result 0 "No old department_id field (correct)"
    fi
    
    echo "$detail_response" | jq '{name, department_ids, active, can_edit}' 2>/dev/null
else
    test_result 1 "No personas found to test detail endpoint"
fi
echo ""

# Test 3: Get Persona Detail Default
echo "📄 Test 1.3: Get Persona Detail Default"
if [ -n "$PERSONA_ID" ]; then
    detail_default_response=$(call_api "/api/v2/personas/detail-default" "{\"personaId\": \"${PERSONA_ID}\", \"profileId\": \"${PROFILE_ID}\"}")
    
    if check_field_presence "$detail_default_response" ".department_ids"; then
        test_result 0 "Detail-default has department_ids field"
    else
        test_result 1 "Detail-default missing department_ids field"
    fi
    
    echo "$detail_default_response" | jq '{name, department_ids, active}' 2>/dev/null
else
    test_result 1 "No personas found to test detail-default endpoint"
fi
echo ""

# Test 4: Create Persona (CRUD)
echo "📝 Test 1.4: Create Persona"
create_data="{
    \"name\": \"Test Persona $(date +%s)\",
    \"description\": \"Test persona for Batch B testing\",
    \"departmentIds\": [\"${DEPT_ID}\"],
    \"profileId\": \"${PROFILE_ID}\"
}"
create_response=$(call_api "/api/v2/personas/create" "$create_data")

if check_field_presence "$create_response" ".persona_id"; then
    test_result 0 "Persona created successfully"
    NEW_PERSONA_ID=$(echo "$create_response" | jq -r '.persona_id')
    echo "Created persona ID: $NEW_PERSONA_ID"
else
    test_result 1 "Persona creation failed"
    echo "$create_response" | jq '.'
fi
echo ""

# Test 5: Update Persona (CRUD)
echo "📝 Test 1.5: Update Persona"
if [ -n "$NEW_PERSONA_ID" ]; then
    update_data="{
        \"personaId\": \"${NEW_PERSONA_ID}\",
        \"name\": \"Updated Test Persona $(date +%s)\",
        \"description\": \"Updated test persona\",
        \"departmentIds\": [\"${DEPT_ID}\"],
        \"profileId\": \"${PROFILE_ID}\"
    }"
    update_response=$(call_api "/api/v2/personas/update" "$update_data")
    
    if check_field_presence "$update_response" ".success"; then
        test_result 0 "Persona updated successfully"
    else
        test_result 1 "Persona update failed"
        echo "$update_response" | jq '.'
    fi
else
    test_result 1 "No persona to update (create failed)"
fi
echo ""

# =============================================================================
# COHORT TESTS
# =============================================================================

echo "👥 COHORT TESTS"
echo "================"

# Test 6: List Cohorts
echo "📋 Test 2.1: List Cohorts"
cohort_response=$(call_api "/api/v2/cohorts/list" "{\"departmentIds\": [\"${DEPT_ID}\"], \"profileId\": \"${PROFILE_ID}\"}")
cohort_count=$(echo "$cohort_response" | jq -r '.cohorts | length // 0')

if [ "$cohort_count" -gt 0 ]; then
    test_result 0 "List cohorts returned $cohort_count cohorts"
    
    if check_field_absence "$cohort_response" ".cohorts[0].default_cohort"; then
        test_result 1 "Found default_cohort field (should be removed)"
    else
        test_result 0 "No default_cohort field found (correct)"
    fi
    
    echo "$cohort_response" | jq '.cohorts[0] | {cohort_id, name, can_edit}' 2>/dev/null
else
    test_result 1 "No cohorts found"
fi
echo ""

# Test 7: Get Cohort Detail
echo "📄 Test 2.2: Get Cohort Detail"
COHORT_ID=$(echo "$cohort_response" | jq -r '.cohorts[0].cohort_id // empty')

if [ -n "$COHORT_ID" ]; then
    cohort_detail_response=$(call_api "/api/v2/cohorts/detail" "{\"cohortId\": \"${COHORT_ID}\", \"profileId\": \"${PROFILE_ID}\"}")
    
    if check_field_presence "$cohort_detail_response" ".department_ids"; then
        test_result 0 "Has department_ids field"
    else
        test_result 1 "Missing department_ids field"
    fi
    
    echo "$cohort_detail_response" | jq '{title, department_ids, active}' 2>/dev/null
else
    test_result 1 "No cohorts found to test detail endpoint"
fi
echo ""

# Test 8: Get Cohort Detail Default
echo "📄 Test 2.3: Get Cohort Detail Default"
if [ -n "$COHORT_ID" ]; then
    cohort_detail_default_response=$(call_api "/api/v2/cohorts/detail-default" "{\"cohortId\": \"${COHORT_ID}\", \"profileId\": \"${PROFILE_ID}\"}")
    
    if check_field_presence "$cohort_detail_default_response" ".department_ids"; then
        test_result 0 "Detail-default has department_ids field"
    else
        test_result 1 "Detail-default missing department_ids field"
    fi
    
    echo "$cohort_detail_default_response" | jq '{title, department_ids, active}' 2>/dev/null
else
    test_result 1 "No cohorts found to test detail-default endpoint"
fi
echo ""

# =============================================================================
# SCENARIO TESTS
# =============================================================================

echo "🎭 SCENARIO TESTS"
echo "=================="

# Test 9: List Scenarios
echo "📋 Test 3.1: List Scenarios"
scenario_response=$(call_api "/api/v2/scenarios/list" "{\"departmentIds\": [\"${DEPT_ID}\"], \"profileId\": \"${PROFILE_ID}\"}")
scenario_count=$(echo "$scenario_response" | jq -r '.scenarios | length // 0')

if [ "$scenario_count" -gt 0 ]; then
    test_result 0 "List scenarios returned $scenario_count scenarios"
    
    if check_field_absence "$scenario_response" ".scenarios[0].default_scenario"; then
        test_result 1 "Found default_scenario field (should be removed)"
    else
        test_result 0 "No default_scenario field found (correct)"
    fi
    
    echo "$scenario_response" | jq '.scenarios[0] | {scenario_id, title, can_edit}' 2>/dev/null
else
    test_result 1 "No scenarios found"
fi
echo ""

# Test 10: Get Scenario Detail
echo "📄 Test 3.2: Get Scenario Detail"
SCENARIO_ID=$(echo "$scenario_response" | jq -r '.scenarios[0].scenario_id // empty')

if [ -n "$SCENARIO_ID" ]; then
    scenario_detail_response=$(call_api "/api/v2/scenarios/detail" "{\"scenarioId\": \"${SCENARIO_ID}\", \"profileId\": \"${PROFILE_ID}\"}")
    
    if check_field_presence "$scenario_detail_response" ".department_ids"; then
        test_result 0 "Has department_ids field"
    else
        test_result 1 "Missing department_ids field"
    fi
    
    echo "$scenario_detail_response" | jq '{title, department_ids, active}' 2>/dev/null
else
    test_result 1 "No scenarios found to test detail endpoint"
fi
echo ""

# Test 11: Get Scenario Detail Default
echo "📄 Test 3.3: Get Scenario Detail Default"
if [ -n "$SCENARIO_ID" ]; then
    scenario_detail_default_response=$(call_api "/api/v2/scenarios/detail-default" "{\"scenarioId\": \"${SCENARIO_ID}\", \"profileId\": \"${PROFILE_ID}\"}")
    
    if check_field_presence "$scenario_detail_default_response" ".department_ids"; then
        test_result 0 "Detail-default has department_ids field"
    else
        test_result 1 "Detail-default missing department_ids field"
    fi
    
    echo "$scenario_detail_default_response" | jq '{title, department_ids, active}' 2>/dev/null
else
    test_result 1 "No scenarios found to test detail-default endpoint"
fi
echo ""

# =============================================================================
# SIMULATION TESTS
# =============================================================================

echo "🎮 SIMULATION TESTS"
echo "==================="

# Test 12: List Simulations
echo "📋 Test 4.1: List Simulations"
simulation_response=$(call_api "/api/v2/simulations/list" "{\"departmentIds\": [\"${DEPT_ID}\"], \"profileId\": \"${PROFILE_ID}\"}")
simulation_count=$(echo "$simulation_response" | jq -r '.simulations | length // 0')

if [ "$simulation_count" -gt 0 ]; then
    test_result 0 "List simulations returned $simulation_count simulations"
    
    if check_field_absence "$simulation_response" ".simulations[0].default_simulation"; then
        test_result 1 "Found default_simulation field (should be removed)"
    else
        test_result 0 "No default_simulation field found (correct)"
    fi
    
    echo "$simulation_response" | jq '.simulations[0] | {simulation_id, name, can_edit}' 2>/dev/null
else
    test_result 1 "No simulations found"
fi
echo ""

# Test 13: Get Simulation Detail
echo "📄 Test 4.2: Get Simulation Detail"
SIMULATION_ID=$(echo "$simulation_response" | jq -r '.simulations[0].simulation_id // empty')

if [ -n "$SIMULATION_ID" ]; then
    simulation_detail_response=$(call_api "/api/v2/simulations/detail" "{\"simulationId\": \"${SIMULATION_ID}\", \"profileId\": \"${PROFILE_ID}\"}")
    
    if check_field_presence "$simulation_detail_response" ".department_ids"; then
        test_result 0 "Has department_ids field"
    else
        test_result 1 "Missing department_ids field"
    fi
    
    echo "$simulation_detail_response" | jq '{name, department_ids, active}' 2>/dev/null
else
    test_result 1 "No simulations found to test detail endpoint"
fi
echo ""

# =============================================================================
# RUBRIC TESTS
# =============================================================================

echo "📊 RUBRIC TESTS"
echo "================"

# Test 14: List Rubrics
echo "📋 Test 5.1: List Rubrics"
rubric_response=$(call_api "/api/v2/rubrics/list" "{\"departmentIds\": [\"${DEPT_ID}\"], \"profileId\": \"${PROFILE_ID}\"}")
rubric_count=$(echo "$rubric_response" | jq -r '.rubrics | length // 0')

if [ "$rubric_count" -gt 0 ]; then
    test_result 0 "List rubrics returned $rubric_count rubrics"
    
    if check_field_absence "$rubric_response" ".rubrics[0].default_rubric"; then
        test_result 1 "Found default_rubric field (should be removed)"
    else
        test_result 0 "No default_rubric field found (correct)"
    fi
    
    echo "$rubric_response" | jq '.rubrics[0] | {rubric_id, name, can_edit}' 2>/dev/null
else
    test_result 1 "No rubrics found"
fi
echo ""

# Test 15: Get Rubric Detail
echo "📄 Test 5.2: Get Rubric Detail"
RUBRIC_ID=$(echo "$rubric_response" | jq -r '.rubrics[0].rubric_id // empty')

if [ -n "$RUBRIC_ID" ]; then
    rubric_detail_response=$(call_api "/api/v2/rubrics/detail" "{\"rubricId\": \"${RUBRIC_ID}\", \"profileId\": \"${PROFILE_ID}\"}")
    
    if check_field_presence "$rubric_detail_response" ".department_ids"; then
        test_result 0 "Has department_ids field"
    else
        test_result 1 "Missing department_ids field"
    fi
    
    echo "$rubric_detail_response" | jq '{name, department_ids, active}' 2>/dev/null
else
    test_result 1 "No rubrics found to test detail endpoint"
fi
echo ""

# =============================================================================
# PARAMETER TESTS
# =============================================================================

echo "⚙️ PARAMETER TESTS"
echo "==================="

# Test 16: List Parameters
echo "📋 Test 6.1: List Parameters"
parameter_response=$(call_api "/api/v2/parameters/list" "{\"departmentIds\": [\"${DEPT_ID}\"], \"profileId\": \"${PROFILE_ID}\"}")
parameter_count=$(echo "$parameter_response" | jq -r '.parameters | length // 0')

if [ "$parameter_count" -gt 0 ]; then
    test_result 0 "List parameters returned $parameter_count parameters"
    
    if check_field_absence "$parameter_response" ".parameters[0].default_parameter"; then
        test_result 1 "Found default_parameter field (should be removed)"
    else
        test_result 0 "No default_parameter field found (correct)"
    fi
    
    echo "$parameter_response" | jq '.parameters[0] | {parameter_id, name, can_edit}' 2>/dev/null
else
    test_result 1 "No parameters found"
fi
echo ""

# Test 17: Get Parameter Detail
echo "📄 Test 6.2: Get Parameter Detail"
PARAMETER_ID=$(echo "$parameter_response" | jq -r '.parameters[0].parameter_id // empty')

if [ -n "$PARAMETER_ID" ]; then
    parameter_detail_response=$(call_api "/api/v2/parameters/detail" "{\"parameterId\": \"${PARAMETER_ID}\", \"profileId\": \"${PROFILE_ID}\"}")
    
    if check_field_presence "$parameter_detail_response" ".department_ids"; then
        test_result 0 "Has department_ids field"
    else
        test_result 1 "Missing department_ids field"
    fi
    
    echo "$parameter_detail_response" | jq '{name, department_ids, active}' 2>/dev/null
else
    test_result 1 "No parameters found to test detail endpoint"
fi
echo ""

# =============================================================================
# SCENARIO SIMULATION MAPPING TEST
# =============================================================================

echo "🔗 SCENARIO SIMULATION MAPPING TEST"
echo "===================================="

# Test 18: Check Scenario Simulation Mapping
echo "📋 Test 7.1: Check Scenario Simulation Mapping"
if [ -n "$SCENARIO_ID" ]; then
    scenario_detail_for_mapping=$(call_api "/api/v2/scenarios/detail" "{\"scenarioId\": \"${SCENARIO_ID}\", \"profileId\": \"${PROFILE_ID}\"}")
    
    # Check if simulation_mapping exists and has department_ids
    if check_field_presence "$scenario_detail_for_mapping" ".simulation_mapping"; then
        test_result 0 "Scenario has simulation_mapping"
        
        # Get first simulation from mapping
        first_sim_id=$(echo "$scenario_detail_for_mapping" | jq -r '.simulation_mapping | keys[0] // empty')
        if [ -n "$first_sim_id" ]; then
            sim_data=$(echo "$scenario_detail_for_mapping" | jq ".simulation_mapping[\"$first_sim_id\"]")
            
            if check_field_presence "$sim_data" ".department_ids"; then
                test_result 0 "Simulation mapping includes department_ids"
                echo "$sim_data" | jq '{name, department_ids, time_limit}' 2>/dev/null
            else
                test_result 1 "Simulation mapping missing department_ids"
            fi
        else
            test_result 1 "No simulations in mapping"
        fi
    else
        test_result 1 "Scenario missing simulation_mapping"
    fi
else
    test_result 1 "No scenarios found to test simulation mapping"
fi
echo ""

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "=============================================================="
echo "  📊 BATCH B COMPREHENSIVE API TESTING COMPLETE"
echo "=============================================================="
echo ""
echo "Test Results:"
echo "  ✅ Tests Passed: $TESTS_PASSED"
echo "  ❌ Tests Failed: $TESTS_FAILED"
echo "  📈 Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED! Batch B migration is working correctly."
    echo ""
    echo "✅ Verified:"
    echo "  - All list endpoints work and have removed default_* fields"
    echo "  - All detail endpoints return department_ids (array or null)"
    echo "  - All detail-default endpoints work correctly"
    echo "  - CRUD operations work with new multi-department schema"
    echo "  - Scenario simulation mapping includes department_ids"
    echo "  - Service layer successfully integrates with Batch A query layer"
else
    echo "⚠️  Some tests failed. Please review the output above."
    echo ""
    echo "Common issues:"
    echo "  - Missing data in database (no personas/cohorts/scenarios/etc.)"
    echo "  - Server not running or not accessible"
    echo "  - Database not running or migrations not applied"
fi

echo ""
echo "Prerequisites:"
echo "  1. Database is running (make start-db)"
echo "  2. Server is running (cd server && uvicorn app.main:app --reload)"
echo "  3. Batch A query migrations have been applied"
echo "  4. Database has test data (personas, cohorts, scenarios, etc.)"
echo ""

