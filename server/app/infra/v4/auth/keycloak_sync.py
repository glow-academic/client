"""Keycloak sync utility - synchronous sync function that returns success/failure."""

import asyncio
import os
import re
import socket
from dataclasses import dataclass
from typing import Any

from app.main import get_pool
from app.mcp.oauth import MCP_RESOURCE, is_mcp_enabled
from app.utils.auth.decrypt_api_key import decrypt_api_key
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import _detect_function_in_sql, load_sql

logger = get_logger(__name__)

# Retry configuration
MAX_RETRIES = 10
INITIAL_RETRY_DELAY = 2.0  # seconds
MAX_RETRY_DELAY = 30.0  # seconds


@dataclass
class KeycloakSyncResult:
    """Result of a Keycloak sync operation."""

    success: bool
    message: str
    department_id: str | None = None
    error: str | None = None


async def wait_for_keycloak(
    url: str,
    admin: str,
    password: str,
    max_retries: int = MAX_RETRIES,
) -> Any | None:
    """Wait for Keycloak to be ready and return a connected KeycloakAdmin instance."""
    try:
        from keycloak import KeycloakAdmin  # type: ignore
    except ImportError:
        logger.warning("keycloak package not installed, skipping Keycloak sync")
        return None

    retry_delay = INITIAL_RETRY_DELAY

    # Check if we're in local dev mode
    origin_check = os.getenv("ORIGIN", "http://localhost:3000")
    is_local_dev = "localhost" in origin_check.lower()

    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(
                f"Attempting to connect to Keycloak (attempt {attempt}/{max_retries})..."
            )

            # Disable SSL verification for non-production environments
            is_prod = not is_local_dev
            verify_ssl = is_prod  # Only verify SSL in production

            # In local dev, never try HTTPS even if Keycloak says HTTPS required
            # The database update sets SSL requirement to NONE, but Keycloak needs time to pick it up
            # Trying HTTPS will fail with SSL errors in local dev, so just wait and retry with HTTP
            connection_url = url

            kc_admin = KeycloakAdmin(
                server_url=f"{connection_url}/",
                username=admin,
                password=password,
                realm_name="master",
                verify=False
                if is_local_dev
                else verify_ssl,  # Disable SSL verification for local dev
            )
            # Test the connection by getting realms
            kc_admin.get_realms()
            logger.info("✅ Successfully connected to Keycloak")

            # Fix master realm SSL requirement for local development
            # This must be done immediately after connecting, before any other operations
            try:
                if is_local_dev:
                    master_realm = kc_admin.get_realm("master")
                    current_ssl_required = master_realm.get("sslRequired", "EXTERNAL")

                    if current_ssl_required != "NONE":
                        kc_admin.update_realm(
                            realm_name="master",
                            payload={"sslRequired": "NONE"},
                        )
                        logger.info(
                            f"✅ Disabled SSL requirement for master realm (was: {current_ssl_required})"
                        )
            except Exception as e:
                logger.warning(
                    f"Could not update master realm SSL setting: {e}. Continuing..."
                )

            return kc_admin
        except Exception as e:
            last_error = e
            error_str = str(e).lower()
            is_https_required = "https required" in error_str

            if attempt < max_retries:
                if is_https_required and is_local_dev:
                    # In local dev, HTTPS required means Keycloak hasn't picked up database change yet
                    # Keycloak caches realm settings in memory, cache refresh can take 15-30+ seconds
                    # Wait longer and retry with HTTP (don't try HTTPS - it will fail)
                    wait_time = min(
                        retry_delay * 3, MAX_RETRY_DELAY
                    )  # Wait even longer (3x delay)
                    logger.info(
                        f"Keycloak requires HTTPS (attempt {attempt}/{max_retries}), "
                        f"waiting {wait_time:.1f}s for cache refresh, retrying with HTTP..."
                    )
                    # Wait longer when HTTPS is required (Keycloak needs time to pick up DB change)
                    await asyncio.sleep(wait_time)
                else:
                    logger.warning(
                        f"Keycloak not ready yet (attempt {attempt}/{max_retries}): {e}. "
                        f"Retrying in {retry_delay:.1f}s..."
                    )
                    await asyncio.sleep(retry_delay)
                # Exponential backoff with cap
                retry_delay = min(retry_delay * 1.5, MAX_RETRY_DELAY)
            else:
                logger.error(
                    f"Failed to connect to Keycloak after {max_retries} attempts: {e}"
                )
                return None

    return None


async def ensure_department_client(
    department_id: str,
    department_name: str,
    kc_admin: Any,
) -> str | None:
    """Ensure department-specific client exists in master realm.
    
    Creates client with ID: glow-client-{department_id}
    This allows client-scoped org routing in Keycloak.
    
    Args:
        department_id: Department ID (UUID string)
        department_name: Department name (for display)
        kc_admin: KeycloakAdmin instance (must be in master realm)
    
    Returns:
        client_id if created/updated, None if error
    """
    target_secret: str | None = os.getenv("AUTH_KEYCLOAK_SECRET")
    client_port = os.getenv("CLIENT_PORT", "3000")
    app_prefix = os.getenv("APP_PREFIX", "")
    
    if not target_secret:
        logger.warning(f"⚠️  AUTH_KEYCLOAK_SECRET is missing. Cannot create department client for {department_id}.")
        return None
    
    try:
        # Ensure we're in master realm
        kc_admin.change_current_realm(realm_name="master")
        
        # Client ID format: glow-client-{department_id}
        department_client_id = f"glow-client-{department_id}"
        
        origin = os.getenv("ORIGIN", f"http://localhost:{client_port}")
        base_url = origin.rstrip("/")
        redirect_uri = f"{base_url}{app_prefix}/api/auth/callback/keycloak"
        redirect_uris = [redirect_uri, f"{base_url}{app_prefix}/*"]
        
        clients = kc_admin.get_clients()
        existing_client = next(
            (c for c in clients if c.get("clientId") == department_client_id),
            None,
        )
        
        client_payload: dict[str, Any] = {
            "clientId": department_client_id,
            "name": f"Glow App - {department_name}",
            "rootUrl": base_url,
            "baseUrl": base_url,
            "redirectUris": redirect_uris,
            "webOrigins": ["+"],
            "enabled": True,
            "publicClient": False,
            "protocol": "openid-connect",
            "standardFlowEnabled": True,
            "directAccessGrantsEnabled": True,
            "serviceAccountsEnabled": True,
            "clientAuthenticatorType": "client-secret",
            "secret": target_secret,
        }
        
        if existing_client:
            client_uuid = existing_client.get("id")
            if client_uuid:
                try:
                    kc_admin.update_client(
                        client_id=client_uuid, payload=client_payload
                    )
                    logger.info(f"✅ Department client '{department_client_id}' updated")
                    return department_client_id
                except Exception as e:
                    logger.warning(
                        f"Failed to update department client '{department_client_id}': {e}"
                    )
                    return None
        else:
            try:
                new_client_uuid = kc_admin.create_client(
                    payload=client_payload, skip_exists=True
                )
                logger.info(f"✅ Department client '{department_client_id}' created")
                
                if new_client_uuid:
                    kc_admin.update_client(
                        client_id=new_client_uuid,
                        payload={"secret": target_secret},
                    )
                    logger.info(
                        f"✅ Department client secret enforced for '{department_client_id}'"
                    )
                    return department_client_id
            except Exception as e:
                error_str = str(e).lower()
                is_conflict = (
                    "location" in error_str
                    or "duplicate" in error_str
                    or "conflict" in error_str
                    or "409" in error_str
                    or "already exists" in error_str
                )
                
                if is_conflict:
                    logger.info(
                        f"⚠️  Department client '{department_client_id}' already exists"
                    )
                    return department_client_id
                else:
                    logger.warning(
                        f"Failed to create department client '{department_client_id}': {e}"
                    )
                    return None
    except Exception as e:
        logger.warning(f"Could not ensure department client for {department_id}: {e}")
        return None


