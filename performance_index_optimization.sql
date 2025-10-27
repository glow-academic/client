-- =====================================================
-- Performance Index Optimization Migration
-- =====================================================
-- Created: $(date)
-- Purpose: Add critical indexes to improve query performance
-- Based on analysis of query patterns and database statistics
-- 
-- Tables affected:
-- - simulation_messages (18MB, frequent chat_id lookups)
-- - cohort_simulations (62K+ seq scans, 0 index usage)
-- - cohort_profiles (3.9K seq scans, low index usage)
-- - scenarios (10K+ seq scans, 3.1M tuples)
-- - simulation_scenarios (8K+ seq scans)

-- =====================================================
-- CRITICAL PRIORITY INDEXES (Phase 1)
-- =====================================================

-- 1. simulation_messages chat_id index
-- Impact: 18MB table, frequent chat_id lookups
-- Expected: 80-90% improvement for chat-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_simulation_messages_chat_id 
ON simulation_messages (chat_id);

-- 2. cohort_simulations active filter
-- Impact: 62,708 seq scans, 0 index usage - CRITICAL ISSUE
-- Expected: 95%+ reduction in sequential scans
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cohort_simulations_active 
ON cohort_simulations (active) WHERE active = true;

-- 3. cohort_profiles active filter
-- Impact: 3,896 seq scans, only 17 index scans
-- Expected: 70-80% reduction in sequential scans
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cohort_profiles_active 
ON cohort_profiles (active) WHERE active = true;

-- =====================================================
-- HIGH PRIORITY INDEXES (Phase 2)
-- =====================================================

-- 4. scenarios active filter
-- Impact: 10,512 seq scans reading 3.1M tuples
-- Expected: 60-70% improvement in filtering performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scenarios_active 
ON scenarios (active) WHERE active = true;

-- 5. simulation_scenarios active filter
-- Impact: 8,293 seq scans reading 174K tuples
-- Expected: 60-70% improvement in filtering performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_simulation_scenarios_active 
ON simulation_scenarios (active) WHERE active = true;

-- 6. Composite index for cohort_profiles common joins
-- Impact: Optimizes cohort_id + active filter combinations
-- Expected: Significant improvement in cohort-related queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cohort_profiles_cohort_active 
ON cohort_profiles (cohort_id, active) WHERE active = true;

-- =====================================================
-- MEDIUM PRIORITY INDEXES (Phase 3)
-- =====================================================

-- 7. simulation_messages type and completed filters
-- Impact: Optimizes common WHERE clauses on type and completed
-- Expected: Improvement for message filtering queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_simulation_messages_type_completed 
ON simulation_messages (type, completed) WHERE completed = false;

-- 8. scenarios department_id filter
-- Impact: Optimizes department-based scenario filtering
-- Expected: Improvement in department-specific queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scenarios_department_id 
ON scenarios (department_id);

-- 9. Composite index for simulation_scenarios
-- Impact: Optimizes simulation_id + active filter combinations
-- Expected: Improvement in simulation-scenario relationship queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_simulation_scenarios_sim_active 
ON simulation_scenarios (simulation_id, active) WHERE active = true;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check index creation status
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN (
    'simulation_messages', 
    'cohort_simulations', 
    'cohort_profiles', 
    'scenarios', 
    'simulation_scenarios'
)
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Check table statistics after index creation
SELECT 
    schemaname,
    relname,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE WHEN seq_scan > 0 THEN seq_tup_read::float / seq_scan ELSE 0 END as avg_tuples_per_seq_scan
FROM pg_stat_user_tables 
WHERE relname IN (
    'simulation_messages', 
    'cohort_simulations', 
    'cohort_profiles', 
    'scenarios', 
    'simulation_scenarios'
)
ORDER BY seq_tup_read DESC;

