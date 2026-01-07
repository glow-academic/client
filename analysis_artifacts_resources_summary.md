# Artifacts/Resources Analysis - Summary

## Overview

This collection of documents analyzes what it would take to make all 17 top-level graph components artifacts (with singular names), and all tables related to them resources.

## Document Collection

1. **Part 1: Current State** (`analysis_artifacts_resources_part1_current_state.md`)
   - Current artifacts enum (8 values)
   - Current resources enum (31 values)
   - Current tables using artifacts/resources
   - Current pattern summary

2. **Part 2: Mapping Objects to Artifacts** (`analysis_artifacts_resources_part2_mapping_objects_to_artifacts.md`)
   - Mapping 17 core objects to artifacts
   - Proposed artifact names (all singular)
   - Conflict analysis (field resource vs field artifact)
   - Updated artifacts enum proposal (21 artifacts)

3. **Part 3: Mapping Tables to Resources** (`analysis_artifacts_resources_part3_mapping_tables_to_resources.md`)
   - Mapping all related tables to resources
   - Resource naming convention
   - Detailed mapping for each of the 17 artifacts
   - Estimated ~200+ resources needed

4. **Part 4: Migration Strategy** (`analysis_artifacts_resources_part4_migration_strategy.md`)
   - Migration phases
   - Challenges (enum limitations, large number of resources)
   - Estimated effort (4-6 weeks)
   - Alternative approach (table-based resources)

## Key Findings

### Artifacts
- **Current**: 8 artifacts
- **Proposed**: 21 artifacts (8 existing + 13 new)
- **New artifacts**: cohort, simulation, persona, parameter, field, model, eval, department, provider, auth, key, setting, profile

### Resources
- **Current**: 31 resources
- **Proposed**: ~200+ resources
- **Breakdown**: ~100+ junction table resources + ~100+ attribute resources (from denormalization)

### Key Concepts
1. **Artifacts are singular**: All artifact enum values are singular (scenario, persona, document, field, profile)
2. **Resources are plural**: Resources are the plural form of table names (personas, departments, emails, names)
3. **Junction table pattern**: Junction tables follow `{artifact}_{resource}` where artifact is singular and resource is plural (e.g., `scenario_personas`, `profile_departments`)
4. **Artifacts can be resources**: An entity can be both an artifact (top-level, singular) AND a resource (when referenced by another artifact, plural). Example: `personas` table → artifact `persona` (singular), resource `personas` (plural when referenced by `scenario`)
5. **Database table names**: Database table names are typically plural (e.g., `documents`, `fields`, `personas`), artifact enum values are singular (e.g., `document`, `field`, `persona`)

### Challenges
1. **Enum limitations**: PostgreSQL doesn't easily support adding 200+ enum values
2. **Large scope**: Massive migration affecting entire codebase
3. **Type safety**: Enum approach maintains type safety but is inflexible

### Recommendations
1. **Hybrid approach**: Keep artifacts as enum (small, stable), consider resources as table (large, growing)
2. **Phased rollout**: Add artifacts/resources incrementally
3. **Comprehensive testing**: Test each addition thoroughly

## Related Documents

- **Denormalization Analysis**: `analysis_graph_components_denormalization.md`
  - Analysis of denormalizing 17 objects with junction tables
  - ~29 attribute tables + ~120-130 junction tables

## Next Steps

1. Review all 4 parts of the analysis
2. Decide on approach (enum vs table for resources)
3. Resolve field conflict (rename resource to document_field)
4. Plan phased migration strategy
5. Begin implementation

