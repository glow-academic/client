"""Generate Keycloak theme provider mapping from database.

Generates uploads/themes/glow/login/providers.ftl with client_id -> allowed IdP aliases mapping.
This enables dynamic IdP visibility filtering based on client_id (department context).
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
    """Generate comprehensive provider mapping covering ALL clientId and IdP combinations.
    
    Enumerates:
    - ALL clientIds: glow-client (platform) + glow-client-{dept_id} (all departments)
    - ALL IdP aliases: realm-level slugs + department-scoped auth_{slug}_{auth_id}
    - Complete mapping: clientId -> [allowed IdP aliases]
    
    Args:
        pool: Database connection pool
    """
    mapping: dict[str, list[str]] = {}
    all_client_ids: list[str] = []
    all_idp_aliases: set[str] = set()
    
    async with pool.acquire() as conn:
        # Step 1: Get ALL realm-level IdP aliases (for platform client)
        realm_level_sql = load_sql("app/sql/v4/keycloak/get_auths_for_realm_level_complete.sql")
        is_function, function_name, schema = _detect_function_in_sql(realm_level_sql)
        
        realm_level_aliases: list[str] = []
        if is_function and function_name:
            function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"()'
            realm_level_providers = await conn.fetch(function_call_sql)
            realm_level_aliases = [str(p["slug"]) for p in realm_level_providers]
            all_idp_aliases.update(realm_level_aliases)
        
        # Platform client gets realm-level IdPs only
        platform_client_id = os.getenv("AUTH_KEYCLOAK_ID", "glow-client")
        mapping[platform_client_id] = realm_level_aliases.copy()
        all_client_ids.append(platform_client_id)
        
        # Step 2: Get ALL departments
        dept_sql = load_sql("app/sql/v4/keycloak/get_departments_for_org_sync_complete.sql")
        is_function, function_name, schema = _detect_function_in_sql(dept_sql)
        
        if is_function and function_name:
            function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"()'
            departments = await conn.fetch(function_call_sql)
            
            # Step 3: For each department, get its clientId and allowed IdPs
            for dept_row in departments:
                dept = dict(dept_row)
                dept_id = str(dept["department_id"])
                client_id = f"glow-client-{dept_id}"
                all_client_ids.append(client_id)
                
                # Get auths for this department
                auths_sql = load_sql("app/sql/v4/keycloak/get_auths_for_org_complete.sql")
                auths_is_function, auths_function_name, auths_schema = _detect_function_in_sql(auths_sql)
                
                if auths_is_function and auths_function_name:
                    import uuid
                    auths_function_call_sql = f'SELECT * FROM "{auths_schema}"."{auths_function_name}"($1)'
                    org_providers = await conn.fetch(auths_function_call_sql, uuid.UUID(dept_id))
                    
                    # Build department-scoped IdP aliases (auth_{slug}_{auth_id})
                    dept_aliases = [f"auth_{p['slug']}_{p['id']}" for p in org_providers]
                    all_idp_aliases.update(dept_aliases)
                    
                    # Department client gets: realm-level + department-scoped IdPs
                    mapping[client_id] = realm_level_aliases + dept_aliases
                else:
                    # No department-specific auths, just realm-level
                    mapping[client_id] = realm_level_aliases.copy()
    
    # Step 4: Generate FreeMarker file with complete mapping
    # Use UPLOAD_FOLDER constant for consistent routing (works in Docker and local dev)
    out_path = UPLOAD_FOLDER / "themes/glow/login/providers.ftl"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    lines: list[str] = []
    lines.append("<#-- GENERATED FILE: do not edit manually -->")
    lines.append(f"<#-- Generated at: {datetime.now().isoformat()} -->")
    lines.append("<#--")
    lines.append("  Provider mapping: clientId -> allowed IdP aliases")
    lines.append("")
    lines.append("  Enumerated clientIds:")
    for cid in sorted(all_client_ids):
        lines.append(f"    - {cid}")
    lines.append("")
    lines.append("  Enumerated IdP aliases:")
    for alias in sorted(all_idp_aliases):
        lines.append(f"    - {alias}")
    lines.append("-->")
    lines.append("")
    lines.append("<#assign allowedProvidersByClient = {")
    for i, (client_id, aliases) in enumerate(sorted(mapping.items())):
        alias_list = ", ".join([f'"{a}"' for a in aliases])
        comma = "," if i < len(mapping) - 1 else ""
        lines.append(f'  "{client_id}": [{alias_list}]{comma}')
    lines.append("}>")
    lines.append("")
    lines.append("<#-- Fallback function: unknown clientIds get platform IdPs only (strict mode) -->")
    lines.append("<#function getAllowedProviders clientId>")
    lines.append('  <#if allowedProvidersByClient[clientId]??>')
    lines.append('    <#return allowedProvidersByClient[clientId]>')
    lines.append('  <#else>')
    lines.append('    <#-- Unknown clientId: return platform IdPs only (strict mode) -->')
    lines.append(f'    <#return allowedProvidersByClient["{platform_client_id}"]![]>')
    lines.append('  </#if>')
    lines.append("</#function>")
    
    out_path.write_text("\n".join(lines), encoding="utf-8")
    logger.info(f"✅ Generated theme provider mapping: {out_path.resolve()}")
    logger.info(f"   - {len(all_client_ids)} clientIds enumerated")
    logger.info(f"   - {len(all_idp_aliases)} IdP aliases enumerated")