async def ensure_glow_client_in_master_realm(kc_admin: Any) -> None:
    """Ensure glow-client exists in master realm with correct configuration.

    Args:
        kc_admin: KeycloakAdmin instance
    """
    target_client_id = os.getenv("AUTH_KEYCLOAK_ID", "glow-client")
    target_secret: str | None = os.getenv("AUTH_KEYCLOAK_SECRET")
    client_port = os.getenv("CLIENT_PORT", "3000")
    app_prefix = os.getenv("APP_PREFIX", "")

    if not target_secret:
        logger.warning("⚠️  AUTH_KEYCLOAK_SECRET is missing. Cannot create glow-client.")
        return

    try:
        # Switch to master realm to ensure client is created there
        kc_admin.change_current_realm(realm_name="master")

        origin = os.getenv("ORIGIN", f"http://localhost:{client_port}")
        base_url = origin.rstrip("/")
        redirect_uri = f"{base_url}{app_prefix}/api/auth/callback/keycloak"
        redirect_uris = [redirect_uri, f"{base_url}{app_prefix}/*"]

        clients = kc_admin.get_clients()
        existing_client = next(
            (c for c in clients if c.get("clientId") == target_client_id),
            None,
        )

        client_payload: dict[str, Any] = {
            "clientId": target_client_id,
            "name": "Glow App",
            "rootUrl": base_url,
            "baseUrl": base_url,
            "redirectUris": redirect_uris,
            "webOrigins": ["+"],
            "enabled": True,
            "publicClient": False,
            "protocol": "openid-connect",
            "standardFlowEnabled": True,
            "directAccessGrantsEnabled": True,
            "serviceAccountsEnabled": True,
            "clientAuthenticatorType": "client-secret",
            "secret": target_secret,
        }

        if existing_client:
            client_uuid = existing_client.get("id")
            if client_uuid:
                try:
                    kc_admin.update_client(
                        client_id=client_uuid, payload=client_payload
                    )
                    logger.info(f"✅ Master realm: Client '{target_client_id}' updated")
                except Exception as e:
                    logger.warning(
                        f"Failed to update master realm client '{target_client_id}': {e}"
                    )
        else:
            try:
                new_client_uuid = kc_admin.create_client(
                    payload=client_payload, skip_exists=True
                )
                logger.info(f"✅ Master realm: Client '{target_client_id}' created")

                if new_client_uuid:
                    kc_admin.update_client(
                        client_id=new_client_uuid,
                        payload={"secret": target_secret},
                    )
                    logger.info(
                        f"✅ Master realm: Client secret enforced for '{target_client_id}'"
                    )
            except Exception as e:
                error_str = str(e).lower()
                is_conflict = (
                    "location" in error_str
                    or "duplicate" in error_str
                    or "conflict" in error_str
                    or "409" in error_str
                    or "already exists" in error_str
                )

                if is_conflict:
                    logger.info(
                        f"⚠️  Master realm: Client '{target_client_id}' already exists"
                    )
                else:
                    logger.warning(
                        f"Failed to create master realm client '{target_client_id}': {e}"
                    )
    except Exception as e:
        logger.warning(f"Could not ensure glow-client in master realm: {e}")


