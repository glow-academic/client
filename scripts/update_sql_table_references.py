#!/usr/bin/env python3
"""
Script to update all SQL file references from artifact/resource table names
to their new suffixed versions (_artifact and _resource).
"""

import re
from pathlib import Path

# Artifact tables (22 total)
ARTIFACTS = [
    'agent', 'auth', 'chat', 'cohort', 'department', 'document',
    'eval', 'field', 'grade', 'key', 'message', 'model',
    'parameter', 'persona', 'profile', 'provider', 'rubric',
    'run', 'scenario', 'setting', 'simulation', 'tool'
]

# Resource tables (67 total)
RESOURCES = [
    'agents', 'analyses', 'audios', 'auths', 'cohorts', 'colors',
    'conditional_parameters', 'conversations', 'debug_info', 'departments',
    'descriptions', 'documents', 'emails', 'endpoints', 'eval_rubric_grade_agents',
    'evals', 'examples', 'feedbacks', 'fields', 'flags', 'hints', 'html',
    'icons', 'images', 'improvements', 'instructions', 'items', 'keys',
    'models', 'names', 'objectives', 'options', 'parameters', 'personas',
    'points', 'problem_statements', 'profiles', 'prompts', 'protocols',
    'providers', 'questions', 'reasoning_levels', 'request_limits',
    'responses', 'rubrics', 'scenario_positions', 'scenario_rubric_grade_agents',
    'scenarios', 'schema_field_items', 'schema_fields', 'schemas', 'settings',
    'simulation_scenario_flags', 'simulations', 'slugs', 'standard_groups',
    'strengths', 'temperature_levels', 'template_array_items', 'template_values',
    'templates', 'texts', 'thresholds', 'times', 'tools', 'videos', 'voices'
]

# SQL patterns to replace
PATTERNS = [
    (r'\bFROM\s+({})\b', 'FROM {}'),
    (r'\bJOIN\s+({})\b', 'JOIN {}'),
    (r'\bUPDATE\s+({})\b', 'UPDATE {}'),
    (r'\bINSERT\s+INTO\s+({})\b', 'INSERT INTO {}'),
    (r'\bDELETE\s+FROM\s+({})\b', 'DELETE FROM {}'),
    (r'\bTABLE\s+({})\b', 'TABLE {}'),
    (r'\bREFERENCES\s+({})\b', 'REFERENCES {}'),
    (r'\bINTO\s+({})\b', 'INTO {}'),
    # Handle schema-qualified names
    (r'\bFROM\s+public\.({})\b', 'FROM public.{}'),
    (r'\bJOIN\s+public\.({})\b', 'JOIN public.{}'),
    (r'\bUPDATE\s+public\.({})\b', 'UPDATE public.{}'),
    (r'\bINSERT\s+INTO\s+public\.({})\b', 'INSERT INTO public.{}'),
    (r'\bDELETE\s+FROM\s+public\.({})\b', 'DELETE FROM public.{}'),
    (r'\bTABLE\s+public\.({})\b', 'TABLE public.{}'),
    (r'\bREFERENCES\s+public\.({})\b', 'REFERENCES public.{}'),
]


def update_file(file_path: Path, table_name: str, new_name: str) -> bool:
    """Update a single SQL file with table name replacements."""
    try:
        content = file_path.read_text(encoding='utf-8')
        original_content = content
        
        # Apply all patterns
        for pattern_template, replacement_template in PATTERNS:
            pattern = pattern_template.format(re.escape(table_name))
            replacement = replacement_template.format(new_name)
            content = re.sub(pattern, replacement, content, flags=re.IGNORECASE)
        
        # Only write if content changed
        if content != original_content:
            file_path.write_text(content, encoding='utf-8')
            return True
        return False
    except Exception as e:
        print(f"Error updating {file_path}: {e}")
        return False


def main():
    sql_dir = Path('server/app/sql')
    sql_files = list(sql_dir.rglob('*.sql'))
    
    print(f"Found {len(sql_files)} SQL files")
    
    updated_count = 0
    
    # Update artifact tables
    print("\nUpdating artifact tables...")
    for artifact in ARTIFACTS:
        new_name = f"{artifact}_artifact"
        count = 0
        for sql_file in sql_files:
            if update_file(sql_file, artifact, new_name):
                count += 1
        if count > 0:
            print(f"  {artifact} → {new_name}: {count} files updated")
            updated_count += count
    
    # Update resource tables
    print("\nUpdating resource tables...")
    for resource in RESOURCES:
        new_name = f"{resource}_resource"
        count = 0
        for sql_file in sql_files:
            if update_file(sql_file, resource, new_name):
                count += 1
        if count > 0:
            print(f"  {resource} → {new_name}: {count} files updated")
            updated_count += count
    
    print(f"\nTotal files updated: {updated_count}")


if __name__ == '__main__':
    main()
