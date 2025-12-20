-- audit/init.sql  (normal-user safe)
CREATE SCHEMA IF NOT EXISTS audit;

-- Row change journal -------------------------------------------------
CREATE TABLE IF NOT EXISTS audit.row_changes (
  id            UUID PRIMARY KEY DEFAULT uuidv7(),
  table_name    text NOT NULL,
  op            text NOT NULL,                 -- INSERT | UPDATE | DELETE
  changed_at    timestamptz NOT NULL DEFAULT now(),
  changed_by    text DEFAULT current_user,
  pk            jsonb,                         -- primary-key as jsonb
  old_row       jsonb,
  new_row       jsonb
);

CREATE INDEX IF NOT EXISTS row_changes_changed_at_idx ON audit.row_changes (changed_at DESC);
CREATE INDEX IF NOT EXISTS row_changes_table_op_idx    ON audit.row_changes (table_name, op);

-- Trigger fn
CREATE OR REPLACE FUNCTION audit.log_row_change() RETURNS trigger AS $$
DECLARE
  pk_json   jsonb := '{}'::jsonb;
  col_name  text;
  col_val   jsonb;
  i         int;
  src_rec   record;
BEGIN
  src_rec := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  IF TG_NARGS > 0 THEN
    FOR i IN 0..TG_NARGS-1 LOOP
      col_name := TG_ARGV[i];
      EXECUTE format('SELECT to_jsonb(($1).%I)', col_name) INTO col_val USING src_rec;
      pk_json := pk_json || jsonb_build_object(col_name, col_val);
    END LOOP;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit.row_changes(table_name, op, pk, new_row)
    VALUES (TG_TABLE_NAME, TG_OP, NULLIF(pk_json,'{}'::jsonb), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit.row_changes(table_name, op, pk, old_row, new_row)
    VALUES (TG_TABLE_NAME, TG_OP, NULLIF(pk_json,'{}'::jsonb), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE -- DELETE
    INSERT INTO audit.row_changes(table_name, op, pk, old_row)
    VALUES (TG_TABLE_NAME, TG_OP, NULLIF(pk_json,'{}'::jsonb), to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Per-table installer
CREATE OR REPLACE FUNCTION audit.ensure_row_trigger(sch text, tbl text) RETURNS void AS $$
DECLARE
  pk_cols text[];
  args text;
  trig_name text;
BEGIN
  SELECT array_agg(a.attname ORDER BY a.attnum) INTO pk_cols
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE i.indrelid = format('%I.%I', sch, tbl)::regclass
    AND i.indisprimary;

  IF pk_cols IS NULL THEN
    RAISE NOTICE 'audit: %.% has no PK; skipping row trigger', sch, tbl;
    RETURN;
  END IF;

  trig_name := format('trg_audit_%s', tbl);
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I;', trig_name, sch, tbl);

  SELECT string_agg(quote_literal(c), ', ') INTO args FROM unnest(pk_cols) AS c;

  EXECUTE format(
    'CREATE TRIGGER %I
       AFTER INSERT OR UPDATE OR DELETE ON %I.%I
       FOR EACH ROW EXECUTE FUNCTION audit.log_row_change(%s);',
    trig_name, sch, tbl, args
  );
END;
$$ LANGUAGE plpgsql;

-- Bulk installer for current schema (run it after tables exist/migrate)
CREATE OR REPLACE FUNCTION audit.install_row_triggers() RETURNS void AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    PERFORM audit.ensure_row_trigger(r.sch, r.tbl);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run once now (safe if no tables yet; re-run after migrations)
SELECT audit.install_row_triggers();

-- Notify on new audit rows (for your streaming logs)
CREATE OR REPLACE FUNCTION audit.notify_row_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('audit_events',
    json_build_object(
      'ts', NEW.changed_at,
      'op', NEW.op,
      'table', NEW.table_name,
      'pk', coalesce(NEW.pk::text,'{}')
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_notify_row_change ON audit.row_changes;
CREATE TRIGGER trg_audit_notify_row_change
AFTER INSERT ON audit.row_changes
FOR EACH ROW EXECUTE FUNCTION audit.notify_row_change();
