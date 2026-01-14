# Resource API Endpoints Audit

Generated: 2025-01-XX

## Summary

- **Total Resources in Enum**: 79
- **Resources with API Endpoints**: 53
- **Resources Missing API Endpoints**: 26

## Resources Missing API Endpoints

The following resources exist in the `resources` enum but do not have corresponding API endpoints in `server/app/api/v4/resources/`:

1. `auths`
2. `conditional_parameters`
3. `emails`
4. `endpoints`
5. `eval_rubric_grade_agents`
6. `group_positions`
7. `groups`
8. `groups_rubric_grade_agents`
9. `items`
10. `modalities`
11. `pricing`
12. `protocols`
13. `providers`
14. `qualities`
15. `reasoning_levels`
16. `request_limits`
17. `run_positions`
18. `runs`
19. `runs_rubric_grade_agents`
20. `scenario_flags`
21. `slugs`
22. `temperature_levels`
23. `texts`
24. `tools`
25. `values`
26. `voices`

## Notes

Some resources may intentionally not have API endpoints if they are:
- Managed through other endpoints (e.g., `auths` might be managed through auth endpoints)
- Internal-only resources (e.g., `tools`, `providers`)
- Junction table resources that don't need direct CRUD operations
- Resources that are created/managed through artifact endpoints

## Next Steps

1. Review each missing resource to determine if an endpoint is needed
2. Create endpoints following the pattern in `server/app/api/v4/resources/names.py` for resources that need direct API access
3. Update `server/app/api/v4/resources/__init__.py` to include new routers
