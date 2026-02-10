-- Materialized View: mv_benchmark_messages (deprecated)
--
-- Benchmark test detail now reads from mv_benchmark_tests + mv_benchmark_invocations.
-- Message rows are derived from messages_entry directly when needed.

DROP MATERIALIZED VIEW IF EXISTS mv_benchmark_messages CASCADE;