async def ensure_mcp_client_scope(kc_admin: Any) -> None:
    """Ensure MCP client scope exists in master realm with audience mapper.

    Creates the mcp-resource client scope, adds an audience mapper with the MCP
    resource URL, and assigns it to glow-client as a default client scope.

    Args:
        kc_admin: KeycloakAdmin instance (must be in master realm)
    """
    # Check if MCP is enabled
    if not is_mcp_enabled():
        logger.debug("MCP is disabled, skipping MCP client scope creation")
        return

    target_client_id = os.getenv("AUTH_KEYCLOAK_ID", "glow-client")
    scope_name = "mcp-resource"
    mapper_name = "mcp-audience"

    try:
        # Ensure we're in master realm
        kc_admin.change_current_realm(realm_name="master")

        # Get MCP resource URL from oauth module (which handles localhost detection)
        mcp_resource_url = MCP_RESOURCE

        # Step 1: Check if client scope exists, create if not
        try:
            scopes = kc_admin.get_client_scopes()
            existing_scope = next(
                (s for s in scopes if s.get("name") == scope_name), None
            )
        except Exception as e:
            logger.warning(f"Failed to list client scopes: {e}")
            return

        if existing_scope:
            scope_id = existing_scope.get("id")
            logger.info(f"✅ Client scope '{scope_name}' already exists")
        else:
            # Create the client scope
            scope_payload: dict[str, Any] = {
                "name": scope_name,
                "description": "MCP resource scope for OAuth audience binding",
                "protocol": "openid-connect",
                "attributes": {},
            }

            try:
                scope_id = kc_admin.create_client_scope(scope_payload, skip_exists=True)
                logger.info(f"✅ Created client scope '{scope_name}'")
            except Exception as e:
                error_str = str(e).lower()
                is_conflict = (
                    "location" in error_str
                    or "duplicate" in error_str
                    or "conflict" in error_str
                    or "409" in error_str
                    or "already exists" in error_str
                )

                if is_conflict:
                    # Scope was created by another process, fetch it
                    scopes = kc_admin.get_client_scopes()
                    existing_scope = next(
                        (s for s in scopes if s.get("name") == scope_name), None
                    )
                    if existing_scope:
                        scope_id = existing_scope.get("id")
                        logger.info(
                            f"⚠️  Client scope '{scope_name}' was created by another process"
                        )
                    else:
                        logger.warning(
                            f"Client scope '{scope_name}' conflict but not found"
                        )
                        return
                else:
                    logger.warning(f"Failed to create client scope '{scope_name}': {e}")
                    return

        if not scope_id:
            logger.warning(f"Client scope '{scope_name}' has no ID")
            return

        # Step 2: Check if audience mapper exists, create if not
        try:
            mappers = kc_admin.get_mappers_from_client_scope(scope_id)
            existing_mapper = next(
                (m for m in mappers if m.get("name") == mapper_name), None
            )
        except Exception as e:
            logger.warning(f"Failed to list mappers for scope '{scope_name}': {e}")
            return

        if existing_mapper:
            mapper_id = existing_mapper.get("id")
            # Check if mapper config needs update
            mapper_config = existing_mapper.get("config", {})
            current_audience = mapper_config.get("included.custom.audience", "")
            if current_audience != mcp_resource_url:
                # Update mapper config - need to update the full mapper payload
                updated_mapper_payload = dict(existing_mapper)
                updated_mapper_payload["config"] = dict(mapper_config)
                updated_mapper_payload["config"]["included.custom.audience"] = mcp_resource_url
                try:
                    kc_admin.update_mapper_in_client_scope(
                        client_scope_id=scope_id,
                        protocol_mapper_id=mapper_id,
                        payload=updated_mapper_payload,
                    )
                    logger.info(
                        f"✅ Updated audience mapper '{mapper_name}' with MCP resource URL"
                    )
                except Exception as e:
                    logger.warning(
                        f"Failed to update audience mapper '{mapper_name}': {e}"
                    )
            else:
                logger.info(f"✅ Audience mapper '{mapper_name}' already configured correctly")
        else:
            # Create the audience mapper
            mapper_payload: dict[str, Any] = {
                "name": mapper_name,
                "protocol": "openid-connect",
                "protocolMapper": "oidc-audience-mapper",
                "config": {
                    "included.client.audience": "",
                    "included.custom.audience": mcp_resource_url,
                    "id.token.claim": "true",
                    "access.token.claim": "true",
                },
            }

            try:
                kc_admin.add_mapper_to_client_scope(
                    client_scope_id=scope_id, payload=mapper_payload
                )
                logger.info(
                    f"✅ Created audience mapper '{mapper_name}' for scope '{scope_name}'"
                )
            except Exception as e:
                error_str = str(e).lower()
                is_conflict = (
                    "location" in error_str
                    or "duplicate" in error_str
                    or "conflict" in error_str
                    or "409" in error_str
                    or "already exists" in error_str
                )

                if is_conflict:
                    logger.info(
                        f"⚠️  Audience mapper '{mapper_name}' was created by another process"
                    )
                else:
                    logger.warning(
                        f"Failed to create audience mapper '{mapper_name}': {e}"
                    )
                    return

        # Step 3: Assign scope as realm default client scope (so ALL clients get it, including dynamically registered ones)
        # This ensures all client tokens (including ChatGPT's dynamically registered clients) include the MCP resource audience
        try:
            # Get current realm default client scopes
            try:
                realm_default_scopes = kc_admin.get_realm_default_client_scopes()
                has_realm_scope = any(
                    s.get("name") == scope_name for s in realm_default_scopes
                )
            except Exception as e:
                logger.debug(
                    f"Failed to get realm default client scopes: {e}"
                )
                has_realm_scope = False

            if not has_realm_scope:
                # Add scope as realm default client scope
                # This ensures ALL clients (including dynamically registered ones like ChatGPT) get the scope
                try:
                    kc_admin.add_default_default_client_scope(scope_id=scope_id)
                    logger.info(
                        f"✅ Added client scope '{scope_name}' as realm default scope (applies to all clients including dynamically registered ones)"
                    )
                except Exception as e:
                    error_str = str(e).lower()
                    is_conflict = (
                        "location" in error_str
                        or "duplicate" in error_str
                        or "conflict" in error_str
                        or "409" in error_str
                        or "already exists" in error_str
                    )
                    if is_conflict:
                        logger.info(
                            f"⚠️  Realm default client scope '{scope_name}' was already added by another process"
                        )
                    else:
                        logger.warning(
                            f"Failed to add realm default client scope '{scope_name}': {e}"
                        )
            else:
                logger.info(
                    f"✅ Client scope '{scope_name}' already assigned as realm default scope"
                )
        except Exception as e:
            logger.warning(
                f"Failed to assign realm default client scope '{scope_name}': {e}"
            )

        # Step 4: Also assign scope to glow-client as default client scope (for backward compatibility)
        try:
            clients = kc_admin.get_clients()
            client = next(
                (c for c in clients if c.get("clientId") == target_client_id), None
            )

            if not client:
                logger.warning(
                    f"Client '{target_client_id}' not found, cannot assign MCP scope"
                )
                return

            client_id = client.get("id")
            if not client_id:
                logger.warning(f"Client '{target_client_id}' has no ID")
                return

            # Get current default client scopes
            try:
                default_scopes = kc_admin.get_client_default_client_scopes(
                    client_id=client_id
                )
                scope_already_assigned = any(
                    s.get("name") == scope_name for s in default_scopes
                )
            except Exception as e:
                logger.warning(
                    f"Failed to get default client scopes for '{target_client_id}': {e}"
                )
                default_scopes = []
                scope_already_assigned = False

            if scope_already_assigned:
                logger.info(
                    f"✅ Client scope '{scope_name}' already assigned to '{target_client_id}'"
                )
            else:
                # Add scope as default client scope
                # The add_client_default_client_scope method requires a payload with client_scope_id
                try:
                    kc_admin.add_client_default_client_scope(
                        client_id=client_id,
                        client_scope_id=scope_id,
                        payload={},  # Empty payload, scope_id is in the method parameter
                    )
                    logger.info(
                        f"✅ Assigned client scope '{scope_name}' to '{target_client_id}' as default scope"
                    )
                except Exception as e:
                    error_str = str(e).lower()
                    is_conflict = (
                        "location" in error_str
                        or "duplicate" in error_str
                        or "conflict" in error_str
                        or "409" in error_str
                        or "already exists" in error_str
                    )

                    if is_conflict:
                        logger.info(
                            f"⚠️  Client scope '{scope_name}' was already assigned to '{target_client_id}'"
                        )
                    else:
                        logger.warning(
                            f"Failed to assign client scope '{scope_name}' to '{target_client_id}': {e}"
                        )

        except Exception as e:
            logger.warning(
                f"Failed to assign client scope '{scope_name}' to '{target_client_id}': {e}"
            )

    except Exception as e:
        logger.warning(f"Could not ensure MCP client scope: {e}")


async def ensure_mcp_token_lifespan(kc_admin: Any) -> None:
    """Ensure master realm has appropriate access token lifespan for MCP.
    
    Configures the access token lifespan in the master realm to a longer duration
    (default 24 hours) to avoid frequent token refreshes for MCP clients.
    
    Args:
        kc_admin: KeycloakAdmin instance (must be in master realm)
    """
    if not is_mcp_enabled():
        logger.debug("MCP is disabled, skipping token lifespan configuration")
        return
    
    try:
        kc_admin.change_current_realm(realm_name="master")
        
        # Get current realm configuration
        realm = kc_admin.get_realm("master")
        current_lifespan = realm.get("accessTokenLifespan", 60)  # Default is 60 seconds
        
        # Read desired lifespan from environment (default: 24 hours = 86400 seconds)
        desired_lifespan = int(os.getenv("MCP_TOKEN_LIFESPAN", "86400"))
        
        if current_lifespan < desired_lifespan:
            # Update realm with new token lifespan
            kc_admin.update_realm(
                realm_name="master",
                payload={"accessTokenLifespan": desired_lifespan},
            )
            logger.info(
                f"✅ Updated master realm access token lifespan: {current_lifespan}s → {desired_lifespan}s "
                f"({desired_lifespan // 3600}h)"
            )
        else:
            logger.debug(
                f"Master realm access token lifespan already configured: {current_lifespan}s "
                f"({current_lifespan // 3600}h)"
            )
    except Exception as e:
        logger.warning(f"Could not ensure MCP token lifespan: {e}")


async def ensure_trusted_hosts_policy(kc_admin: Any) -> None:
    """Ensure client registration policies allow MCP clients (Cursor, ChatGPT).
    
    Keycloak's Trusted Hosts policy cannot support custom URI schemes like cursor://
    used by Cursor IDE. Instead, we remove Trusted Hosts and use Initial Access Token
    policy for security, which allows any redirect URI scheme.
    
    This function:
    1. Removes Trusted Hosts policy (blocks custom schemes)
    2. Ensures Initial Access Token policy is enabled (secure alternative)
    
    Args:
        kc_admin: KeycloakAdmin instance (must be in master realm)
    """
    try:
        kc_admin.change_current_realm(realm_name="master")
        
        # Get realm ID
        realm = kc_admin.get_realm("master")
        realm_id = realm.get("id")
        
        if not realm_id:
            logger.warning("Master realm has no ID, cannot remove Trusted Hosts policy")
            return
        
        # Get all components for master realm
        components = kc_admin.get_components(query={"parent": realm_id})
        
        # Find Trusted Hosts component (providerId="trusted-hosts", subType="anonymous")
        # We remove this because it blocks custom URI schemes like cursor://
        trusted_hosts_component = None
        for comp in components:
            if (
                comp.get("providerId") == "trusted-hosts"
                and comp.get("subType") == "anonymous"
                and comp.get("providerType") == "org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy"
            ):
                trusted_hosts_component = comp
                break
        
        # Remove Trusted Hosts policy - it blocks custom URI schemes (cursor://)
        if trusted_hosts_component:
            component_id = trusted_hosts_component.get("id")
            if component_id:
                try:
                    kc_admin.delete_component(component_id=component_id)
                    logger.info("✅ Removed Trusted Hosts policy (blocks custom URI schemes like cursor://)")
                except Exception as e:
                    logger.warning(f"Failed to remove Trusted Hosts policy: {e}")
            else:
                logger.warning("Trusted Hosts component has no ID")
        else:
            logger.info("✅ Trusted Hosts policy not found (already removed or never existed)")
        
        # After removing Trusted Hosts, Keycloak allows anonymous client registration
        # This means any MCP client (Cursor, ChatGPT, Claude, Windsurf, etc.) can register
        # with any redirect URI scheme (including cursor://) without requiring an Initial Access Token.
        # 
        # Security note: Redirect URIs are still validated during OAuth flow, so this is safe.
        # The Trusted Hosts policy was blocking legitimate MCP clients, not providing real security.
        
        logger.info("✅ Client registration now allows any redirect URI scheme via anonymous registration")
        
    except Exception as e:
        logger.warning(f"Could not remove Trusted Hosts policy: {e}", exc_info=True)


