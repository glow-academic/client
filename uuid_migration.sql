
BEGIN;

-- 0) Needed for uuid v5 (deterministic)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Helper: strict RFC-4122 UUID check (version 1-8; variant 8|9|a|b)
CREATE OR REPLACE FUNCTION is_rfc4122_uuid(u uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    -- version nibble = 1-8
    substring(u::text FROM 15 FOR 1) ~ '^[1-8]$'
    AND
    -- variant nibble = 8|9|a|b (at position 20)
    substring(u::text FROM 20 FOR 1) ~ '^[89abAB]$';
$$;

-- 2) Mapping table (bad -> good), deterministic v5 using constant namespace
DROP TABLE IF EXISTS uuid_migration_map;
CREATE TEMP TABLE uuid_migration_map (
  table_name text NOT NULL,
  old_uuid   uuid NOT NULL,
  new_uuid   uuid NOT NULL,
  PRIMARY KEY (table_name, old_uuid)
);

-- 3) Collect all UUID primary keys that are non-RFC and build mapping using PL/pgSQL
DO $$
DECLARE
  ns uuid := '11111111-2222-4333-aaaa-555555555555'::uuid;
  r RECORD;
  bad_uuid uuid;
BEGIN
  FOR r IN
    -- find all (table, pk column) where pk column data type is uuid
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema   = tc.table_schema
     AND kcu.table_name     = tc.table_name
    JOIN information_schema.columns col
      ON col.table_schema = tc.table_schema
     AND col.table_name   = tc.table_name
     AND col.column_name  = kcu.column_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND col.data_type = 'uuid'
      AND tc.table_schema = 'public'
  LOOP
    -- scan each table for bad UUIDs
    FOR bad_uuid IN
      EXECUTE format('SELECT %I FROM %I.%I WHERE NOT is_rfc4122_uuid(%I)',
                     r.column_name, r.table_schema, r.table_name, r.column_name)
    LOOP
      INSERT INTO uuid_migration_map(table_name, old_uuid, new_uuid)
      VALUES (r.table_name, bad_uuid, uuid_generate_v5(ns, bad_uuid::text))
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END$$;

-- If nothing to fix, bail out early
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM uuid_migration_map) THEN
    RAISE NOTICE 'No non-RFC UUIDs found. Skipping.';
  END IF;
END$$;

-- 4) Rebuild FK constraints to ON UPDATE CASCADE so PK changes propagate
-- We must drop/recreate to change the action.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      con.oid                         AS con_oid,
      con.conname                     AS conname,
      nsp.nspname                     AS schema_name,
      rel.relname                     AS table_name,
      pg_get_constraintdef(con.oid)   AS condef
    FROM pg_constraint con
    JOIN pg_class rel       ON rel.oid = con.conrelid
    JOIN pg_namespace nsp   ON nsp.oid = rel.relnamespace
    WHERE con.contype = 'f'
  LOOP
    -- Only touch FKs that do NOT already contain ON UPDATE CASCADE
    IF position('ON UPDATE CASCADE' IN r.condef) = 0 THEN
      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                     r.schema_name, r.table_name, r.conname);
      -- Recreate with ON UPDATE CASCADE, preserving other parts of the definition
      EXECUTE format(
        'ALTER TABLE %I.%I ADD CONSTRAINT %I %s ON UPDATE CASCADE',
        r.schema_name, r.table_name, r.conname, regexp_replace(r.condef, '\sON UPDATE [A-Z]+\s?', ' ', 'gi')
      );
    END IF;
  END LOOP;
END$$;

-- 5) Update PK ids using the mapping
DO $$
DECLARE
  t RECORD;
  pkcol text;
BEGIN
  FOR t IN
    SELECT DISTINCT table_name FROM uuid_migration_map
  LOOP
    -- find pk column name for that table
    SELECT kcu.column_name INTO pkcol
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema   = tc.table_schema
     AND kcu.table_name     = tc.table_name
    JOIN information_schema.columns col
      ON col.table_schema = tc.table_schema
     AND col.table_name   = tc.table_name
     AND col.column_name  = kcu.column_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND col.data_type = 'uuid'
      AND tc.table_name = t.table_name
    LIMIT 1;

    IF pkcol IS NOT NULL THEN
      EXECUTE format(
        'UPDATE %I SET %I = m.new_uuid
         FROM uuid_migration_map m
         WHERE %I = m.old_uuid
           AND m.table_name = %L',
        t.table_name, pkcol, pkcol, t.table_name
      );
    END IF;
  END LOOP;
END$$;

-- 6) Fix all uuid[] columns that may contain old values
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE udt_name = '_uuid'  -- uuid[]
  LOOP
    EXECUTE format(
      $SQL$
      UPDATE %I.%I AS t
      SET %I = (
        SELECT COALESCE(array_agg(COALESCE(m.new_uuid, v)), '{}')
        FROM unnest(t.%I) AS v
        LEFT JOIN uuid_migration_map m ON m.old_uuid = v
      )
      WHERE EXISTS (
        SELECT 1 FROM unnest(t.%I) AS v
        JOIN uuid_migration_map m ON m.old_uuid = v
      );
      $SQL$,
      r.table_schema, r.table_name, r.column_name, r.column_name, r.column_name
    );
  END LOOP;
END$$;

-- 7) (Optional) Fix JSONB columns if you store UUIDs there (needs app-specific logic)

COMMIT;

-- Sanity: show what changed
TABLE uuid_migration_map;