"""Keycloak sync handler - syncs identity providers from database to Keycloak."""

import asyncio
import logging
import os
import socket
from typing import Any

from app.main import get_internal_sio, get_pool, sio
from app.utils.auth.decrypt_api_key import decrypt_api_key
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

# Retry configuration
MAX_RETRIES = 10
INITIAL_RETRY_DELAY = 2.0  # seconds
MAX_RETRY_DELAY = 30.0  # seconds


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

            # If previous attempt failed with HTTPS required and we're using HTTP, try HTTPS
            try_https = False
            if is_local_dev and last_error and "https required" in str(last_error).lower():
                if url.startswith("http://"):
                    try_https = True
                    https_url = url.replace("http://", "https://", 1)
                    logger.info(f"Previous attempt required HTTPS, retrying with HTTPS URL: {https_url}")
                else:
                    https_url = url

            connection_url = https_url if try_https else url
            
            kc_admin = KeycloakAdmin(
                server_url=f"{connection_url}/",
                username=admin,
                password=password,
                realm_name="master",
                verify=False if is_local_dev else verify_ssl,  # Disable SSL verification for local dev
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
                        # After updating via HTTPS, reconnect using HTTP for future operations
                        if try_https and url.startswith("http://"):
                            logger.info("Reconnecting using HTTP after SSL requirement update...")
                            kc_admin = KeycloakAdmin(
                                server_url=f"{url}/",
                                username=admin,
                                password=password,
                                realm_name="master",
                                verify=False,
                            )
                            kc_admin.get_realms()  # Test connection
                            logger.info("✅ Successfully switched to HTTP connection")
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
                if is_https_required and is_local_dev and url.startswith("http://") and attempt == 1:
                    # On first attempt with HTTPS required error, immediately try HTTPS
                    logger.info("Keycloak requires HTTPS, will retry with HTTPS on next attempt...")
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


async def get_realm_name_for_department(
    department_id: str | None, pool: Any
) -> str:
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
        async with pool.acquire() as conn:
            realm_sql = load_sql("sql/v3/keycloak/get_realm_name_for_department.sql")
            realm_name = await conn.fetchval(realm_sql, department_id)
            return realm_name or "master"
    except Exception as e:
        logger.warning(f"Failed to get realm name for department {department_id}: {e}")
        return "master"  # Fallback to master on error


def get_realm_name(department_id: str | None, default_dept_id: str | None, has_departments: bool = True) -> str:
    """Get realm name for a department (synchronous version - deprecated).
    
    This function is kept for backward compatibility but should be replaced with
    get_realm_name_for_department() which checks settings for keys.
    
    Args:
        department_id: Department ID (None for master realm)
        default_dept_id: Default department ID from settings (unused)
        has_departments: Whether any departments exist (unused)
        
    Returns:
        Realm name: "master" when department_id is None, otherwise department_id
    """
    if department_id is None:
        return "master"
    # Note: This is a simplified version - use get_realm_name_for_department() for accurate realm selection
    return department_id


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
            default_dept_result = await conn.fetchval(
                """
                SELECT sdd.department_id::text
                FROM settings s
                JOIN settings_default_department sdd ON sdd.settings_id = s.id
                WHERE s.active = true AND sdd.active = true
                LIMIT 1
                """
            )

        realm_name = get_realm_name(department_id, default_dept_result)

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


async def sync_department_realm(
    department_id: str | None, kc_admin: Any, pool: Any
) -> None:
    """Sync a department realm (now settings-based, not department-based).
    
    Args:
        department_id: Department ID (None for master realm with default settings)
        kc_admin: KeycloakAdmin instance
        pool: Database connection pool
        
    Note:
        - Realms are now based on settings (credential sources), not departments
        - Determines which settings the department uses (checks for keys)
        - Realm name = settings_id if department-specific settings has keys, else "master"
    """
    # Determine which settings this department uses (check for keys)
    realm_name = await get_realm_name_for_department(department_id, pool)
    
    # Call the settings-based sync function
    await sync_department_realm_by_settings(
        realm_name, department_id, kc_admin, pool
    )


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
            logger.info(
                f"[{bootstrap_leader}] Creating Keycloak realm: {realm_name}"
            )
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
                    realm_exists_now = any(
                        r["realm"] == realm_name for r in realms
                    )

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
            logger.info(
                f"Fixing realm frontend URL (was: {current_frontend_url})"
            )
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
            kc_admin.update_realm(
                realm_name=realm_name, payload=update_payload
            )
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
            redirect_uri = (
                f"{base_url}{app_prefix}/api/auth/callback/keycloak"
            )
            redirect_uris = [redirect_uri, f"{base_url}{app_prefix}/*"]

            clients = kc_admin.get_clients()
            existing_client = next(
                (
                    c
                    for c in clients
                    if c.get("clientId") == target_client_id
                ),
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
        providers_sql = load_sql(
            "sql/v3/keycloak/get_auth_providers_complete.sql"
        )
        # Pass department_id for backward compatibility, but logic will be updated
        providers = await conn.fetch(providers_sql, department_id)

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
                    logger.info(f"🗑️  Deleted provider '{slug_to_delete}' from realm '{realm_name}' (not in database)")
                except Exception as delete_e:
                    error_str = str(delete_e).lower()
                    if "not found" in error_str or "404" in error_str:
                        logger.info(f"Provider '{slug_to_delete}' already deleted from realm '{realm_name}'")
                    else:
                        logger.warning(f"Failed to delete provider '{slug_to_delete}' from realm '{realm_name}': {delete_e}")
        except Exception as list_e:
            logger.warning(f"Failed to list existing providers in realm '{realm_name}': {list_e}")

        if not providers:
            logger.info(
                f"No active providers found for department {department_id or 'default'}, skipping sync"
            )
        else:
            items_sql = load_sql(
                "sql/v3/keycloak/get_auth_items_complete.sql"
            )

            for p in providers:
                auth_id = p["id"]
                slug = p["slug"]
                provider_id = p["provider_id"]
                display_name = p["name"]

                items = await conn.fetch(items_sql, auth_id, department_id)

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
                        payload["config"][
                            "singleSignOnServiceUrl"
                        ] = config_map["ssoUrl"]
                    if "entityId" in config_map:
                        payload["config"]["entityId"] = config_map[
                            "entityId"
                        ]
                    if "metadataUrl" in config_map:
                        payload["config"]["importFromIdpUrl"] = (
                            config_map["metadataUrl"]
                        )
                    if "certificate" in config_map:
                        payload["config"]["signingCertificate"] = (
                            config_map["certificate"]
                        )
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

                try:
                    kc_admin.get_idp(idp_alias=slug)
                    try:
                        kc_admin.update_idp(
                            idp_alias=slug, payload=payload
                        )
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
                                kc_admin.update_idp(
                                    idp_alias=slug, payload=payload
                                )
                                logger.info(
                                    f"✅ Synced Keycloak provider: {slug}"
                                )
                            except Exception as update_retry_e:
                                logger.warning(
                                    f"⚠️  Failed to update provider '{slug}' after create conflict: {update_retry_e}"
                                )
                        else:
                            raise


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
        logger.warning(
            "⚠️  AUTH_KEYCLOAK_SECRET is missing. Cannot create glow-client."
        )
        return
    
    try:
        # Switch to master realm to ensure client is created there
        kc_admin.change_current_realm(realm_name="master")
        
        origin = os.getenv("ORIGIN", f"http://localhost:{client_port}")
        base_url = origin.rstrip("/")
        redirect_uri = (
            f"{base_url}{app_prefix}/api/auth/callback/keycloak"
        )
        redirect_uris = [redirect_uri, f"{base_url}{app_prefix}/*"]
        
        clients = kc_admin.get_clients()
        existing_client = next(
            (
                c
                for c in clients
                if c.get("clientId") == target_client_id
            ),
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
                    logger.warning(f"Failed to update master realm client '{target_client_id}': {e}")
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
                    logger.info(f"✅ Master realm: Client secret enforced for '{target_client_id}'")
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
                    logger.info(f"⚠️  Master realm: Client '{target_client_id}' already exists")
                else:
                    logger.warning(f"Failed to create master realm client '{target_client_id}': {e}")
    except Exception as e:
        logger.warning(f"Could not ensure glow-client in master realm: {e}")


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

        # For local dev, ensure master realm SSL requirement is set to NONE in database
        # Note: Keycloak may need a restart for this to take effect, or wait a few seconds
        if is_local_dev and pool:
            try:
                async with pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE keycloak.realm SET ssl_required = 'NONE' WHERE name = 'master'"
                    )
                    logger.info("✅ Set master realm SSL requirement to NONE in database")
                    # Wait a moment for Keycloak to pick up the database change
                    await asyncio.sleep(2)
            except Exception as e:
                logger.warning(f"Could not update master realm SSL in database: {e}")
                logger.warning("Note: If Keycloak still requires HTTPS, you may need to restart Keycloak")

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
                settings_to_sync_result = await conn.fetch("""
                    -- Default settings → 'master' realm
                    SELECT 'master'::text as realm_name
                    WHERE EXISTS (
                        SELECT 1 FROM settings s
                        JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
                        WHERE s.active = true
                          AND NOT EXISTS (
                              SELECT 1 FROM department_settings sd 
                              WHERE sd.settings_id = s.id AND sd.active = true
                          )
                    )
                    UNION
                    -- Department-specific settings with keys → use settings_id as realm
                    SELECT DISTINCT s.id::text as realm_name
                    FROM settings s
                    JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
                    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                    WHERE s.active = true
                      AND EXISTS (
                          SELECT 1 FROM setting_auth_keys sak
                          WHERE sak.settings_id = s.id AND sak.active = true
                      )
                """)
                settings_to_sync = [row["realm_name"] for row in settings_to_sync_result]

        # Sync each settings realm (settings-based, not department-based)
        for settings_id in settings_to_sync:
            try:
                # For settings-based sync, determine department_id if needed
                # If settings_id is "master", use None (default settings)
                # Otherwise, find a department that uses this settings
                department_id_for_sync = None
                if settings_id != "master":
                    async with pool.acquire() as conn:
                        dept_result = await conn.fetchval("""
                            SELECT ds.department_id::text
                            FROM department_settings ds
                            WHERE ds.settings_id = $1::uuid AND ds.active = true
                            LIMIT 1
                        """, settings_id)
                        department_id_for_sync = dept_result
                
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
                        import re
                        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                        if re.match(uuid_pattern, realm_name.lower()):
                            try:
                                kc_admin.delete_realm(realm_name=realm_name)
                                logger.info(f"✅ Deleted old department-based realm: {realm_name}")
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


@sio.event  # type: ignore
async def keycloak_sync(sid: str, data: dict[str, Any]) -> None:
    """WebSocket event handler for manual Keycloak sync trigger."""
    logger.info(f"Keycloak sync requested via WebSocket from {sid}")
    department_id = data.get("department_id") if isinstance(data, dict) else None
    await sync_keycloak(department_id=department_id)


@internal_sio.on("keycloak_sync")
async def keycloak_sync_internal(data: dict[str, Any]) -> None:
    """Internal event handler for API-triggered Keycloak syncs."""
    logger.info("Keycloak sync requested via internal event")
    department_id = data.get("department_id") if isinstance(data, dict) else None
    await sync_keycloak(department_id=department_id)