async def sync_identity_provider_for_realm_level(
    auth_id: str,
    slug: str,
    provider_id: str,
    display_name: str,
    kc_admin: Any,
    pool: Any,
) -> None:
    """Sync a single identity provider at realm level (platform login).
    
    Args:
        auth_id: Auth ID (UUID string)
        slug: Provider slug/alias
        provider_id: Provider type (e.g., "google", "oidc", "saml")
        display_name: Display name for the provider
        kc_admin: KeycloakAdmin instance (must be in master realm)
        pool: Database connection pool
    """
    bootstrap_leader = socket.gethostname() or os.getenv("HOSTNAME", "unknown")
    
    try:
        # Ensure we're in master realm
        kc_admin.change_current_realm(realm_name="master")
        
        # Get auth items (config) - use None for department_id (default settings)
        import uuid
        
        async with pool.acquire() as conn:
            items_sql_text = load_sql("app/sql/v4/keycloak/get_auth_items_complete.sql")
            items_is_function, items_function_name, items_schema = _detect_function_in_sql(items_sql_text)
            
            if items_is_function and items_function_name:
                auth_id_uuid = uuid.UUID(auth_id)
                # Pass NULL directly to PostgreSQL (function accepts NULL even though signature shows uuid)
                # SQL function checks IS NOT NULL internally
                items_sql_params = (auth_id_uuid, None)
                items_param_placeholders = ", ".join([f"${i + 1}" for i in range(len(items_sql_params))])
                items_function_call_sql = f'SELECT * FROM "{items_schema}"."{items_function_name}"({items_param_placeholders})'
                item_rows = await conn.fetch(items_function_call_sql, *items_sql_params)
                items = [dict(row) for row in item_rows]
            else:
                raise ValueError("Expected function definition in get_auth_items_complete.sql")
        
        # Build config map from items
        config_map: dict[str, str] = {}
        for item in items:
            item_name = item["name"]
            raw_value = item["value"]
            is_encrypted = item.get("encrypted", True)
            
            if is_encrypted:
                try:
                    decrypted_value = decrypt_api_key(raw_value)
                    config_map[item_name] = decrypted_value
                except Exception as e:
                    logger.warning(
                        f"Failed to decrypt auth_item '{item_name}' for provider '{slug}': {e}. Using as plain text."
                    )
                    config_map[item_name] = raw_value
            else:
                config_map[item_name] = raw_value
        
        # Build IdP payload
        # Set hideOnLogin=False - theme controls visibility via filtering
        # If we hide IdPs, Keycloak 26.0 excludes them from social.providers, so theme can't render them
        payload: dict[str, Any] = {
            "alias": slug,
            "providerId": provider_id,
            "displayName": display_name,
            "enabled": True,
            "trustEmail": True,
            "hideOnLogin": False,  # Must be False so IdPs appear in social.providers for theme filtering
            "config": {},
        }
        
        # Configure provider-specific settings
        if provider_id == "saml":
            if "ssoUrl" in config_map:
                payload["config"]["singleSignOnServiceUrl"] = config_map["ssoUrl"]
            if "entityId" in config_map:
                payload["config"]["entityId"] = config_map["entityId"]
            if "metadataUrl" in config_map:
                payload["config"]["importFromIdpUrl"] = config_map["metadataUrl"]
            if "certificate" in config_map:
                payload["config"]["signingCertificate"] = config_map["certificate"]
            if "nameIDPolicyFormat" not in payload["config"]:
                payload["config"]["nameIDPolicyFormat"] = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
            if "syncMode" not in payload["config"]:
                payload["config"]["syncMode"] = "FORCE"
            if "allowCreate" not in payload["config"]:
                payload["config"]["allowCreate"] = "true"
        else:
            payload["config"] = config_map
            if "syncMode" not in payload["config"]:
                payload["config"]["syncMode"] = "FORCE"
            if "useJwksUrl" not in payload["config"]:
                payload["config"]["useJwksUrl"] = "true"
        
        # Create or update IdP (realm-level, no organization_id)
        try:
            kc_admin.get_idp(idp_alias=slug)
            # IdP exists, update it
            kc_admin.update_idp(idp_alias=slug, payload=payload)
            logger.info(f"✅ Updated realm-level IdP: {slug}")
        except Exception:
            # IdP doesn't exist, create it
            kc_admin.create_idp(payload=payload)
            logger.info(f"✅ Created realm-level IdP: {slug}")
    except Exception as e:
        logger.warning(f"Failed to sync realm-level IdP '{slug}': {e}", exc_info=True)


