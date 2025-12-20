-- Keycloak Schema Initialization
-- Creates the keycloak schema and grants necessary permissions to the database user
-- This ensures the schema exists in all database backups and fresh initializations

-- ============================================================================
-- SCHEMA CREATION
-- ============================================================================

-- Create keycloak schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS keycloak;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant USAGE and CREATE on the schema to the current database user
-- This allows Keycloak to create tables and other objects in the schema
GRANT USAGE, CREATE ON SCHEMA keycloak TO CURRENT_USER;

-- Set default privileges for tables in the keycloak schema
-- This ensures Keycloak can manage all tables it creates
ALTER DEFAULT PRIVILEGES IN SCHEMA keycloak
  GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLES TO CURRENT_USER;

-- Set default privileges for sequences in the keycloak schema
-- This ensures Keycloak can use sequences for auto-incrementing IDs
ALTER DEFAULT PRIVILEGES IN SCHEMA keycloak
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO CURRENT_USER;

