"""Generate Keycloak theme provider mapping from database.

Generates uploads/themes/glow/login/providers.ftl with department_id -> allowed IdP aliases mapping.
This enables dynamic IdP visibility filtering based on department selection via URL parameter.
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Any

from app.main import UPLOAD_FOLDER
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import _detect_function_in_sql, load_sql

logger = get_logger(__name__)


async def generate_keycloak_theme_providers(pool: Any) -> None:
    """Generate comprehensive provider mapping covering ALL department and IdP combinations.
    
    Enumerates:
    - ALL departments: Active departments with IDs and titles
    - ALL IdP aliases: realm-level slugs + department-scoped auth_{slug}_{auth_id}
    - Complete mapping: department_id -> [allowed IdP aliases]
    - Platform fallback: Realm-level IdPs for when no department is selected
    
    Args:
        pool: Database connection pool
    """
    departments_list: list[dict[str, str]] = []
    allowed_providers_by_dept: dict[str, list[str]] = {}
    platform_providers: list[str] = []
    all_idp_aliases: set[str] = set()
    default_idp_aliases: set[str] = set()  # Track default-idp aliases separately
    profile_aliases_by_dept: dict[str, list[str]] = {}
    platform_profile_aliases: list[str] = []
    
    async with pool.acquire() as conn:
        # Step 1: Get ALL realm-level IdP aliases (for platform fallback)
        realm_level_sql = load_sql("app/sql/v4/queries/keycloak/get_auths_for_realm_level_complete.sql")
        is_function, function_name, schema = _detect_function_in_sql(realm_level_sql)
        
        if is_function and function_name:
            function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"()'
            realm_level_providers = await conn.fetch(function_call_sql)
            platform_providers = [str(p["slug"]) for p in realm_level_providers]
            all_idp_aliases.update(platform_providers)
        
        # Step 2: Get all default-idp profile aliases (per settings)
        profiles_sql = load_sql("app/sql/v4/queries/keycloak/get_setting_profiles_for_idp_complete.sql")
        profiles_is_function, profiles_function_name, profiles_schema = _detect_function_in_sql(profiles_sql)
        if profiles_is_function and profiles_function_name:
            profiles_call_sql = f'SELECT * FROM "{profiles_schema}"."{profiles_function_name}"()'
            profile_rows = await conn.fetch(profiles_call_sql)
            
            for profile_row in profile_rows:
                profile = dict(profile_row)
                profile_id = str(profile["profile_id"])
                department_id = profile.get("department_id")
                alias = f"default-idp-profile-{profile_id}"
                
                default_idp_aliases.add(alias)
                all_idp_aliases.add(alias)
                
                if department_id:
                    dept_key = str(department_id)
                    dept_aliases = profile_aliases_by_dept.setdefault(dept_key, [])
                    if alias not in dept_aliases:
                        dept_aliases.append(alias)
                else:
                    if alias not in platform_profile_aliases:
                        platform_profile_aliases.append(alias)
        
        # Step 3: Get ALL departments with titles
        dept_sql = load_sql("app/sql/v4/queries/keycloak/get_departments_for_org_sync_complete.sql")
        is_function, function_name, schema = _detect_function_in_sql(dept_sql)
        
        has_departments = False
        if is_function and function_name:
            function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"()'
            departments = await conn.fetch(function_call_sql)
            has_departments = len(departments) > 0
            
            # Step 4: For each department, get its allowed IdPs and profile-default IdPs
            for dept_row in departments:
                dept = dict(dept_row)
                dept_id = str(dept["department_id"])
                dept_name = dept.get("department_name") or dept_id
                
                # Store department info for picker
                departments_list.append({
                    "id": dept_id,
                    "title": dept_name,
                })
                
                # Get auths for this department
                auths_sql = load_sql("app/sql/v4/queries/keycloak/get_auths_for_org_complete.sql")
                auths_is_function, auths_function_name, auths_schema = _detect_function_in_sql(auths_sql)
                
                dept_aliases: list[str] = []
                dept_aliases_set: set[str] = set()
                if auths_is_function and auths_function_name:
                    import uuid
                    auths_function_call_sql = f'SELECT * FROM "{auths_schema}"."{auths_function_name}"($1)'
                    org_providers = await conn.fetch(auths_function_call_sql, uuid.UUID(dept_id))
                    
                    # Build department-scoped IdP aliases (auth_{slug}_{auth_id})
                    for provider in org_providers:
                        alias = f"auth_{provider['slug']}_{provider['id']}"
                        if alias not in dept_aliases_set:
                            dept_aliases.append(alias)
                            dept_aliases_set.add(alias)
                    all_idp_aliases.update(dept_aliases)
                
                # Add default-idp profile aliases for this department
                for alias in profile_aliases_by_dept.get(dept_id, []):
                    if alias not in dept_aliases_set:
                        dept_aliases.append(alias)
                        dept_aliases_set.add(alias)
                
                allowed_providers_by_dept[dept_id] = dept_aliases
        
        # Step 5: Add platform-level default-idp profile aliases ONLY if there are no departments
        # If departments exist, we don't use platform-level instances
        if not has_departments:
            for alias in platform_profile_aliases:
                if alias not in platform_providers:
                    platform_providers.append(alias)
    
    # Step 4: Generate FreeMarker file with department-based mapping
    # Use UPLOAD_FOLDER constant for consistent routing (works in Docker and local dev)
    out_path = UPLOAD_FOLDER / "themes/glow/login/providers.ftl"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    lines: list[str] = []
    lines.append("<#-- GENERATED FILE: do not edit manually -->")
    lines.append(f"<#-- Generated at: {datetime.now().isoformat()} -->")
    lines.append("<#--")
    lines.append("  Provider mapping: department_id -> allowed IdP aliases")
    lines.append("")
    lines.append("  Enumerated departments:")
    for dept in sorted(departments_list, key=lambda d: d["title"]):
        lines.append(f"    - {dept['id']}: {dept['title']}")
    lines.append("")
    lines.append("  Enumerated IdP aliases:")
    for alias in sorted(all_idp_aliases):
        lines.append(f"    - {alias}")
    lines.append("")
    lines.append("  Default-IdP aliases:")
    for alias in sorted(default_idp_aliases):
        lines.append(f"    - {alias}")
    lines.append("-->")
    lines.append("")
    
    # Generate departments array
    lines.append("<#-- Departments to show in the picker -->")
    lines.append("<#assign departments = [")
    for i, dept in enumerate(sorted(departments_list, key=lambda d: d["title"])):
        comma = "," if i < len(departments_list) - 1 else ""
        lines.append(f'  {{"id": "{dept["id"]}", "title": "{dept["title"]}"}}{comma}')
    lines.append("] />")
    lines.append("")
    
    # Generate department -> IdP mapping
    lines.append("<#-- Map department_id -> allowed IdP aliases -->")
    lines.append("<#assign allowedProvidersByDept = {")
    for i, (dept_id, aliases) in enumerate(sorted(allowed_providers_by_dept.items())):
        alias_list = ", ".join([f'"{a}"' for a in aliases])
        comma = "," if i < len(allowed_providers_by_dept) - 1 else ""
        lines.append(f'  "{dept_id}": [{alias_list}]{comma}')
    lines.append("} />")
    lines.append("")
    
    # Generate platform providers (only used when no departments exist)
    lines.append("<#-- Platform providers (only used when no departments exist) -->")
    platform_list = ", ".join([f'"{p}"' for p in platform_providers])
    lines.append(f'<#assign platformProviders = [{platform_list}] />')
    lines.append("")
    
    # Generate function
    # Strategy: If departments exist, always use department-specific providers (default to first if none selected)
    # If no departments exist, use platform providers
    lines.append("<#function getAllowedProvidersForDepartment deptId>")
    lines.append('  <#-- If departments exist, always use department-specific providers -->')
    lines.append('  <#if departments?size gt 0>')
    lines.append('    <#-- Default to first department if no department selected -->')
    lines.append('    <#assign effectiveDeptId = deptId!"" />')
    lines.append('    <#if !effectiveDeptId?has_content>')
    lines.append('      <#assign effectiveDeptId = departments[0].id />')
    lines.append('    </#if>')
    lines.append('    <#if effectiveDeptId?has_content && allowedProvidersByDept[effectiveDeptId]??>')
    lines.append('      <#assign deptProviders = allowedProvidersByDept[effectiveDeptId] />')
    lines.append('      <#if deptProviders?size gt 0>')
    lines.append('        <#return deptProviders>')
    lines.append('      </#if>')
    lines.append('    </#if>')
    lines.append('    <#-- Fallback: return empty list if department has no providers -->')
    lines.append('    <#return []>')
    lines.append('  <#else>')
    lines.append('    <#-- No departments exist: use platform providers -->')
    lines.append('    <#return platformProviders>')
    lines.append('  </#if>')
    lines.append("</#function>")
    
    out_path.write_text("\n".join(lines), encoding="utf-8")
    logger.info(f"✅ Generated theme provider mapping: {out_path.resolve()}")
    logger.info(f"   - {len(departments_list)} departments enumerated")
    logger.info(f"   - {len(all_idp_aliases)} IdP aliases enumerated")