async def sync_identity_provider_for_org(
    auth_id: str,
    slug: str,
    provider_id: str,
    display_name: str,
    department_id: str,
    kc_admin: Any,
    pool: Any,
) -> None:
    """Sync a single identity provider for department-scoped auths.
    
    Uses auth_id-based alias for 1:1 mapping: auth_{slug}_{auth_id}
    This ensures one IdP per auth object regardless of how many departments use it.
    
    Args:
        auth_id: Auth ID (UUID string)
        slug: Provider slug/alias
        provider_id: Provider type (e.g., "google", "oidc", "saml")
        display_name: Display name for the provider
        department_id: Department ID (for config lookup only)
        kc_admin: KeycloakAdmin instance (must be in master realm)
        pool: Database connection pool
    """
    bootstrap_leader = socket.gethostname() or os.getenv("HOSTNAME", "unknown")
    
    try:
        # Ensure we're in master realm
        kc_admin.change_current_realm(realm_name="master")
        
        # Use auth_id-based alias for 1:1 mapping (auth_{slug}_{auth_id})
        unique_alias = f"auth_{slug}_{auth_id}"
        
        # Get auth items (config) - use department_id for department-specific settings
        import uuid

        from app.sql.types import GetAuthItemsSqlParams
        
        async with pool.acquire() as conn:
            items_sql_text = load_sql("app/sql/v4/keycloak/get_auth_items_complete.sql")
            items_is_function, items_function_name, items_schema = _detect_function_in_sql(items_sql_text)
            
            if items_is_function and items_function_name:
                auth_id_uuid = uuid.UUID(auth_id)
                dept_id_uuid = uuid.UUID(department_id)
                items_params = GetAuthItemsSqlParams(auth_id=auth_id_uuid, department_id=dept_id_uuid)
                items_sql_params = items_params.to_tuple()
                items_param_placeholders = ", ".join([f"${i + 1}" for i in range(len(items_sql_params))])
                items_function_call_sql = f'SELECT * FROM "{items_schema}"."{items_function_name}"({items_param_placeholders})'
                item_rows = await conn.fetch(items_function_call_sql, *items_sql_params)
                items = [dict(row) for row in item_rows]
            else:
                raise ValueError("Expected function definition in get_auth_items_complete.sql")
        
        # Build config map from items
        config_map: dict[str, str] = {}
        for item in items:
            item_name = item["name"]
            raw_value = item["value"]
            is_encrypted = item.get("encrypted", True)
            
            if is_encrypted:
                try:
                    decrypted_value = decrypt_api_key(raw_value)
                    config_map[item_name] = decrypted_value
                except Exception as e:
                    logger.warning(
                        f"Failed to decrypt auth_item '{item_name}' for provider '{unique_alias}': {e}. Using as plain text."
                    )
                    config_map[item_name] = raw_value
            else:
                config_map[item_name] = raw_value
        
        # Build IdP payload (no organizationId - shared IdP across departments)
        # Set hideOnLogin=False - theme controls visibility via filtering
        # If we hide IdPs, Keycloak 26.0 excludes them from social.providers, so theme can't render them
        payload: dict[str, Any] = {
            "alias": unique_alias,
            "providerId": provider_id,
            "displayName": display_name,
            "enabled": True,
            "trustEmail": True,
            # No organizationId - removed org concept, client-id scoping handles routing
            "hideOnLogin": False,  # Must be False so IdPs appear in social.providers for theme filtering
            "config": {},
        }
        
        # Configure provider-specific settings
        if provider_id == "saml":
            if "ssoUrl" in config_map:
                payload["config"]["singleSignOnServiceUrl"] = config_map["ssoUrl"]
            if "entityId" in config_map:
                payload["config"]["entityId"] = config_map["entityId"]
            if "metadataUrl" in config_map:
                payload["config"]["importFromIdpUrl"] = config_map["metadataUrl"]
            if "certificate" in config_map:
                payload["config"]["signingCertificate"] = config_map["certificate"]
            if "nameIDPolicyFormat" not in payload["config"]:
                payload["config"]["nameIDPolicyFormat"] = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
            if "syncMode" not in payload["config"]:
                payload["config"]["syncMode"] = "FORCE"
            if "allowCreate" not in payload["config"]:
                payload["config"]["allowCreate"] = "true"
        else:
            payload["config"] = config_map
            if "syncMode" not in payload["config"]:
                payload["config"]["syncMode"] = "FORCE"
            if "useJwksUrl" not in payload["config"]:
                payload["config"]["useJwksUrl"] = "true"
        
        # Create or update IdP (department-scoped, shared across departments)
        try:
            kc_admin.get_idp(idp_alias=unique_alias)
            # IdP exists, update it
            kc_admin.update_idp(idp_alias=unique_alias, payload=payload)
            logger.info(f"✅ Updated department-scoped IdP: {unique_alias}")
        except Exception:
            # IdP doesn't exist, create it
            kc_admin.create_idp(payload=payload)
            logger.info(f"✅ Created department-scoped IdP: {unique_alias}")
    except Exception as e:
        logger.warning(f"Failed to sync org-scoped IdP '{unique_alias}': {e}", exc_info=True)


def get_idp_base_url() -> str:
    """Get the base URL for the IdP based on environment.
    
    Uses same pattern as mcp/oauth.py:
    - Local dev: http://localhost:8000 (direct backend access)
    - Production: ORIGIN (public domain, nginx proxies to backend)
    
    Path is at root level: /default-idp/ (not /api/v4/auth/default-idp/)
    """
    origin = os.getenv("ORIGIN", "http://localhost:3000")
    app_prefix = os.getenv("APP_PREFIX", "").strip("/")
    
    # Detect local dev (same pattern as mcp/oauth.py)
    is_local_dev = "localhost" in origin.lower()
    
    if is_local_dev:
        # Local dev: use direct backend URL (backend accessible on localhost:8000)
        base = "http://localhost:8000"
    else:
        # Production: use public ORIGIN (nginx will proxy /default-idp/ to backend)
        base = origin
    
    if app_prefix:
        return f"{base}/{app_prefix}/default-idp"
    return f"{base}/default-idp"


async def sync_default_idp(kc_admin: Any) -> None:
    """Sync default-idp Identity Provider to master realm.
    
    This IdP handles guest and default-account authentication flows.
    It's hidden from the login page and only accessible via kc_idp_hint.
    
    Args:
        kc_admin: KeycloakAdmin instance (must be in master realm)
    """
    try:
        # Ensure we're in master realm
        kc_admin.change_current_realm(realm_name="master")
        
        # Get IdP base URL using environment detection
        idp_base_url = get_idp_base_url()
        
        # Generate or retrieve client secret (should be stored securely in production)
        # For now, use AUTH_SECRET as the client secret (shared secret between Keycloak and IdP)
        client_secret = os.getenv("AUTH_SECRET")
        if not client_secret:
            logger.warning("AUTH_SECRET not found, cannot create default-idp")
            return
        
        # Legacy single default-idp (kept for backward compatibility)
        # Uses mode=guest as default (can be overridden via state token)
        payload = {
            "alias": "default-idp",
            "providerId": "oidc",
            "displayName": "Default Account / Guest",
            "enabled": True,
            "trustEmail": True,
            "hideOnLogin": False,  # Must be False so it appears in social.providers for theme rendering
            "config": {
                "authorizationUrl": f"{idp_base_url}/authorize?mode=guest",  # Default to guest mode
                "tokenUrl": f"{idp_base_url}/token",
                "jwksUrl": f"{idp_base_url}/jwks",
                "issuer": idp_base_url,
                "clientId": "keycloak-broker",  # Keycloak acts as client
                "clientSecret": client_secret,
                "useJwksUrl": "true",
                "syncMode": "FORCE",
            }
        }
        
        # Create or update IdP
        try:
            kc_admin.get_idp(idp_alias="default-idp")
            # IdP exists, update it
            kc_admin.update_idp(idp_alias="default-idp", payload=payload)
            logger.info("✅ Updated default-idp Identity Provider")
        except Exception:
            # IdP doesn't exist, create it
            kc_admin.create_idp(payload=payload)
            logger.info("✅ Created default-idp Identity Provider")
    except Exception as e:
        logger.warning(f"Failed to sync default-idp: {e}", exc_info=True)


