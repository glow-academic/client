"""Shared fixtures for resource integration tests.

SQL types and functions are now bootstrapped once per session by
tests/conftest.py via bootstrap_all_sql(). No per-test SQL setup needed.
"""
