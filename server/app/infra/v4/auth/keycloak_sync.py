"""Keycloak sync utility - synchronous sync function that returns success/failure."""

import asyncio
import os
import re
import socket
from dataclasses import dataclass
from typing import Any

from app.main import get_pool
from app.mcp.oauth import MCP_RESOURCE, is_mcp_enabled
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.logging.db_logger import get_logger
from utils.sql_helper import _detect_function_in_sql, load_sql

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


async def get_realm_name_for_department(department_id: str | None, pool: Any) -> str:
    """Get realm name for a department based on which settings has keys.

    Args:
        department_id: Department ID (None for no department)
        pool: Database connection pool

    Returns:
        Realm name: settings_id if department-specific settings has keys, "master" otherwise
    """
    if department_id is None:
        return "master"  # No department → master realm (default settings)

    try:
        import uuid
        from typing import cast

        from app.sql.types import (GetRealmNameForDepartmentSqlParams,
                                   GetRealmNameForDepartmentSqlRow)
        from utils.sql_helper import execute_sql_typed

        async with pool.acquire() as conn:
            params = GetRealmNameForDepartmentSqlParams(
                department_id=uuid.UUID(department_id)
            )
            result = cast(
                GetRealmNameForDepartmentSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/keycloak/get_realm_name_for_department_complete.sql",
                    params=params,
                ),
            )
            return result.realm_name or "master"
    except Exception as e:
        logger.warning(f"Failed to get realm name for department {department_id}: {e}")
        return "master"  # Fallback to master on error


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

        # Step 3: Assign scope to glow-client as default client scope
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
                f"Failed to assign MCP scope to client '{target_client_id}': {e}"
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


