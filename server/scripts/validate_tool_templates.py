#!/usr/bin/env python3
"""Validate tool templates and schemas.

This script audits:
1. All resources in the resources enum
2. Which resources have tools
3. Tool structure validation (template_id chains, schemas)
4. Jinja template validation (syntax and variable references)
5. Output schema vs database table validation
"""

import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

import asyncpg  # type: ignore
from jinja2 import Environment, TemplateSyntaxError

# Add server directory to path for imports
server_dir = Path(__file__).parent.parent
sys.path.insert(0, str(server_dir))

# Jinja2 environment for validation
jinja_env = Environment(autoescape=True, trim_blocks=True, lstrip_blocks=True)


def extract_jinja_variables(template: str) -> set[str]:
    """Extract variable names from Jinja template.
    
    Args:
        template: Jinja template string
        
    Returns:
        Set of variable names (base names before . or |)
    """
    if not template or not template.strip():
        return set()
    
    # Pattern to match {{ variable }} or {{ variable.property }} or {{ variable|filter }}
    pattern = r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)'
    matches = re.findall(pattern, template)
    
    # Extract base variable names (before first . or |)
    variables = set()
    for match in matches:
        # Remove any filters or properties
        base_name = match.split('.')[0].split('|')[0].strip()
        if base_name:
            variables.add(base_name)
    
    return variables


