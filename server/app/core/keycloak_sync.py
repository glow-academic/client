"""Keycloak sync module - syncs identity providers from database to Keycloak."""

import asyncio
import logging
import os
from typing import Any

import asyncpg  # type: ignore
from app.utils.auth.decrypt_api_key import decrypt_api_key
from app.utils.sql_helper import load_sql

from keycloak import KeycloakAdmin  # type: ignore

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 10
INITIAL_RETRY_DELAY = 2.0  # seconds
MAX_RETRY_DELAY = 30.0  # seconds


async def wait_for_keycloak(
    keycloak_url: str,
    keycloak_admin: str,
    keycloak_admin_password: str,
    max_retries: int = MAX_RETRIES,
) -> KeycloakAdmin | None:
    """
    Wait for Keycloak to be ready and return a connected KeycloakAdmin instance.
    
    Uses exponential backoff to retry connection attempts.
    """
    retry_delay = INITIAL_RETRY_DELAY
    
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(
                f"Attempting to connect to Keycloak (attempt {attempt}/{max_retries})..."
            )
            kc_admin = KeycloakAdmin(
                server_url=f"{keycloak_url}/",
                username=keycloak_admin,
                password=keycloak_admin_password,
                realm_name="master",
                verify=True,
            )
            # Test the connection by getting realms
            kc_admin.get_realms()
            logger.info("✅ Successfully connected to Keycloak")
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


