"""Business logic and permissions for NEW home analytics API.

Note: Most permission logic is now handled in the SQL functions.
This file is kept as a placeholder for any future Python-side permission checks.
"""

# Permission logic is now handled in the SQL functions:
# - api_get_home_overview_new_v4: Determines mode from profile role
# - api_get_home_history_new_v4: Determines viewable profiles based on mode and cohorts