async def sync_department_realm_by_settings(
    realm_name: str, department_id: str | None, kc_admin: Any, pool: Any
) -> None:
    """Sync a realm based on settings_id (realm_name).

    Args:
        realm_name: Realm name (settings_id or "master" for default settings)
        department_id: Department ID for provider sync logic (can be None)
        kc_admin: KeycloakAdmin instance
        pool: Database connection pool
    """
    bootstrap_leader = socket.gethostname() or os.getenv("HOSTNAME", "unknown")

    # Ensure realm exists
    try:
        realms = kc_admin.get_realms()
        realm_exists = any(r["realm"] == realm_name for r in realms)

        if not realm_exists:
            logger.info(f"[{bootstrap_leader}] Creating Keycloak realm: {realm_name}")
            try:
                kc_admin.create_realm(
                    payload={"realm": realm_name, "enabled": True},
                    skip_exists=True,
                )
                logger.info(f"✅ Realm '{realm_name}' created")
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
                        f"⚠️  [{bootstrap_leader}] Realm '{realm_name}' may have been created by another server, re-checking..."
                    )
                    realms = kc_admin.get_realms()
                    realm_exists_now = any(r["realm"] == realm_name for r in realms)

                    if realm_exists_now:
                        logger.info(f"✅ Realm '{realm_name}' now exists")
                    else:
                        logger.warning(
                            "⚠️  Realm creation conflict but realm not found on re-check"
                        )
                else:
                    raise
        else:
            logger.info(f"✅ Realm '{realm_name}' already exists")
    except Exception as e:
        logger.error(f"Failed to ensure realm exists: {e}", exc_info=True)
        return

    # Switch to target realm
    kc_admin.change_current_realm(realm_name=realm_name)

    # Fix realm settings for local development
    try:
        realm_details = kc_admin.get_realm(realm_name)
        attributes = realm_details.get("attributes", {})
        current_frontend_url = attributes.get("frontendUrl", "")
        current_ssl_required = realm_details.get("sslRequired", "EXTERNAL")

        origin_check = os.getenv("ORIGIN", "http://localhost:3000")
        is_local_dev = "localhost" in origin_check.lower()

        needs_update = False
        update_payload: dict[str, Any] = {}

        if current_frontend_url and "/realms/" in current_frontend_url:
            update_payload["attributes"] = {
                **attributes,
                "frontendUrl": "",
            }
            needs_update = True
            logger.info(f"Fixing realm frontend URL (was: {current_frontend_url})")
        elif not current_frontend_url and update_payload.get("attributes") is None:
            update_payload["attributes"] = attributes

        if is_local_dev and current_ssl_required != "NONE":
            if "attributes" not in update_payload:
                update_payload["attributes"] = attributes
            update_payload["sslRequired"] = "NONE"
            needs_update = True
            logger.info(
                f"Disabling SSL requirement for local development (was: {current_ssl_required})"
            )

        if needs_update:
            kc_admin.update_realm(realm_name=realm_name, payload=update_payload)
            logger.info("✅ Realm settings updated")
    except Exception as e:
        logger.warning(f"Could not update realm settings: {e}. Continuing...")

    # Setup Next.js client with pre-shared secret
    target_client_id = os.getenv("AUTH_KEYCLOAK_ID", "glow-client")
    target_secret: str | None = os.getenv("AUTH_KEYCLOAK_SECRET")
    client_port = os.getenv("CLIENT_PORT", "3000")
    app_prefix = os.getenv("APP_PREFIX", "")

    if not target_secret:
        logger.warning(
            "⚠️  AUTH_KEYCLOAK_SECRET is missing. Cannot enforce DHH-style auth."
        )
    else:
        try:
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
                        logger.info(f"✅ Client '{target_client_id}' updated")
                    except Exception as e:
                        error_str = str(e).lower()
                        is_conflict = (
                            "409" in error_str
                            or "conflict" in error_str
                            or "already exists" in error_str
                            or "not found" in error_str
                        )

                        if is_conflict:
                            logger.info(
                                f"⚠️  [{bootstrap_leader}] Client '{target_client_id}' update conflict, re-checking..."
                            )
                            clients = kc_admin.get_clients()
                            existing_client_now = next(
                                (
                                    c
                                    for c in clients
                                    if c.get("clientId") == target_client_id
                                ),
                                None,
                            )

                            if existing_client_now:
                                logger.info(
                                    f"✅ Client '{target_client_id}' still exists, update may have been applied by another server"
                                )
                            else:
                                logger.warning(
                                    f"⚠️  Client '{target_client_id}' no longer exists after update conflict"
                                )
                        else:
                            raise
                else:
                    logger.warning(
                        f"⚠️  Client '{target_client_id}' exists but has no ID"
                    )
            else:
                try:
                    new_client_uuid = kc_admin.create_client(
                        payload=client_payload, skip_exists=True
                    )
                    logger.info(f"✅ Client '{target_client_id}' created")

                    if new_client_uuid:
                        kc_admin.update_client(
                            client_id=new_client_uuid,
                            payload={"secret": target_secret},
                        )
                        logger.info(
                            f"✅ Client Secret enforced for '{target_client_id}'"
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
                            f"⚠️  [{bootstrap_leader}] Client '{target_client_id}' was created by another server, re-checking..."
                        )
                        clients = kc_admin.get_clients()
                        existing_client = next(
                            (
                                c
                                for c in clients
                                if c.get("clientId") == target_client_id
                            ),
                            None,
                        )

                        if existing_client:
                            client_uuid = existing_client.get("id")
                            if client_uuid:
                                kc_admin.update_client(
                                    client_id=client_uuid,
                                    payload={"secret": target_secret},
                                )
                                logger.info(
                                    f"✅ Client '{target_client_id}' found and secret updated"
                                )
                            else:
                                logger.warning(
                                    f"⚠️  Client '{target_client_id}' exists but has no ID"
                                )
                        else:
                            logger.warning(
                                f"⚠️  Client '{target_client_id}' creation conflict but not found on re-check"
                            )
                    else:
                        raise

        except Exception as e:
            logger.error(f"❌ Client sync failed: {e}", exc_info=True)

    # Sync identity providers for this settings realm
    # Determine which settings_id to use for provider sync
    async with pool.acquire() as conn:
        if realm_name == "master":
            # Master realm uses default settings
            settings_id = None
        else:
            # Settings-based realm uses the settings_id as realm_name
            settings_id = realm_name

        # Get providers for this settings (not department)
        # We need to update get_auth_providers_complete.sql to accept settings_id
        # For now, if we have department_id, use it; otherwise use NULL for default settings
        # Pass department_id for backward compatibility, but logic will be updated
        import uuid

        from app.sql.types import GetAuthProvidersSqlParams

        # Handle multi-row function results
        sql_text = load_sql("app/sql/v4/keycloak/get_auth_providers_complete.sql")
        is_function, function_name, schema = _detect_function_in_sql(sql_text)

        if is_function and function_name:
            # Handle None department_id - function accepts NULL but Pydantic requires UUID
            # Pass None directly to PostgreSQL (it accepts NULL even for non-nullable params)
            if department_id:
                dept_id_uuid = uuid.UUID(department_id)
                params = GetAuthProvidersSqlParams(department_id=dept_id_uuid)
                sql_params = params.to_tuple()
            else:
                # Pass NULL directly to PostgreSQL function
                sql_params = (None,)
            param_placeholders = ", ".join(
                [f"${i + 1}" for i in range(len(sql_params))]
            )
            function_call_sql = (
                f'SELECT * FROM "{schema}"."{function_name}"({param_placeholders})'
            )
            provider_rows = await conn.fetch(function_call_sql, *sql_params)
            providers = [dict(row) for row in provider_rows]
        else:
            raise ValueError(
                "Expected function definition in get_auth_providers_complete.sql"
            )

        # Get list of provider slugs that should exist
        expected_provider_slugs = {p["slug"] for p in providers} if providers else set()

        # Get existing providers in Keycloak realm
        try:
            existing_idps = kc_admin.get_idps()
            existing_provider_slugs = {idp.get("alias", "") for idp in existing_idps}

            # Delete providers that shouldn't be in this realm
            providers_to_delete = existing_provider_slugs - expected_provider_slugs
            for slug_to_delete in providers_to_delete:
                try:
                    kc_admin.delete_idp(idp_alias=slug_to_delete)
                    logger.info(
                        f"🗑️  Deleted provider '{slug_to_delete}' from realm '{realm_name}' (not in database)"
                    )
                except Exception as delete_e:
                    error_str = str(delete_e).lower()
                    if "not found" in error_str or "404" in error_str:
                        logger.info(
                            f"Provider '{slug_to_delete}' already deleted from realm '{realm_name}'"
                        )
                    else:
                        logger.warning(
                            f"Failed to delete provider '{slug_to_delete}' from realm '{realm_name}': {delete_e}"
                        )
        except Exception as list_e:
            logger.warning(
                f"Failed to list existing providers in realm '{realm_name}': {list_e}"
            )

        if not providers:
            logger.info(
                f"No active providers found for department {department_id or 'default'}, skipping sync"
            )
        else:
            for p in providers:
                auth_id = p["id"]
                slug = p["slug"]
                provider_id = p["provider_id"]
                display_name = p["name"]

                # Handle multi-row function results for auth items
                from app.sql.types import GetAuthItemsSqlParams

                items_sql_text = load_sql(
                    "app/sql/v4/keycloak/get_auth_items_complete.sql"
                )
                items_is_function, items_function_name, items_schema = (
                    _detect_function_in_sql(items_sql_text)
                )

                if items_is_function and items_function_name:
                    auth_id_uuid = uuid.UUID(str(auth_id))
                    # Handle None department_id - function accepts NULL but Pydantic requires UUID
                    if department_id:
                        dept_id_uuid = uuid.UUID(department_id)
                        items_params = GetAuthItemsSqlParams(
                            auth_id=auth_id_uuid, department_id=dept_id_uuid
                        )
                        items_sql_params = items_params.to_tuple()
                    else:
                        # Pass NULL directly to PostgreSQL function
                        items_sql_params = (auth_id_uuid, None)
                    items_param_placeholders = ", ".join(
                        [f"${i + 1}" for i in range(len(items_sql_params))]
                    )
                    items_function_call_sql = f'SELECT * FROM "{items_schema}"."{items_function_name}"({items_param_placeholders})'
                    item_rows = await conn.fetch(
                        items_function_call_sql, *items_sql_params
                    )
                    items = [dict(row) for row in item_rows]
                    logger.info(
                        f"🔍 Retrieved {len(items)} items for provider '{slug}' (auth_id={auth_id}): {[item['name'] for item in items]}"
                    )
                else:
                    raise ValueError(
                        "Expected function definition in get_auth_items_complete.sql"
                    )

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
                                f"Failed to decrypt auth_item '{item_name}' for provider '{slug}': {e}. "
                                f"Using as plain text."
                            )
                            config_map[item_name] = raw_value
                    else:
                        config_map[item_name] = raw_value

                payload: dict[str, Any] = {
                    "alias": slug,
                    "providerId": provider_id,
                    "displayName": display_name,
                    "enabled": True,
                    "trustEmail": True,
                    "config": {},
                }

                if provider_id == "saml":
                    if "ssoUrl" in config_map:
                        payload["config"]["singleSignOnServiceUrl"] = config_map[
                            "ssoUrl"
                        ]
                    if "entityId" in config_map:
                        payload["config"]["entityId"] = config_map["entityId"]
                    if "metadataUrl" in config_map:
                        payload["config"]["importFromIdpUrl"] = config_map[
                            "metadataUrl"
                        ]
                    if "certificate" in config_map:
                        payload["config"]["signingCertificate"] = config_map[
                            "certificate"
                        ]
                    if "nameIDPolicyFormat" not in payload["config"]:
                        payload["config"]["nameIDPolicyFormat"] = (
                            "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
                        )
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

                logger.info(
                    f"🔍 Payload for {slug} in realm {realm_name}: {payload['config']}"
                )
                if not config_map:
                    logger.warning(
                        f"⚠️  No config values found for provider '{slug}' (auth_id={auth_id}). "
                        f"Items retrieved: {len(items)}. Check SQL query and database."
                    )

                try:
                    kc_admin.get_idp(idp_alias=slug)
                    try:
                        kc_admin.update_idp(idp_alias=slug, payload=payload)
                        logger.info(f"✅ Synced Keycloak provider: {slug}")
                    except Exception as update_e:
                        error_str = str(update_e).lower()
                        if (
                            "409" in error_str
                            or "conflict" in error_str
                            or "already exists" in error_str
                        ):
                            logger.info(
                                f"⚠️  [{bootstrap_leader}] Provider '{slug}' update conflict, may have been updated by another server"
                            )
                        else:
                            raise
                except Exception:
                    try:
                        kc_admin.create_idp(payload=payload)
                        logger.info(f"✅ Created Keycloak provider: {slug}")
                    except Exception as create_e:
                        error_str = str(create_e).lower()
                        if (
                            "409" in error_str
                            or "conflict" in error_str
                            or "already exists" in error_str
                        ):
                            logger.info(
                                f"⚠️  [{bootstrap_leader}] Provider '{slug}' was created by another server, updating instead..."
                            )
                            try:
                                kc_admin.update_idp(idp_alias=slug, payload=payload)
                                logger.info(f"✅ Synced Keycloak provider: {slug}")
                            except Exception as update_retry_e:
                                logger.warning(
                                    f"⚠️  Failed to update provider '{slug}' after create conflict: {update_retry_e}"
                                )
                        else:
                            raise


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
                    from utils.sql_helper import execute_sql_typed

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

        # Ensure glow-client exists in master realm before syncing departments
        await ensure_glow_client_in_master_realm(kc_admin)

        # Ensure MCP client scope is configured (after client is ensured)
        await ensure_mcp_client_scope(kc_admin)
        
        # Ensure MCP token lifespan is configured (after client scope)
        await ensure_mcp_token_lifespan(kc_admin)

        # Determine which settings to sync (settings-based realms, not department-based)
        # Sync each settings that has providers with keys
        if department_id is not None:
            # Sync specific department - determine which settings it uses
            realm_name = await get_realm_name_for_department(department_id, pool)
            settings_to_sync = [realm_name]  # realm_name is settings_id or "master"
        else:
            # Sync all settings that have providers with keys
            async with pool.acquire() as conn:
                # Simplified: Get all settings with providers and keys
                # Master realm for default settings, settings_id for department-specific
                from utils.sql_helper import _detect_function_in_sql, load_sql

                sql_text = load_sql("app/sql/v4/keycloak/get_settings_to_sync_complete.sql")
                is_function, function_name, schema = _detect_function_in_sql(sql_text)

                if is_function and function_name:
                    function_call_sql = f'SELECT * FROM "{schema}"."{function_name}"()'
                    settings_to_sync_result = await conn.fetch(function_call_sql)
                    settings_to_sync = [
                        row["realm_name"] for row in settings_to_sync_result
                    ]
                else:
                    raise ValueError(
                        "Expected function definition in get_settings_to_sync_complete.sql"
                    )

        # Sync each settings realm (settings-based, not department-based)
        for settings_id in settings_to_sync:
            try:
                # For settings-based sync, determine department_id if needed
                # If settings_id is "master", use None (default settings)
                # Otherwise, find a department that uses this settings
                department_id_for_sync = None
                if settings_id != "master":
                    async with pool.acquire() as conn:
                        import uuid
                        from typing import cast

                        from app.sql.types import (
                            GetDepartmentIdForSettingsSqlParams,
                            GetDepartmentIdForSettingsSqlRow)
                        from utils.sql_helper import execute_sql_typed

                        params = GetDepartmentIdForSettingsSqlParams(
                            settings_id=uuid.UUID(settings_id)
                        )
                        result = cast(
                            GetDepartmentIdForSettingsSqlRow,
                            await execute_sql_typed(
                                conn,
                                "app/sql/v4/keycloak/get_department_id_for_settings_complete.sql",
                                params=params,
                            ),
                        )
                        department_id_for_sync = result.department_id

                # Sync the realm using settings_id as realm_name
                await sync_department_realm_by_settings(
                    settings_id, department_id_for_sync, kc_admin, pool
                )
            except Exception as e:
                logger.warning(
                    f"Failed to sync settings realm {settings_id}: {e}",
                    exc_info=True,
                )

        # Clean up old department-based realms that are no longer needed
        # These are realms that were created with department_id as name but should now be deleted
        # since we're using settings-based realms
        try:
            async with pool.acquire() as conn:
                # Get list of valid realm names (master + settings_ids with keys)
                valid_realm_names = set(settings_to_sync)

                # Get all existing realms
                existing_realms = kc_admin.get_realms()
                for realm in existing_realms:
                    realm_name = realm.get("realm", "")
                    # Skip master realm
                    if realm_name == "master":
                        continue

                    # If realm is not in valid list and looks like a UUID (old department-based realm),
                    # delete it
                    if realm_name not in valid_realm_names:
                        # Check if it's a UUID format (old department-based realm)
                        uuid_pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
                        if re.match(uuid_pattern, realm_name.lower()):
                            try:
                                kc_admin.delete_realm(realm_name=realm_name)
                                logger.info(
                                    f"✅ Deleted old department-based realm: {realm_name}"
                                )
                            except Exception as e:
                                error_str = str(e).lower()
                                if "not found" in error_str or "404" in error_str:
                                    logger.info(f"Realm '{realm_name}' already deleted")
                                else:
                                    logger.warning(
                                        f"Failed to delete old realm '{realm_name}': {e}"
                                    )
        except Exception as e:
            logger.warning(f"Failed to clean up old realms: {e}", exc_info=True)

        logger.info("Keycloak sync completed")
    except Exception as e:
        logger.warning(f"Keycloak sync failed (non-blocking): {e}", exc_info=True)