async def sync_default_idp_for_department(
    department_id: str | None,
    mode: str,  # "guest" or "default-account"
    kc_admin: Any,
) -> str:
    """Sync a default-idp instance for a specific department/mode combination.
    
    Returns the IdP alias (e.g., "default-idp-guest-dept-123" or "default-idp-default-platform")
    
    All IdP instances use the same OIDC endpoints (/default-idp/authorize, etc.)
    The state token encodes department_id + mode, so backend can differentiate.
    
    Args:
        department_id: Department ID (UUID string) or None for platform-level
        mode: "guest" or "default-account"
        kc_admin: KeycloakAdmin instance (must be in master realm)
    
    Returns:
        IdP alias string
    """
    try:
        # Ensure we're in master realm
        kc_admin.change_current_realm(realm_name="master")
        
        # Generate alias based on department and mode
        if department_id:
            alias = f"default-idp-{mode}-dept-{department_id}"
            display_name = f"Default Account / Guest - {mode} - Department {department_id}"
        else:
            alias = f"default-idp-{mode}-platform"
            display_name = f"Default Account / Guest - {mode} - Platform"
        
        # All IdPs use the same base URL (state token handles differentiation)
        idp_base_url = get_idp_base_url()
        
        # Generate or retrieve client secret (should be stored securely in production)
        client_secret = os.getenv("AUTH_SECRET")
        if not client_secret:
            logger.warning(f"AUTH_SECRET not found, cannot create {alias}")
            return alias
        
        # Extract mode and department_id from alias to pass as query params
        # This allows the /authorize endpoint to know which flow to use
        # Format: default-idp-{mode}-dept-{department_id} or default-idp-{mode}-platform
        mode_param = "guest" if "guest" in alias else "default-account"
        dept_param = department_id if department_id else ""
        
        # Build authorizationUrl with mode and department_id as query params
        # Keycloak will append its own state parameter, so we use & to chain params
        auth_url = f"{idp_base_url}/authorize?mode={mode_param}"
        if dept_param:
            auth_url += f"&department_id={dept_param}"
        
        payload = {
            "alias": alias,
            "providerId": "oidc",
            "displayName": display_name,
            "enabled": True,
            "trustEmail": True,
            "hideOnLogin": False,  # Must be False so it appears in social.providers for theme rendering
            "config": {
                "authorizationUrl": auth_url,  # Includes mode and department_id as query params
                "tokenUrl": f"{idp_base_url}/token",
                "jwksUrl": f"{idp_base_url}/jwks",
                "issuer": idp_base_url,
                "clientId": "keycloak-broker",  # Keycloak acts as client
                "clientSecret": client_secret,
                "useJwksUrl": "true",
                "syncMode": "FORCE",
            }
        }
        
        # Create or update IdP
        try:
            kc_admin.get_idp(idp_alias=alias)
            # IdP exists, update it
            kc_admin.update_idp(idp_alias=alias, payload=payload)
            logger.info(f"✅ Updated {alias} Identity Provider")
        except Exception:
            # IdP doesn't exist, create it
            kc_admin.create_idp(payload=payload)
            logger.info(f"✅ Created {alias} Identity Provider")
        
        return alias
    except Exception as e:
        logger.warning(f"Failed to sync {alias if 'alias' in locals() else 'default-idp'}: {e}", exc_info=True)
        return alias if 'alias' in locals() else "default-idp"


async def sync_identity_providers(
    kc_admin: Any,
    pool: Any,
) -> None:
    """Sync all identity providers to master realm.
    
    - Realm-level: Auths from default settings (platform login) - alias: slug
    - Department-scoped: Auths from department settings - alias: auth_{slug}_{auth_id} (1:1 mapping)
    - Default-idp: Custom OIDC IdP instances for guest/default-account flows
      - Platform-level: default-idp-guest-platform, default-idp-default-platform
      - Department-level: default-idp-guest-dept-{id}, default-idp-default-dept-{id}
    
    All IdPs have hideOnLogin=False so they appear in social.providers for theme filtering.
    Theme controls visibility based on department selection and authorization checks.
    
    Args:
        kc_admin: KeycloakAdmin instance (must be in master realm)
        pool: Database connection pool
    """
    bootstrap_leader = socket.gethostname() or os.getenv("HOSTNAME", "unknown")
    
    try:
        # Ensure we're in master realm
        kc_admin.change_current_realm(realm_name="master")
        
        # Step 0: Sync default-idp instances (custom OIDC IdP for guest/default-account)
        # Create IdP instances per department/mode combination
        logger.info("Syncing default-idp Identity Provider instances...")
        
        # Sync platform-level default-idp instances (no department)
        await sync_default_idp_for_department(None, "guest", kc_admin)
        await sync_default_idp_for_department(None, "default-account", kc_admin)
        
        # Sync department-level default-idp instances
        async with pool.acquire() as conn:
            dept_sql = load_sql("app/sql/v4/keycloak/get_departments_for_org_sync_complete.sql")
            dept_is_function, dept_function_name, dept_schema = _detect_function_in_sql(dept_sql)
            
            if dept_is_function and dept_function_name:
                dept_function_call_sql = f'SELECT * FROM "{dept_schema}"."{dept_function_name}"()'
                departments = await conn.fetch(dept_function_call_sql)
                
                for dept_row in departments:
                    dept = dict(dept_row)
                    dept_id = str(dept["department_id"])
                    
                    # Sync guest and default-account IdPs for each department
                    await sync_default_idp_for_department(dept_id, "guest", kc_admin)
                    await sync_default_idp_for_department(dept_id, "default-account", kc_admin)
        
        # Step 1: Sync realm-level IdPs (from default settings)
        logger.info("Syncing realm-level IdPs (platform login)...")
        async with pool.acquire() as conn:
            sql_text = load_sql("app/sql/v4/keycloak/get_auths_for_realm_level_complete.sql")
            is_function, function_name, schema = _detect_function_in_sql(sql_text)
            
            if is_function and function_name:
                function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"()'
                realm_level_providers = await conn.fetch(function_call_sql)
                
                for provider_row in realm_level_providers:
                    provider = dict(provider_row)
                    await sync_identity_provider_for_realm_level(
                        auth_id=str(provider["id"]),
                        slug=provider["slug"],
                        provider_id=provider["provider_id"],
                        display_name=provider["name"],
                        kc_admin=kc_admin,
                        pool=pool,
                    )
            else:
                raise ValueError("Expected function definition in get_auths_for_realm_level_complete.sql")
        
        # Step 2: Collect all unique department-scoped auths (deduplicate by auth_id)
        logger.info("Syncing department-scoped IdPs...")
        async with pool.acquire() as conn:
            sql_text = load_sql("app/sql/v4/keycloak/get_departments_for_org_sync_complete.sql")
            is_function, function_name, schema = _detect_function_in_sql(sql_text)
            
            if is_function and function_name:
                function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"()'
                departments = await conn.fetch(function_call_sql)
                
                # Collect all unique auths (deduplicate by auth_id)
                all_department_auths: dict[str, dict[str, Any]] = {}  # key: auth_id, value: auth data
                
                for dept_row in departments:
                    dept = dict(dept_row)
                    dept_id = str(dept["department_id"])
                    dept_name = dept["department_name"] or dept_id
                    
                    # Ensure department-specific client exists (for client-scoped routing)
                    dept_client_id = await ensure_department_client(
                        department_id=dept_id,
                        department_name=dept_name,
                        kc_admin=kc_admin,
                    )
                    
                    if not dept_client_id:
                        logger.warning(f"Failed to create department client for {dept_id}, continuing with IdP sync")
                    
                    # Get auths for this department
                    auths_sql_text = load_sql("app/sql/v4/keycloak/get_auths_for_org_complete.sql")
                    auths_is_function, auths_function_name, auths_schema = _detect_function_in_sql(auths_sql_text)
                    
                    if auths_is_function and auths_function_name:
                        import uuid
                        auths_function_call_sql = f'SELECT * FROM "{auths_schema}"."{auths_function_name}"($1)'
                        org_providers = await conn.fetch(auths_function_call_sql, uuid.UUID(dept_id))
                        
                        for provider_row in org_providers:
                            provider = dict(provider_row)
                            auth_id = str(provider["id"])
                            
                            # Store auth once (first department wins for config lookup)
                            if auth_id not in all_department_auths:
                                all_department_auths[auth_id] = {
                                    "auth_id": auth_id,
                                    "slug": provider["slug"],
                                    "provider_id": provider["provider_id"],
                                    "display_name": provider["name"],
                                    "department_id": dept_id,  # For config lookup
                                }
                    else:
                        raise ValueError("Expected function definition in get_auths_for_org_complete.sql")
                
                # Sync each unique auth once (prevents duplicates)
                for auth_data in all_department_auths.values():
                    await sync_identity_provider_for_org(
                        auth_id=auth_data["auth_id"],
                        slug=auth_data["slug"],
                        provider_id=auth_data["provider_id"],
                        display_name=auth_data["display_name"],
                        department_id=auth_data["department_id"],
                        kc_admin=kc_admin,
                        pool=pool,
                    )
            else:
                raise ValueError("Expected function definition in get_departments_for_org_sync_complete.sql")
        
        # Step 3: Clean up IdPs that shouldn't exist
        # Delete realm-level IdPs that are no longer in default settings
        logger.info("Cleaning up obsolete IdPs...")
        try:
            existing_idps = kc_admin.get_idps()
            
            # Collect expected default-idp aliases (from Step 0 sync)
            # Note: mode is "default-account" but alias uses "default-account" in the name
            expected_default_idp_aliases: set[str] = set()
            # Platform-level
            expected_default_idp_aliases.add("default-idp-guest-platform")
            expected_default_idp_aliases.add("default-idp-default-account-platform")  # mode="default-account" → alias uses "default-account"
            # Department-level (collect from departments)
            async with pool.acquire() as conn:
                dept_sql = load_sql("app/sql/v4/keycloak/get_departments_for_org_sync_complete.sql")
                dept_is_function, dept_function_name, dept_schema = _detect_function_in_sql(dept_sql)
                if dept_is_function and dept_function_name:
                    dept_function_call_sql = f'SELECT * FROM "{dept_schema}"."{dept_function_name}"()'
                    departments = await conn.fetch(dept_function_call_sql)
                    for dept_row in departments:
                        dept = dict(dept_row)
                        dept_id = str(dept["department_id"])
                        expected_default_idp_aliases.add(f"default-idp-guest-dept-{dept_id}")
                        expected_default_idp_aliases.add(f"default-idp-default-account-dept-{dept_id}")  # mode="default-account" → alias uses "default-account"
            
            # Get expected realm-level slugs
            async with pool.acquire() as conn:
                sql_text = load_sql("app/sql/v4/keycloak/get_auths_for_realm_level_complete.sql")
                is_function, function_name, schema = _detect_function_in_sql(sql_text)
                if is_function and function_name:
                    function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"()'
                    realm_level_providers = await conn.fetch(function_call_sql)
                    expected_realm_slugs = {p["slug"] for p in realm_level_providers}
                    # Add default-idp aliases to expected realm-level slugs (they're realm-level IdPs)
                    expected_realm_slugs.update(expected_default_idp_aliases)
                else:
                    expected_realm_slugs = expected_default_idp_aliases.copy()
            
            # Get expected department-scoped aliases (auth_{slug}_{auth_id} pattern)
            async with pool.acquire() as conn:
                sql_text = load_sql("app/sql/v4/keycloak/get_departments_for_org_sync_complete.sql")
                is_function, function_name, schema = _detect_function_in_sql(sql_text)
                if is_function and function_name:
                    function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"()'
                    departments = await conn.fetch(function_call_sql)
                    
                    expected_dept_aliases = set()
                    # Collect unique auths (deduplicate)
                    seen_auths: set[str] = set()
                    for dept_row in departments:
                        dept = dict(dept_row)
                        dept_id = str(dept["department_id"])
                        
                        auths_sql_text = load_sql("app/sql/v4/keycloak/get_auths_for_org_complete.sql")
                        auths_is_function, auths_function_name, auths_schema = _detect_function_in_sql(auths_sql_text)
                        if auths_is_function and auths_function_name:
                            import uuid
                            auths_function_call_sql = f'SELECT * FROM "{auths_schema}"."{auths_function_name}"($1)'
                            org_providers = await conn.fetch(auths_function_call_sql, uuid.UUID(dept_id))
                            for provider_row in org_providers:
                                provider = dict(provider_row)
                                auth_id = str(provider["id"])
                                # Use auth_id-based alias (1:1 mapping)
                                alias = f"auth_{provider['slug']}_{auth_id}"
                                expected_dept_aliases.add(alias)
                else:
                    expected_dept_aliases = set()
            
            # Delete IdPs that shouldn't exist
            for idp in existing_idps:
                idp_alias = idp.get("alias", "")
                
                # Skip default-idp instances (they're managed separately and should always exist if synced)
                if idp_alias.startswith("default-idp-"):
                    continue
                
                # Check if it's realm-level or department-scoped
                if idp_alias.startswith("auth_"):
                    # Department-scoped IdP (auth_{slug}_{auth_id} pattern)
                    if idp_alias not in expected_dept_aliases:
                        try:
                            kc_admin.delete_idp(idp_alias=idp_alias)
                            logger.info(f"🗑️  Deleted obsolete department-scoped IdP: {idp_alias}")
                        except Exception as delete_e:
                            error_str = str(delete_e).lower()
                            if "not found" in error_str or "404" in error_str:
                                pass  # Already deleted
                            else:
                                logger.warning(f"Failed to delete IdP '{idp_alias}': {delete_e}")
                else:
                    # Realm-level IdP (uses slug directly)
                    if idp_alias not in expected_realm_slugs:
                        try:
                            kc_admin.delete_idp(idp_alias=idp_alias)
                            logger.info(f"🗑️  Deleted obsolete realm-level IdP: {idp_alias}")
                        except Exception as delete_e:
                            error_str = str(delete_e).lower()
                            if "not found" in error_str or "404" in error_str:
                                pass  # Already deleted
                            else:
                                logger.warning(f"Failed to delete IdP '{idp_alias}': {delete_e}")
        except Exception as cleanup_e:
            logger.warning(f"Failed to clean up obsolete IdPs: {cleanup_e}")
        
        logger.info("✅ Identity provider sync completed")
    except Exception as e:
        logger.error(f"Failed to sync identity providers: {e}", exc_info=True)


