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

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(
                f"Attempting to connect to Keycloak (attempt {attempt}/{max_retries})..."
            )

            # Disable SSL verification for non-production environments
            is_prod = not is_local_dev
            verify_ssl = is_prod  # Only verify SSL in production

            kc_admin = KeycloakAdmin(
                server_url=f"{url}/",
                username=admin,
                password=password,
                realm_name="master",
                verify=verify_ssl,
            )
            # Test the connection by getting realms
            kc_admin.get_realms()
            logger.info("✅ Successfully connected to Keycloak")

            # Fix master realm SSL requirement for local development (fallback)
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
            if attempt < max_retries:
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


async def sync_keycloak() -> None:
    """Sync Keycloak identity providers from database to Keycloak."""
    pool = get_pool()
    if not pool:
        logger.warning("Database pool not available, skipping Keycloak sync")
        return

    try:
        # Keycloak sync configuration
        # Construct Keycloak URL: if KEYCLOAK_URL is explicitly set, use it;
        # otherwise, construct from APP_PREFIX to match Makefile configuration
        app_prefix = os.getenv("APP_PREFIX", "")
        explicit_keycloak_url = os.getenv("KEYCLOAK_URL")

        if explicit_keycloak_url:
            keycloak_url = explicit_keycloak_url.rstrip("/")
        else:
            # In Docker, use internal service name; otherwise use localhost for local dev
            docker_env = os.getenv("DOCKER_ENV")
            keycloak_internal_url = os.getenv("KEYCLOAK_INTERNAL_URL")

            if keycloak_internal_url:
                base_url = keycloak_internal_url.rstrip("/")
            elif docker_env:
                # Docker environment: use service name
                base_url = "http://keycloak:8080"
            else:
                # Local dev: use localhost
                base_url = "http://localhost:8080"

            keycloak_url = f"{base_url}{app_prefix}/auth"

        keycloak_admin = os.getenv("KEYCLOAK_ADMIN", "admin")
        keycloak_admin_password = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")
        keycloak_realm = os.getenv("KEYCLOAK_REALM", "glow")

        # For local dev, ensure master realm SSL requirement is set to NONE in database
        # This must be done BEFORE attempting to connect via HTTP
        origin_check = os.getenv("ORIGIN", "http://localhost:3000")
        is_local_dev = "localhost" in origin_check.lower()

        if is_local_dev and pool:
            try:
                async with pool.acquire() as conn:
                    # Update master realm SSL requirement directly in database
                    await conn.execute(
                        "UPDATE keycloak.realm SET ssl_required = 'NONE' WHERE name = 'master'"
                    )
                    logger.info("✅ Set master realm SSL requirement to NONE in database")
            except Exception as e:
                logger.warning(f"Could not update master realm SSL in database: {e}")

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
            # Check if ORIGIN contains localhost (dev) vs real domain (prod)
            origin_check = os.getenv("ORIGIN", "http://localhost:3000")
            is_local_dev = "localhost" in origin_check.lower()

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

        # Ensure the target realm exists (create if it doesn't)
        # Get bootstrap leader identifier (hostname/container id)
        bootstrap_leader = socket.gethostname() or os.getenv("HOSTNAME", "unknown")
        try:
            realms = kc_admin.get_realms()
            realm_exists = any(r["realm"] == keycloak_realm for r in realms)

            if not realm_exists:
                logger.info(
                    f"[{bootstrap_leader}] Creating Keycloak realm: {keycloak_realm}"
                )
                try:
                    kc_admin.create_realm(
                        payload={"realm": keycloak_realm, "enabled": True},
                        skip_exists=True,
                    )
                    logger.info(f"✅ Realm '{keycloak_realm}' created")
                except Exception as e:
                    # Race condition: another server may have created the realm
                    # Handle KeyError (missing Location header), HTTP 409 Conflict, or duplicate key errors
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
                            f"⚠️  [{bootstrap_leader}] Realm '{keycloak_realm}' may have been created by another server, re-checking..."
                        )
                        # Re-check if realm now exists
                        realms = kc_admin.get_realms()
                        realm_exists_now = any(
                            r["realm"] == keycloak_realm for r in realms
                        )

                        if realm_exists_now:
                            logger.info(f"✅ Realm '{keycloak_realm}' now exists")
                        else:
                            logger.warning(
                                "⚠️  Realm creation conflict but realm not found on re-check"
                            )
                    else:
                        raise
            else:
                logger.info(f"✅ Realm '{keycloak_realm}' already exists")
        except Exception as e:
            logger.error(f"Failed to ensure realm exists: {e}", exc_info=True)
            kc_admin = None

        if kc_admin:
            # Switch to target realm
            kc_admin.change_current_realm(realm_name=keycloak_realm)

            # Fix realm settings for local development
            try:
                realm_details = kc_admin.get_realm(keycloak_realm)
                attributes = realm_details.get("attributes", {})
                current_frontend_url = attributes.get("frontendUrl", "")
                current_ssl_required = realm_details.get("sslRequired", "EXTERNAL")

                # Check if ORIGIN contains localhost (dev) vs real domain (prod)
                origin_check = os.getenv("ORIGIN", "http://localhost:3000")
                is_local_dev = "localhost" in origin_check.lower()

                needs_update = False
                update_payload: dict[str, Any] = {}

                # Fix frontend URL if needed
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

                # Disable SSL requirement for local development
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
                        realm_name=keycloak_realm, payload=update_payload
                    )
                    logger.info("✅ Realm settings updated")
                else:
                    logger.info("✅ Realm settings are already correct")
            except Exception as e:
                logger.warning(f"Could not update realm settings: {e}. Continuing...")

            # Setup Next.js client with pre-shared secret
            target_client_id = os.getenv("AUTH_KEYCLOAK_ID", "glow-client")
            target_secret: str | None = os.getenv("AUTH_KEYCLOAK_SECRET")
            client_port = os.getenv("CLIENT_PORT", "3000")

            if not target_secret:
                logger.warning(
                    "⚠️  AUTH_KEYCLOAK_SECRET is missing. Cannot enforce DHH-style auth."
                )
            else:
                try:
                    # Build redirect URIs using ORIGIN (respects nginx/APP_PREFIX)
                    origin = os.getenv("ORIGIN", f"http://localhost:{client_port}")
                    base_url = origin.rstrip("/")
                    redirect_uri = (
                        f"{base_url}{app_prefix}/api/auth/callback/keycloak"
                    )
                    redirect_uris = [redirect_uri, f"{base_url}{app_prefix}/*"]

                    # Check if client exists
                    clients = kc_admin.get_clients()
                    existing_client = next(
                        (
                            c
                            for c in clients
                            if c.get("clientId") == target_client_id
                        ),
                        None,
                    )

                    # Client payload with pre-shared secret
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
                                # Handle race condition: another server may have updated/deleted the client
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
                                    # Re-check if client still exists
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
                            # Race condition: another server created the client between our check and create
                            # Handle KeyError (missing Location header), HTTP 409 Conflict, or duplicate key errors
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
                                # Re-check if client now exists
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

            # Sync all active identity providers from database
            async with pool.acquire() as conn:
                # Load providers using SQL file
                providers_sql = load_sql(
                    "sql/v3/keycloak/get_auth_providers_complete.sql"
                )
                providers = await conn.fetch(providers_sql)

                if not providers:
                    logger.info(
                        "No active providers found in database, skipping sync"
                    )
                else:
                    # Load items SQL file
                    items_sql = load_sql(
                        "sql/v3/keycloak/get_auth_items_complete.sql"
                    )

                    # Loop through each active provider
                    for p in providers:
                        auth_id = p["id"]
                        slug = p["slug"]
                        provider_id = p["provider_id"]
                        display_name = p["name"]

                        items = await conn.fetch(items_sql, auth_id)

                        # Decrypt or use plain text based on encrypted flag
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

                        # Construct Payload
                        payload: dict[str, Any] = {
                            "alias": slug,
                            "providerId": provider_id,
                            "displayName": display_name,
                            "enabled": True,
                            "trustEmail": True,
                            "config": {},
                        }

                        # SAML Provider Configuration
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
                            # OIDC/Google Provider Configuration
                            payload["config"] = config_map
                            if "syncMode" not in payload["config"]:
                                payload["config"]["syncMode"] = "FORCE"
                            if "useJwksUrl" not in payload["config"]:
                                payload["config"]["useJwksUrl"] = "true"

                        logger.info(
                            f"🔍 Payload for {slug}: {payload['config']}"
                        )

                        # Upsert the provider in Keycloak (idempotent)
                        try:
                            kc_admin.get_idp(idp_alias=slug)
                            # Provider exists, update it
                            try:
                                kc_admin.update_idp(
                                    idp_alias=slug, payload=payload
                                )
                                logger.info(f"✅ Synced Keycloak provider: {slug}")
                            except Exception as update_e:
                                # Handle update conflicts (race condition)
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
                            # Provider doesn't exist, try to create it
                            try:
                                kc_admin.create_idp(payload=payload)
                                logger.info(f"✅ Created Keycloak provider: {slug}")
                            except Exception as create_e:
                                # Handle create conflicts (race condition: another server created it)
                                error_str = str(create_e).lower()
                                if (
                                    "409" in error_str
                                    or "conflict" in error_str
                                    or "already exists" in error_str
                                ):
                                    logger.info(
                                        f"⚠️  [{bootstrap_leader}] Provider '{slug}' was created by another server, updating instead..."
                                    )
                                    # Re-check and update
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

        logger.info("Keycloak sync completed")
    except Exception as e:
        logger.warning(f"Keycloak sync failed (non-blocking): {e}", exc_info=True)


@sio.event  # type: ignore
async def keycloak_sync(sid: str, data: dict[str, Any]) -> None:
    """WebSocket event handler for manual Keycloak sync trigger."""
    logger.info(f"Keycloak sync requested via WebSocket from {sid}")
    await sync_keycloak()


@internal_sio.on("keycloak_sync")
async def keycloak_sync_internal(data: dict[str, Any]) -> None:
    """Internal event handler for API-triggered Keycloak syncs."""
    logger.info("Keycloak sync requested via internal event")
    await sync_keycloak()