async def sync_identity_providers(pool: asyncpg.Pool | None) -> None:
    """
    Sync identity providers from database auth/auth_items tables to Keycloak.
    
    Loops through all active providers in the database, decrypts values,
    and creates/updates each provider in Keycloak.
    """
    if not pool:
        logger.warning("Database pool not available, skipping Keycloak sync")
        return

    try:
        # Get Keycloak configuration from environment
        keycloak_url = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
        keycloak_admin = os.getenv("KEYCLOAK_ADMIN", "admin")
        keycloak_admin_password = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")
        keycloak_realm = os.getenv("KEYCLOAK_REALM", "glow")

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

        # Ensure the target realm exists (create if it doesn't)
        try:
            realms = kc_admin.get_realms()
            realm_exists = any(r["realm"] == keycloak_realm for r in realms)
            if not realm_exists:
                logger.info(f"Creating Keycloak realm: {keycloak_realm}")
                kc_admin.create_realm(
                    payload={
                        "realm": keycloak_realm,
                        "enabled": True,
                    },
                    skip_exists=True,
                )
                logger.info(f"✅ Realm '{keycloak_realm}' created")
            else:
                logger.info(f"✅ Realm '{keycloak_realm}' already exists")
        except Exception as e:
            logger.error(f"Failed to ensure realm exists: {e}", exc_info=True)
            return

        # Switch to target realm
        kc_admin.change_current_realm(realm_name=keycloak_realm)

        # Setup Next.js client with pre-shared secret (DHH-style)
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
                # Build redirect URIs
                base_url = f"http://localhost:{client_port}"
                
                # Single callback URL - all providers use the same Keycloak callback
                redirect_uri = f"{base_url}{app_prefix}/api/auth/callback/keycloak"
                redirect_uris = [redirect_uri]

                # Check if client exists
                clients = kc_admin.get_clients()
                existing_client = next(
                    (c for c in clients if c.get("clientId") == target_client_id), None
                )

                # Client payload with pre-shared secret
                client_payload: dict[str, Any] = {
                    "clientId": target_client_id,
                    "name": "Glow App",
                    "rootUrl": base_url,
                    "baseUrl": base_url,
                    "redirectUris": redirect_uris,
                    "webOrigins": ["+"],  # Allow all origins (CORS)
                    "enabled": True,
                    "publicClient": False,  # MUST be False to have a secret
                    "protocol": "openid-connect",
                    "standardFlowEnabled": True,
                    "directAccessGrantsEnabled": True,
                    "serviceAccountsEnabled": True,
                    "clientAuthenticatorType": "client-secret",
                    "secret": target_secret,  # Pre-shared secret from .env
                }

                if existing_client:
                    # Update existing client
                    client_uuid = existing_client.get("id")
                    if client_uuid:
                        kc_admin.update_client(
                            client_id=client_uuid, payload=client_payload
                        )
                        logger.info(f"✅ Client '{target_client_id}' updated")
                    else:
                        logger.warning(
                            f"⚠️  Client '{target_client_id}' exists but has no ID"
                        )
                else:
                    # Create new client
                    new_client_uuid = kc_admin.create_client(
                        payload=client_payload, skip_exists=True
                    )
                    logger.info(f"✅ Client '{target_client_id}' created")

                    # 🛡️ SAFETY FORCE: Some Keycloak versions ignore the secret on 'create'.
                    # Force-update the secret immediately after creation to ensure it's set.
                    if new_client_uuid:
                        kc_admin.update_client(
                            client_id=new_client_uuid, payload={"secret": target_secret}
                        )
                        logger.info(
                            f"✅ Client Secret enforced for '{target_client_id}'"
                        )

            except Exception as e:
                logger.error(f"❌ Client sync failed: {e}", exc_info=True)

        # Sync all active identity providers from database
        async with pool.acquire() as conn:
            # 1. Fetch generic definition (Configuration-Driven Pattern)
            providers_query = """
                SELECT id, slug, provider_id, name 
                FROM auth 
                WHERE active = true
            """
            providers = await conn.fetch(providers_query)

            if not providers:
                logger.info("No active providers found in database, skipping sync")
                return

            # Loop through each active provider
            for p in providers:
                auth_id = p["id"]
                slug = p["slug"]
                provider_id = p["provider_id"]
                display_name = p["name"]

                # 2. Fetch config map (No transformation needed - DB keys are already camelCase)
                items_query = """
                    SELECT name, value, encrypted 
                    FROM auth_items 
                    WHERE auth_id = $1
                """
                items = await conn.fetch(items_query, auth_id)

                # Decrypt or use plain text based on encrypted flag (with fallback)
                config_map: dict[str, str] = {}
                for item in items:
                    item_name = item["name"]
                    raw_value = item["value"]
                    is_encrypted = item.get("encrypted", True)  # Default to True if flag missing
                    
                    if is_encrypted:
                        # Decrypt encrypted values (secrets)
                        try:
                            decrypted_value = decrypt_api_key(raw_value)
                            config_map[item_name] = decrypted_value
                        except Exception as e:
                            # Fallback: If decryption fails, assume it's plain text (extra safety)
                            logger.warning(
                                f"Failed to decrypt auth_item '{item_name}' for provider '{slug}': {e}. "
                                f"Using as plain text."
                            )
                            config_map[item_name] = raw_value
                    else:
                        # Use plain text values as-is (public config like URLs, identifiers)
                        config_map[item_name] = raw_value

                # 3. Construct Payload (Provider-Specific Configuration)
                payload: dict[str, Any] = {
                    "alias": slug,              # e.g., "microsoft"
                    "providerId": provider_id,   # e.g., "oidc" or "saml"
                    "displayName": display_name, # e.g., "Microsoft Entra"
                    "enabled": True,
                    "trustEmail": True,
                    "config": {}                # Will be populated below
                }

                # --- SAML Provider Configuration ---
                if provider_id == "saml":
                    # Map database keys to Keycloak SAML config keys
                    if "ssoUrl" in config_map:
                        payload["config"]["singleSignOnServiceUrl"] = config_map["ssoUrl"]
                    
                    if "entityId" in config_map:
                        payload["config"]["entityId"] = config_map["entityId"]
                    
                    # Metadata URL - Keycloak can import config from metadata
                    if "metadataUrl" in config_map:
                        # Keycloak supports importing from metadata URL
                        # Note: Some Keycloak versions may require this to be set during creation
                        payload["config"]["importFromIdpUrl"] = config_map["metadataUrl"]
                    
                    # Certificate (if provided and not using metadata)
                    if "certificate" in config_map:
                        payload["config"]["signingCertificate"] = config_map["certificate"]
                    
                    # SAML-specific defaults
                    if "nameIDPolicyFormat" not in payload["config"]:
                        payload["config"]["nameIDPolicyFormat"] = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
                    
                    if "syncMode" not in payload["config"]:
                        payload["config"]["syncMode"] = "FORCE"
                    
                    if "allowCreate" not in payload["config"]:
                        payload["config"]["allowCreate"] = "true"
                
                # --- OIDC/Google Provider Configuration (Default) ---
                else:
                    # Pass config_map straight through for OIDC/Google
                    payload["config"] = config_map
                    
                    # Force specific defaults if missing in DB
                    if "syncMode" not in payload["config"]:
                        payload["config"]["syncMode"] = "FORCE"
                    if "useJwksUrl" not in payload["config"]:
                        payload["config"]["useJwksUrl"] = "true"

                # 🔍 DEBUG: Print the config we are about to send
                logger.info(f"🔍 Payload for {slug}: {payload['config']}")

                # 4. Upsert (Create or Update) the provider in Keycloak
                try:
                    # Try to fetch existing provider
                    kc_admin.get_idp(idp_alias=slug)
                    # If successful, update it
                    kc_admin.update_idp(idp_alias=slug, payload=payload)
                    logger.info(f"✅ Synced Keycloak provider: {slug}")
                except Exception:
                    # If not found, create it
                    kc_admin.create_idp(payload=payload)
                    logger.info(f"✅ Created Keycloak provider: {slug}")

    except Exception as e:
        logger.error(f"❌ Failed to sync Keycloak providers: {e}", exc_info=True)
        # Don't raise - allow server to continue even if Keycloak sync fails