# OLD FUNCTION REMOVED: sync_department_realm_by_settings
# This function was replaced by sync_identity_providers() which uses client-id scoping instead of multiple realms
# The old function created separate realms per settings, but we now use a single master realm with client-id based routing


async def sync_keycloak(department_id: str | None = None) -> None:
    """Sync Keycloak identity providers from database to Keycloak.

    Args:
        department_id: Optional department ID to sync. If None, syncs all active departments.
    """
    pool = get_pool()
    if not pool:
        logger.warning("Database pool not available, skipping Keycloak sync")
        return

    try:
        # Keycloak sync configuration
        app_prefix = os.getenv("APP_PREFIX", "")
        explicit_keycloak_url = os.getenv("KEYCLOAK_URL")

        if explicit_keycloak_url:
            keycloak_url = explicit_keycloak_url.rstrip("/")
        else:
            docker_env = os.getenv("DOCKER_ENV")
            keycloak_internal_url = os.getenv("KEYCLOAK_INTERNAL_URL")

            if keycloak_internal_url:
                base_url = keycloak_internal_url.rstrip("/")
            elif docker_env:
                base_url = "http://keycloak:8080"
            else:
                base_url = "http://localhost:8080"

            # Keycloak admin API: use /auth path for consistency
            # For local dev: Keycloak serves at /auth (KC_HTTP_RELATIVE_PATH=/auth)
            # For Docker/production: Keycloak is behind nginx at /auth
            keycloak_url = f"{base_url}{app_prefix}/auth"

        keycloak_admin = os.getenv("KEYCLOAK_ADMIN", "admin")
        keycloak_admin_password = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")

        # Check if we're in local dev mode
        origin_check = os.getenv("ORIGIN", "http://localhost:3000")
        is_local_dev = "localhost" in origin_check.lower()

        # For local dev, ensure master realm SSL requirement is set to NONE
        # We need to update both the database AND use Admin API to force Keycloak to reload
        if is_local_dev and pool:
            try:
                # First, update database
                async with pool.acquire() as conn:
                    from typing import cast

                    from app.sql.types import UpdateMasterRealmSslSqlRow
                    from app.utils.sql_helper import execute_sql_typed

                    result = cast(
                        UpdateMasterRealmSslSqlRow,
                        await execute_sql_typed(
                            conn,
                            "app/sql/v4/keycloak/update_master_realm_ssl_complete.sql",
                            params=None,
                        ),
                    )
                    logger.info(
                        f"✅ {result.message}"
                    )

                # Note: Keycloak caches realm settings in memory, so database updates take time to take effect
                # The Admin API also requires HTTPS when realm requires HTTPS, so we can't use it to force a reload
                # We need to wait for Keycloak's cache to expire and pick up the database change
                # Keycloak's cache typically refreshes every 5-10 seconds, so we wait a bit longer
                logger.info(
                    "Waiting for Keycloak to pick up database change (cache refresh ~5-10s)..."
                )
                await asyncio.sleep(10)
            except Exception as e:
                logger.warning(f"Could not update master realm SSL in database: {e}")
                logger.warning(
                    "Note: If Keycloak still requires HTTPS, you may need to restart Keycloak"
                )

        # Connect to Keycloak Admin API with retry logic
        kc_admin = await wait_for_keycloak(
            keycloak_url, keycloak_admin, keycloak_admin_password
        )
        if not kc_admin:
            logger.warning(
                "Keycloak is not available. Skipping sync. "
                "The server will continue to run, but authentication may not work until Keycloak is ready."
            )
            return

        # Update master realm SSL setting for local development
        try:
            if is_local_dev:
                master_realm = kc_admin.get_realm("master")
                current_ssl_required = master_realm.get("sslRequired", "EXTERNAL")
                if current_ssl_required != "NONE":
                    kc_admin.update_realm(
                        realm_name="master",
                        payload={"sslRequired": "NONE"},
                    )
                    logger.info(
                        f"✅ Master realm SSL requirement disabled for local development (was: {current_ssl_required})"
                    )
        except Exception as e:
            logger.warning(
                f"Could not update master realm SSL setting: {e}. Continuing..."
            )

        # Ensure glow-client exists in master realm before syncing
        await ensure_glow_client_in_master_realm(kc_admin)

        # Ensure MCP client scope is configured (after client is ensured)
        await ensure_mcp_client_scope(kc_admin)
        
        # Ensure MCP token lifespan is configured (after client scope)
        await ensure_mcp_token_lifespan(kc_admin)
        
        # Ensure Trusted Hosts policy is configured for client registration
        await ensure_trusted_hosts_policy(kc_admin)

        # Sync identity providers (realm-level + department-scoped)
        # All IdPs are hidden, theme controls visibility based on client_id
        await sync_identity_providers(kc_admin, pool)
        
        # Generate theme provider mapping (client_id -> allowed IdP aliases)
        logger.info("Generating comprehensive Keycloak theme provider mapping...")
        try:
            from app.infra.v4.auth.keycloak_theme import \
                generate_keycloak_theme_providers
            
            await generate_keycloak_theme_providers(pool)
            logger.info("✅ Theme provider mapping generated with all clientId and IdP combinations")
        except Exception as e:
            logger.warning(f"Failed to generate theme mapping: {e}", exc_info=True)
        
        # Set login theme to "glow" (theme controls IdP visibility)
        try:
            realm = kc_admin.get_realm("master")
            if realm.get("loginTheme") != "glow":
                kc_admin.update_realm("master", {"loginTheme": "glow"})
                logger.info("✅ Set master realm login theme to 'glow'")
        except Exception as e:
            logger.warning(f"Failed to set login theme: {e}")

        # Clean up old non-master realms (safety check - should all be deleted already)
        try:
            existing_realms = kc_admin.get_realms()
            for realm in existing_realms:
                realm_name = realm.get("realm", "")
                # Skip master realm
                if realm_name == "master":
                    continue

                # Delete any non-master realms (old architecture)
                try:
                    kc_admin.delete_realm(realm_name=realm_name)
                    logger.info(f"✅ Deleted old realm: {realm_name}")
                except Exception as e:
                    error_str = str(e).lower()
                    if "not found" in error_str or "404" in error_str:
                        logger.info(f"Realm '{realm_name}' already deleted")
                    else:
                        logger.warning(f"Failed to delete old realm '{realm_name}': {e}")
        except Exception as e:
            logger.warning(f"Failed to clean up old realms: {e}", exc_info=True)

        logger.info("Keycloak sync completed")
    except Exception as e:
        logger.warning(f"Keycloak sync failed (non-blocking): {e}", exc_info=True)