async def delete_department_realm(department_id: str) -> None:
    """Delete a department realm from Keycloak.

    Args:
        department_id: Department ID to delete realm for
    """
    pool = get_pool()
    if not pool:
        logger.warning("Database pool not available, skipping realm deletion")
        return

    try:
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

        kc_admin = await wait_for_keycloak(
            keycloak_url, keycloak_admin, keycloak_admin_password
        )
        if not kc_admin:
            logger.warning("Keycloak not available, skipping realm deletion")
            return

        # Get default department ID to check if this is the default department
        async with pool.acquire() as conn:
            sql_default_department = load_sql(
                "app/sql/v4/settings/get_default_department.sql"
            )
            default_dept_result = await conn.fetchval(sql_default_department)

        # Get realm name for this department
        realm_name = await get_realm_name_for_department(department_id, pool)

        # Don't delete master realm
        if realm_name == "master":
            logger.info("Skipping deletion of master realm")
            return

        try:
            kc_admin.delete_realm(realm_name=realm_name)
            logger.info(f"✅ Deleted Keycloak realm: {realm_name}")
        except Exception as e:
            error_str = str(e).lower()
            if "not found" in error_str or "404" in error_str:
                logger.info(f"Realm '{realm_name}' already deleted")
            else:
                logger.warning(f"Failed to delete realm '{realm_name}': {e}")
    except Exception as e:
        logger.warning(f"Realm deletion failed (non-blocking): {e}", exc_info=True)


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