def validate_jinja_syntax(template: str) -> tuple[bool, str | None]:
    """Validate Jinja template syntax.
    
    Args:
        template: Jinja template string
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not template or not template.strip():
        return True, None
    
    try:
        jinja_env.parse(template)
        return True, None
    except TemplateSyntaxError as e:
        return False, str(e)
    except Exception as e:
        return False, f"Template validation error: {str(e)}"


async def run_audit(conn: asyncpg.Connection) -> dict[str, Any]:
    """Run comprehensive audit of tools and templates.
    
    Args:
        conn: Database connection
        
    Returns:
        Dictionary with audit results
    """
    results: dict[str, Any] = {
        "resources": [],
        "resources_with_tools": [],
        "resources_missing_tools": [],
        "tools": [],
        "tools_missing_output_schema": [],
        "tools_missing_input_schema": [],
        "jinja_validation_errors": [],
        "schema_table_mismatches": [],
        "resources_missing_tables": [],
        "statistics": {},
    }
    
    # Query 1: All resources
    resources = await conn.fetch("""
        SELECT enumlabel::text as resource
        FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'resources')
        ORDER BY enumlabel
    """)
    results["resources"] = [r["resource"] for r in resources]
    
    # Query 2: Resources with tools
    resources_with_tools = await conn.fetch("""
        SELECT 
            rt.resource::text,
            COUNT(DISTINCT rt.tool_id) as tool_count,
            string_agg(DISTINCT t.name, ', ' ORDER BY t.name) as tool_names
        FROM resource_tools rt
        JOIN tools t ON t.id = rt.tool_id
        WHERE t.active = true
        GROUP BY rt.resource
        ORDER BY rt.resource
    """)
    results["resources_with_tools"] = [
        {
            "resource": r["resource"],
            "tool_count": r["tool_count"],
            "tool_names": r["tool_names"],
        }
        for r in resources_with_tools
    ]
    
    # Query 3: Resources missing tools
    resources_missing_tools = await conn.fetch("""
        SELECT enumlabel::text as resource
        FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'resources')
        AND enumlabel::text NOT IN (
            SELECT DISTINCT resource::text 
            FROM resource_tools
        )
        ORDER BY enumlabel
    """)
    results["resources_missing_tools"] = [r["resource"] for r in resources_missing_tools]
    
    # Query 4: Tool structure
    tools = await conn.fetch("""
        SELECT 
            t.id as tool_id,
            t.name as tool_name,
            t.template_id,
            rt.resource::text as resource,
            CASE WHEN ts.schema_id IS NOT NULL THEN true ELSE false END as has_input_schema,
            ts.schema_id as input_schema_id,
            CASE WHEN st.schema_id IS NOT NULL THEN true ELSE false END as has_output_schema,
            st.schema_id as output_schema_id,
            CASE WHEN tmpl.id IS NOT NULL THEN true ELSE false END as template_exists,
            (SELECT COUNT(*) FROM schema_fields WHERE schema_id = ts.schema_id) as input_field_count,
            (SELECT COUNT(*) FROM schema_fields WHERE schema_id = st.schema_id) as output_field_count
        FROM tools t
        LEFT JOIN resource_tools rt ON rt.tool_id = t.id
        LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
        LEFT JOIN schema_templates st ON st.template_id = t.template_id
        LEFT JOIN templates tmpl ON tmpl.id = t.template_id
        WHERE t.active = true
        ORDER BY t.name
    """)
    results["tools"] = [dict(r) for r in tools]
    
    # Query 5: Tools missing output schemas
    tools_missing_output = await conn.fetch("""
        SELECT 
            t.id as tool_id,
            t.name as tool_name,
            t.template_id,
            rt.resource::text as resource
        FROM tools t
        JOIN resource_tools rt ON rt.tool_id = t.id
        LEFT JOIN schema_templates st ON st.template_id = t.template_id
        WHERE t.active = true
        AND st.schema_id IS NULL
        ORDER BY t.name
    """)
    results["tools_missing_output_schema"] = [dict(r) for r in tools_missing_output]
    
    # Query 6: Tools missing input schemas
    tools_missing_input = await conn.fetch("""
        SELECT 
            t.id as tool_id,
            t.name as tool_name,
            rt.resource::text as resource
        FROM tools t
        JOIN resource_tools rt ON rt.tool_id = t.id
        LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
        WHERE t.active = true
        AND ts.schema_id IS NULL
        ORDER BY t.name
    """)
    results["tools_missing_input_schema"] = [dict(r) for r in tools_missing_input]
    
    # Query 7: Tool input arguments
    tool_arguments = await conn.fetch("""
        SELECT 
            t.id as tool_id,
            t.name as tool_name,
            rt.resource::text as resource,
            sf.name as argument_name,
            sf.field_type as argument_type,
            sf.description as argument_description,
            sf.position
        FROM tools t
        JOIN resource_tools rt ON rt.tool_id = t.id
        LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
        LEFT JOIN schema_fields sf ON sf.schema_id = ts.schema_id
        WHERE t.active = true
        ORDER BY t.name, sf.position NULLS LAST
    """)
    
    # Build tool arguments map
    tool_args_map: dict[str, set[str]] = defaultdict(set)
    for arg in tool_arguments:
        tool_name = arg["tool_name"]
        arg_name = arg["argument_name"]
        if arg_name:
            tool_args_map[tool_name].add(arg_name)
    
    # Query 8: Tool output schema fields with Jinja templates
    output_fields = await conn.fetch("""
        SELECT 
            t.id as tool_id,
            t.name as tool_name,
            rt.resource::text as resource,
            sf.name as output_field_name,
            sf.field_type as output_field_type,
            sf.template as jinja_template,
            sf.position
        FROM tools t
        JOIN resource_tools rt ON rt.tool_id = t.id
        LEFT JOIN schema_templates st ON st.template_id = t.template_id
        LEFT JOIN schema_fields sf ON sf.schema_id = st.schema_id
        WHERE t.active = true
        ORDER BY t.name, sf.position NULLS LAST
    """)
    
    # Validate Jinja templates
    jinja_errors = []
    for field in output_fields:
        tool_name = field["tool_name"]
        output_field = field["output_field_name"]
        template = field["jinja_template"]
        
        if not template or not template.strip():
            continue
        
        # Validate syntax
        is_valid, error_msg = validate_jinja_syntax(template)
        if not is_valid:
            jinja_errors.append({
                "tool_name": tool_name,
                "output_field": output_field,
                "error": error_msg,
                "template": template,
            })
            continue
        
        # Extract variables and validate against tool arguments
        variables = extract_jinja_variables(template)
        available_args = tool_args_map.get(tool_name, set())
        
        for var in variables:
            if var not in available_args:
                jinja_errors.append({
                    "tool_name": tool_name,
                    "output_field": output_field,
                    "error": f"Template references unknown variable '{var}'",
                    "template": template,
                    "available_arguments": sorted(available_args),
                })
    
    results["jinja_validation_errors"] = jinja_errors
    
    # Query 9: Output schema fields vs database table columns
    schema_table_checks = await conn.fetch("""
        SELECT 
            t.id as tool_id,
            t.name as tool_name,
            rt.resource::text as resource,
            sf.name as schema_field_name,
            CASE 
                WHEN EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = rt.resource::text
                    AND column_name = sf.name
                ) THEN true
                ELSE false
            END as field_exists_in_table,
            CASE 
                WHEN EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = rt.resource::text
                ) THEN true
                ELSE false
            END as table_exists
        FROM tools t
        JOIN resource_tools rt ON rt.tool_id = t.id
        LEFT JOIN schema_templates st ON st.template_id = t.template_id
        LEFT JOIN schema_fields sf ON sf.schema_id = st.schema_id
        WHERE t.active = true
        AND sf.name IS NOT NULL
        ORDER BY t.name, sf.position
    """)
    
    schema_mismatches = []
    for check in schema_table_checks:
        if not check["table_exists"]:
            schema_mismatches.append({
                "tool_name": check["tool_name"],
                "resource": check["resource"],
                "schema_field": check["schema_field_name"],
                "error": f"Table '{check['resource']}' does not exist",
            })
        elif not check["field_exists_in_table"]:
            schema_mismatches.append({
                "tool_name": check["tool_name"],
                "resource": check["resource"],
                "schema_field": check["schema_field_name"],
                "error": f"Field '{check['schema_field_name']}' does not exist in table '{check['resource']}'",
            })
    
    results["schema_table_mismatches"] = schema_mismatches
    
    # Query 10: Resources without corresponding tables
    resources_missing_tables = await conn.fetch("""
        SELECT enumlabel::text as resource
        FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'resources')
        AND enumlabel::text NOT IN (
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        )
        ORDER BY enumlabel
    """)
    results["resources_missing_tables"] = [r["resource"] for r in resources_missing_tables]
    
    # Query 11: Summary statistics
    stats = await conn.fetchrow("""
        SELECT 
            (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'resources')) as total_resources,
            (SELECT COUNT(DISTINCT resource) FROM resource_tools) as resources_with_tools,
            (SELECT COUNT(*) FROM tools WHERE active = true) as total_active_tools,
            (SELECT COUNT(*) FROM tools t 
             JOIN resource_tools rt ON rt.tool_id = t.id
             LEFT JOIN schema_templates st ON st.template_id = t.template_id
             WHERE t.active = true AND st.schema_id IS NULL) as tools_missing_output_schema,
            (SELECT COUNT(*) FROM tools t
             JOIN resource_tools rt ON rt.tool_id = t.id
             LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
             WHERE t.active = true AND ts.schema_id IS NULL) as tools_missing_input_schema
    """)
    results["statistics"] = dict(stats) if stats else {}
    
    return results


def print_report(results: dict[str, Any]) -> None:
    """Print comprehensive audit report.
    
    Args:
        results: Audit results dictionary
    """
    print("=" * 80)
    print("RESOURCE TOOLS TEMPLATE AUDIT REPORT")
    print("=" * 80)
    print()
    
    # Statistics
    stats = results["statistics"]
    print("📊 STATISTICS")
    print("-" * 80)
    print(f"Total resources in enum: {stats.get('total_resources', 0)}")
    print(f"Resources with tools: {stats.get('resources_with_tools', 0)}")
    print(f"Total active tools: {stats.get('total_active_tools', 0)}")
    print(f"Tools missing output schema: {stats.get('tools_missing_output_schema', 0)}")
    print(f"Tools missing input schema: {stats.get('tools_missing_input_schema', 0)}")
    print()
    
    # Resources missing tools
    missing_tools = results["resources_missing_tools"]
    if missing_tools:
        print("❌ RESOURCES MISSING TOOLS")
        print("-" * 80)
        for resource in missing_tools:
            print(f"  - {resource}")
        print()
    else:
        print("✅ All resources have tools")
        print()
    
    # Tools missing output schemas
    missing_output = results["tools_missing_output_schema"]
    if missing_output:
        print("⚠️  TOOLS MISSING OUTPUT SCHEMAS")
        print("-" * 80)
        for tool in missing_output:
            print(f"  - {tool['tool_name']} (resource: {tool['resource']})")
        print()
    else:
        print("✅ All tools have output schemas")
        print()
    
    # Tools missing input schemas (warning only)
    missing_input = results["tools_missing_input_schema"]
    if missing_input:
        print("ℹ️  TOOLS MISSING INPUT SCHEMAS (optional)")
        print("-" * 80)
        for tool in missing_input:
            print(f"  - {tool['tool_name']} (resource: {tool['resource']})")
        print()
    
    # Jinja validation errors
    jinja_errors = results["jinja_validation_errors"]
    if jinja_errors:
        print("❌ JINJA TEMPLATE VALIDATION ERRORS")
        print("-" * 80)
        for error in jinja_errors:
            print(f"  Tool: {error['tool_name']}")
            print(f"  Field: {error['output_field']}")
            print(f"  Error: {error['error']}")
            if 'available_arguments' in error:
                print(f"  Available arguments: {', '.join(error['available_arguments'])}")
            print(f"  Template: {error['template']}")
            print()
    else:
        print("✅ All Jinja templates are valid")
        print()
    
    # Schema-table mismatches
    schema_mismatches = results["schema_table_mismatches"]
    if schema_mismatches:
        print("❌ SCHEMA-TABLE MISMATCHES")
        print("-" * 80)
        for mismatch in schema_mismatches:
            print(f"  Tool: {mismatch['tool_name']}")
            print(f"  Resource: {mismatch['resource']}")
            print(f"  Field: {mismatch['schema_field']}")
            print(f"  Error: {mismatch['error']}")
            print()
    else:
        print("✅ All schema fields exist in database tables")
        print()
    
    # Resources missing tables
    missing_tables = results["resources_missing_tables"]
    if missing_tables:
        print("⚠️  RESOURCES WITHOUT CORRESPONDING TABLES")
        print("-" * 80)
        for resource in missing_tables:
            print(f"  - {resource}")
        print()
    
    # Summary
    print("=" * 80)
    total_issues = (
        len(missing_tools) +
        len(missing_output) +
        len(jinja_errors) +
        len(schema_mismatches)
    )
    
    if total_issues == 0:
        print("✅ AUDIT PASSED: No issues found!")
    else:
        print(f"⚠️  AUDIT FOUND {total_issues} ISSUE(S)")
        print(f"   - {len(missing_tools)} resources missing tools")
        print(f"   - {len(missing_output)} tools missing output schemas")
        print(f"   - {len(jinja_errors)} Jinja template errors")
        print(f"   - {len(schema_mismatches)} schema-table mismatches")
    print("=" * 80)


async def main() -> int:
    """Main entry point."""
    # Get database connection info from environment
    db_user = os.getenv("DB_USER", "myuser")
    db_password = os.getenv("DB_PASSWORD", "mypassword")
    db_name = os.getenv("DB_NAME", "mydb")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", "5432"))
    
    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    
    # Connect to database
    try:
        conn = await asyncpg.connect(db_url)
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        print(f"   URL: postgresql://{db_user}:***@{db_host}:{db_port}/{db_name}")
        return 1
    
    try:
        # Run audit
        results = await run_audit(conn)
        
        # Print report
        print_report(results)
        
        # Return exit code based on issues found
        total_issues = (
            len(results["resources_missing_tools"]) +
            len(results["tools_missing_output_schema"]) +
            len(results["jinja_validation_errors"]) +
            len(results["schema_table_mismatches"])
        )
        
        return 1 if total_issues > 0 else 0
        
    except Exception as e:
        print(f"❌ Error running audit: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        await conn.close()


if __name__ == "__main__":
    import asyncio
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