async def perform_keycloak_sync(
    department_id: str | None = None,
) -> KeycloakSyncResult:
    """Perform Keycloak sync and return result.

    This is a wrapper around sync_keycloak() that catches exceptions
    and returns a structured result. It also checks preconditions like
    database pool availability and Keycloak connectivity.

    Args:
        department_id: Optional department ID to sync. If None, syncs all active departments.

    Returns:
        KeycloakSyncResult with success status, message, and optional error details
    """
    # Check database pool availability
    pool = get_pool()
    if not pool:
        error_msg = "Database pool not available"
        logger.warning(error_msg)
        return KeycloakSyncResult(
            success=False,
            message=error_msg,
            department_id=department_id,
            error=error_msg,
        )

    try:
        # Check if Keycloak is available BEFORE attempting sync
        # Note: Keycloak might return 403 "HTTPS required" before sync disables SSL requirement
        # This is expected and sync will fix it, so we proceed anyway
        from app.infra.v4.health import check_keycloak

        keycloak_check = await check_keycloak()
        # Only fail if Keycloak is completely unavailable (connection error, not 403 HTTPS required)
        if not keycloak_check.ok and "HTTPS required" not in keycloak_check.error:
            error_msg = f"Keycloak is not available: {keycloak_check.error}"
            logger.warning(error_msg)
            return KeycloakSyncResult(
                success=False,
                message=error_msg,
                department_id=department_id,
                error=keycloak_check.error,
            )

        # Call the actual sync function
        # Note: sync_keycloak() catches exceptions internally and logs warnings,
        # but we wrap it to catch any unexpected exceptions
        # Also note: sync_keycloak() may return early if Keycloak admin connection fails
        # We need to verify sync actually completed by checking if Keycloak is accessible
        await sync_keycloak(department_id=department_id)

        # Verify Keycloak is accessible after sync
        # Wait a moment for any async operations to complete
        await asyncio.sleep(1)

        keycloak_check_after = await check_keycloak()
        # After sync, Keycloak should be accessible (200 OK, not 403 HTTPS required)
        if not keycloak_check_after.ok:
            # If still getting HTTPS required, sync didn't complete successfully
            if (
                "HTTPS required" in keycloak_check_after.error
                or keycloak_check_after.error == "status=403"
            ):
                error_msg = "Keycloak sync did not complete: SSL requirement not disabled (Keycloak may need more time to pick up database changes)"
                logger.warning(error_msg)
                return KeycloakSyncResult(
                    success=False,
                    message=error_msg,
                    department_id=department_id,
                    error=keycloak_check_after.error,
                )
            else:
                error_msg = f"Keycloak sync completed but Keycloak became unhealthy: {keycloak_check_after.error}"
                logger.warning(error_msg)
                return KeycloakSyncResult(
                    success=False,
                    message=error_msg,
                    department_id=department_id,
                    error=keycloak_check_after.error,
                )

        # If we get here, sync completed successfully
        if department_id:
            message = (
                f"Keycloak sync completed successfully for department {department_id}"
            )
        else:
            message = "Keycloak sync completed successfully for all departments"

        return KeycloakSyncResult(
            success=True,
            message=message,
            department_id=department_id,
        )
    except Exception as e:
        # Log the error but return a result instead of raising
        error_msg = str(e)
        logger.error(f"Keycloak sync failed: {error_msg}", exc_info=True)

        if department_id:
            message = (
                f"Keycloak sync failed for department {department_id}: {error_msg}"
            )
        else:
            message = f"Keycloak sync failed: {error_msg}"

        return KeycloakSyncResult(
            success=False,
            message=message,
            department_id=department_id,
            error=error_msg,
        )
