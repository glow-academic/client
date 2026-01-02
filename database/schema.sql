--
-- PostgreSQL database dump
--

\restrict hL2lcalDptoT8Gu9AFWQPx2foVy0FIRueoyGzziXPE3lnvxWAgUFj2PTxwG7gkB

-- Dumped from database version 18.1 (Homebrew)
-- Dumped by pg_dump version 18.1 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: audit; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA audit;


--
-- Name: types; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA types;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: agent_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agent_role AS ENUM (
    'classify',
    'grade',
    'hint',
    'scenario',
    'title',
    'image',
    'video',
    'simulation',
    'voice',
    'document',
    'audio',
    'member',
    'rubric'
);


--
-- Name: draft_resource_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.draft_resource_type AS ENUM (
    'cohorts',
    'simulations',
    'scenarios',
    'personas',
    'staff',
    'documents',
    'parameters',
    'fields',
    'agents',
    'models',
    'rubrics',
    'evals',
    'departments',
    'providers',
    'auth',
    'keys',
    'practice',
    'benchmark',
    'settings'
);


--
-- Name: feedback_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.feedback_type AS ENUM (
    'feature',
    'bug',
    'question',
    'other'
);


--
-- Name: message_feedback_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_feedback_type AS ENUM (
    'strength',
    'improvement'
);


--
-- Name: message_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_role AS ENUM (
    'user',
    'assistant',
    'system',
    'developer'
);


--
-- Name: modality_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.modality_type AS ENUM (
    'text',
    'video',
    'audio',
    'image'
);


--
-- Name: option_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.option_type AS ENUM (
    'discrete',
    'freeform'
);


--
-- Name: pricing_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pricing_type AS ENUM (
    'input',
    'output',
    'cached'
);


--
-- Name: profile_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.profile_role AS ENUM (
    'superadmin',
    'admin',
    'instructional',
    'member',
    'guest'
);


--
-- Name: quality; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quality AS ENUM (
    'low',
    'medium',
    'high'
);


--
-- Name: reasoning_effort; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reasoning_effort AS ENUM (
    'minimal',
    'low',
    'medium',
    'high',
    'none'
);


--
-- Name: tool_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tool_type AS ENUM (
    'audio',
    'classification',
    'conversation',
    'debug',
    'document',
    'grade',
    'hint',
    'image',
    'improvement',
    'objective',
    'question',
    'rubric',
    'speak',
    'statement',
    'strength',
    'title',
    'video'
);


--
-- Name: unit_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unit_category AS ENUM (
    'tokens',
    'seconds',
    'units'
);


--
-- Name: voice; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.voice AS ENUM (
    'alloy',
    'ash',
    'ballad',
    'coral',
    'echo',
    'fable',
    'onyx',
    'nova',
    'sage',
    'shimmer',
    'verse'
);


--
-- Name: ensure_row_trigger(text, text); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.ensure_row_trigger(sch text, tbl text) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: install_row_triggers(); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.install_row_triggers() RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: log_row_change(); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.log_row_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
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
$_$;


--
-- Name: notify_row_change(); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.notify_row_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: api_patch_persona_draft_v4(uuid, uuid, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.api_patch_persona_draft_v4(p_draft_id uuid, p_profile_id uuid, p_patch jsonb, p_expected_version integer) RETURNS TABLE(draft_id uuid, new_version integer, draft_exists boolean)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_draft_id uuid;
    v_new_version int;
BEGIN
    -- If draft_id provided, try to patch existing draft
    IF p_draft_id IS NOT NULL THEN
        UPDATE drafts
        SET
            payload = drafts.payload || p_patch,
            version = drafts.version + 1,
            updated_at = now()
        WHERE
            drafts.id = p_draft_id
            AND drafts.profile_id = p_profile_id
            AND drafts.version = p_expected_version
        RETURNING drafts.id, drafts.version INTO v_draft_id, v_new_version;
        
        -- If update succeeded, return result
        IF v_draft_id IS NOT NULL THEN
            RETURN QUERY SELECT v_draft_id, v_new_version, true;
            RETURN;
        END IF;
    END IF;
    
    -- If no draft_id or update failed (version mismatch), create new draft
    WITH defaults AS (
        SELECT jsonb_build_object(
            'name', '',
            'description', '',
            'active', true,
            'color', '#3B82F6',
            'icon', 'Sparkles',
            'instructions', '',
            'department_ids', jsonb_build_array(),
            'example_ids', jsonb_build_array()
        ) AS d
    ),
    payload AS (
        SELECT (d || p_patch) AS p
        FROM defaults
    )
    INSERT INTO drafts(resource_type, profile_id, payload)
    SELECT 'personas'::draft_resource_type, p_profile_id, p
    FROM payload
    RETURNING id, version INTO v_draft_id, v_new_version;
    
    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;


--
-- Name: gen_trace_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_trace_id() RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN 'trace_' || REPLACE(gen_random_uuid()::text, '-', '');
END;
$$;


--
-- Name: is_rfc4122_uuid(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_rfc4122_uuid(u uuid) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
  SELECT
    -- version nibble = 1-8
    substring(u::text FROM 15 FOR 1) ~ '^[1-8]$'
    AND
    -- variant nibble = 8|9|a|b (at position 20)
    substring(u::text FROM 20 FOR 1) ~ '^[89abAB]$';
$_$;


--
-- Name: message_content_hash(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.message_content_hash(content_text text, role_text text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT MD5(content_text || '|' || role_text);
$$;


--
-- Name: message_is_conversation_message(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.message_is_conversation_message(message_id uuid) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM messages m 
        WHERE m.id = message_id 
        AND m.role IN ('user', 'assistant')
    );
END;
$$;


--
-- Name: safe_jsonb_parse(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.safe_jsonb_parse(input_text text) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    -- If input is NULL or empty, return NULL
    IF input_text IS NULL OR trim(input_text) = '' THEN
        RETURN NULL;
    END IF;
    
    -- Try to parse as JSONB
    BEGIN
        RETURN input_text::jsonb;
    EXCEPTION
        WHEN OTHERS THEN
            -- Return NULL if parsing fails (invalid JSON)
            RETURN NULL;
    END;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: validate_department_create_permissions(text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_department_create_permissions(p_user_role text, p_department_ids text[]) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Non-superadmins cannot create general objects (empty department_ids)
    IF p_user_role != 'superadmin' AND COALESCE(array_length(p_department_ids, 1), 0) = 0 THEN
        RAISE EXCEPTION 'DEPARTMENT_PERMISSION_DENIED: Non-superadmins cannot create general objects';
    END IF;
    RETURN TRUE;
END;
$$;


--
-- Name: validate_department_update_permissions(text, text[], text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_department_update_permissions(p_user_role text, p_object_department_ids text[], p_user_department_ids text[]) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Non-superadmins cannot modify general objects (no department links)
    IF p_user_role != 'superadmin' AND COALESCE(array_length(p_object_department_ids, 1), 0) = 0 THEN
        RAISE EXCEPTION 'DEPARTMENT_PERMISSION_DENIED: Non-superadmins cannot modify general objects';
    END IF;
    
    -- Non-superadmins must belong to ALL object's departments
    IF p_user_role != 'superadmin' AND COALESCE(array_length(p_object_department_ids, 1), 0) > 0 THEN
        IF NOT (
            SELECT bool_and(dept_id = ANY(p_user_department_ids))
            FROM UNNEST(p_object_department_ids) as dept_id
        ) THEN
            RAISE EXCEPTION 'DEPARTMENT_PERMISSION_DENIED: User must belong to all departments of this object to modify it';
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$;


--
-- Name: validate_rate_limit(integer, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_rate_limit(p_req_per_day integer, p_runs_today_count bigint) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF p_req_per_day IS NOT NULL AND p_runs_today_count >= p_req_per_day THEN
        RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Daily request limit of % reached. Please try again tomorrow.', p_req_per_day;
    END IF;
    RETURN TRUE;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: row_changes; Type: TABLE; Schema: audit; Owner: -
--

CREATE TABLE audit.row_changes (
    id_old bigint,
    table_name text NOT NULL,
    op text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by text DEFAULT CURRENT_USER,
    pk jsonb,
    old_row jsonb,
    new_row jsonb,
    id uuid DEFAULT uuidv7() CONSTRAINT row_changes_id_v7_not_null NOT NULL
);


--
-- Name: activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    message text NOT NULL,
    endpoint text NOT NULL,
    error boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT activity_id_v7_not_null NOT NULL,
    profile_id uuid
);


--
-- Name: agent_department_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_department_prompts (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_id uuid NOT NULL,
    department_id uuid NOT NULL,
    prompt_id uuid NOT NULL
);


--
-- Name: agent_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_id uuid NOT NULL,
    department_id uuid NOT NULL
);


--
-- Name: agent_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_prompts (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_id uuid NOT NULL,
    prompt_id uuid NOT NULL
);


--
-- Name: agent_reasoning_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_reasoning_levels (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_id uuid NOT NULL,
    model_reasoning_level_id uuid NOT NULL
);


--
-- Name: agent_temperature_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_temperature_levels (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_id uuid NOT NULL,
    model_temperature_level_id uuid NOT NULL
);


--
-- Name: agent_tools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_tools (
    agent_id uuid NOT NULL,
    tool_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_voices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_voices (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_id uuid NOT NULL,
    model_voice_id uuid NOT NULL
);


--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    role public.agent_role DEFAULT 'scenario'::public.agent_role NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT agents_id_v7_not_null NOT NULL,
    model_id uuid
);


--
-- Name: app_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_metrics (
    ts timestamp with time zone NOT NULL,
    requests_total bigint NOT NULL,
    errors_total bigint NOT NULL,
    avg_latency_ms double precision NOT NULL,
    cpu_percent double precision NOT NULL,
    memory_bytes bigint NOT NULL
);


--
-- Name: attempt_chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attempt_chats (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    chat_id uuid NOT NULL,
    attempt_id uuid NOT NULL
);


--
-- Name: attempt_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attempt_profiles (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    profile_id uuid NOT NULL,
    attempt_id uuid NOT NULL
);


--
-- Name: attempt_quizzes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attempt_quizzes (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    quiz_id uuid NOT NULL,
    attempt_id uuid NOT NULL
);


--
-- Name: attempt_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attempt_tests (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    attempt_id uuid NOT NULL,
    test_id uuid NOT NULL
);


--
-- Name: auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    auth_type text NOT NULL,
    slug text NOT NULL,
    icon_url text DEFAULT ''::text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT auth_id_v7_not_null NOT NULL
);


--
-- Name: auth_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_items (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    encrypted boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT auth_items_id_v7_not_null NOT NULL,
    auth_id uuid
);


--
-- Name: chat_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_groups (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    chat_id uuid NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chats (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT chats_id_v7_not_null NOT NULL,
    scenario_id uuid
);


--
-- Name: cohort_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cohort_id uuid NOT NULL,
    department_id uuid NOT NULL
);


--
-- Name: cohort_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort_profiles (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cohort_id uuid NOT NULL,
    profile_id uuid NOT NULL
);


--
-- Name: cohort_simulations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort_simulations (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    cohort_id uuid NOT NULL,
    simulation_id uuid NOT NULL
);


--
-- Name: cohorts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohorts (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    description text DEFAULT 'No description provided'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT cohorts_id_v7_not_null NOT NULL
);


--
-- Name: debug_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.debug_info (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    content text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT debug_info_id_v7_not_null NOT NULL,
    run_id uuid
);


--
-- Name: department_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_settings (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    settings_id uuid NOT NULL
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT departments_id_v7_not_null NOT NULL
);


--
-- Name: document_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    document_id uuid NOT NULL
);


--
-- Name: document_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_fields (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    document_id uuid NOT NULL,
    field_id uuid NOT NULL
);


--
-- Name: TABLE document_fields; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_fields IS 'Links documents to parameter items, allowing documents to be filtered by parameter values.';


--
-- Name: document_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_groups (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    document_id uuid NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: document_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_templates (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    document_id uuid NOT NULL,
    template_id uuid NOT NULL
);


--
-- Name: document_tree; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_tree (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    child_id uuid NOT NULL,
    parent_id uuid NOT NULL
);


--
-- Name: document_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_uploads (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    document_id uuid NOT NULL,
    upload_id uuid NOT NULL
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    classified boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    template boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT documents_id_v7_not_null NOT NULL,
    document_agent_id uuid,
    classify_agent_id uuid
);


--
-- Name: drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_type public.draft_resource_type NOT NULL,
    profile_id uuid NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: eval_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_agents (
    eval_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: eval_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_attempts (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT eval_attempts_id_v7_not_null NOT NULL,
    eval_id uuid,
    infinite_mode boolean DEFAULT false NOT NULL
);


--
-- Name: eval_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    eval_id uuid NOT NULL
);


--
-- Name: eval_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_groups (
    eval_id uuid NOT NULL,
    group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: eval_groups_rubric_grade_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_groups_rubric_grade_agents (
    eval_id uuid NOT NULL,
    group_id uuid NOT NULL,
    rubric_grade_agent_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: eval_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_runs (
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    eval_id uuid NOT NULL,
    run_id uuid NOT NULL
);


--
-- Name: eval_runs_rubric_grade_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_runs_rubric_grade_agents (
    eval_id uuid NOT NULL,
    run_id uuid NOT NULL,
    rubric_grade_agent_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: evals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evals (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    dynamic boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT evals_id_v7_not_null NOT NULL,
    use_groups boolean DEFAULT false NOT NULL
);


--
-- Name: examples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.examples (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    example text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT examples_id_v7_not_null NOT NULL
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    type public.feedback_type NOT NULL,
    message text DEFAULT 'No message provided'::text NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT feedback_id_v7_not_null NOT NULL,
    profile_id uuid
);


--
-- Name: feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedbacks (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    total integer NOT NULL,
    feedback text DEFAULT 'No feedback provided'::text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT feedbacks_id_v7_not_null NOT NULL,
    grade_id uuid,
    standard_id uuid
);


--
-- Name: field_conditional_parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_conditional_parameters (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    field_id uuid NOT NULL,
    conditional_parameter_id uuid NOT NULL
);


--
-- Name: field_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    field_id uuid NOT NULL
);


--
-- Name: fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fields (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT fields_id_v7_not_null NOT NULL
);


--
-- Name: grade_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_groups (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    chat_id uuid NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: grades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grades (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text DEFAULT 'No description provided'::text NOT NULL,
    passed boolean NOT NULL,
    score integer NOT NULL,
    time_taken integer NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT grades_id_v7_not_null NOT NULL,
    run_id uuid,
    rubric_grade_agent_id uuid
);


--
-- Name: group_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_order (
    group_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    position_idx integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_runs (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    idx integer NOT NULL,
    group_id uuid NOT NULL,
    run_id uuid NOT NULL
);


--
-- Name: group_stop; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_stop (
    group_id uuid NOT NULL,
    tool_id uuid NOT NULL,
    position_idx integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT groups_id_v7_not_null NOT NULL,
    trace_id text DEFAULT public.gen_trace_id() NOT NULL
);


--
-- Name: image_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    image_id uuid NOT NULL
);


--
-- Name: image_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_uploads (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_id uuid NOT NULL,
    upload_id uuid NOT NULL
);


--
-- Name: images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.images (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT images_id_v7_not_null NOT NULL,
    tool_call_id uuid NOT NULL
);


--
-- Name: keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.keys (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    key text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT keys_id_v7_not_null NOT NULL
);


--
-- Name: message_audio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_audio (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    message_id uuid NOT NULL,
    upload_id uuid NOT NULL
);


--
-- Name: message_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_content (
    idx integer NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    message_id uuid,
    tool_call_id uuid NOT NULL,
    CONSTRAINT message_content_idx_check CHECK ((idx >= 0))
);


--
-- Name: message_feedback_highlight; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_feedback_highlight (
    idx integer NOT NULL,
    section text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    message_feedback_id uuid
);


--
-- Name: message_feedback_replace; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_feedback_replace (
    idx integer NOT NULL,
    section text NOT NULL,
    replace text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    message_feedback_id uuid
);


--
-- Name: message_feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_feedbacks (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text DEFAULT 'No description provided'::text NOT NULL,
    type public.message_feedback_type NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT message_feedbacks_id_v7_not_null NOT NULL,
    grade_id uuid,
    message_id uuid,
    tool_call_id uuid NOT NULL
);


--
-- Name: message_personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_personas (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    message_id uuid NOT NULL,
    persona_id uuid NOT NULL
);


--
-- Name: message_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_runs (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    message_id uuid NOT NULL,
    run_id uuid NOT NULL
);


--
-- Name: message_tree; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_tree (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_id uuid NOT NULL,
    child_id uuid NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    content text,
    role public.message_role NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    audio boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT messages_id_v7_not_null NOT NULL
);


--
-- Name: model_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    model_id uuid NOT NULL
);


--
-- Name: model_endpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_endpoints (
    base_url text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    model_id uuid,
    CONSTRAINT model_endpoints_base_url_check CHECK ((base_url <> ''::text))
);


--
-- Name: model_modalities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_modalities (
    modality public.modality_type NOT NULL,
    is_input boolean NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    model_id uuid NOT NULL
);


--
-- Name: model_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_pricing (
    pricing_type public.pricing_type NOT NULL,
    price real NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    model_id uuid NOT NULL,
    unit_id uuid NOT NULL
);


--
-- Name: model_qualities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_qualities (
    quality public.quality NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    model_id uuid
);


--
-- Name: model_reasoning_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_reasoning_levels (
    reasoning_level public.reasoning_effort NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT model_reasoning_levels_id_v7_not_null NOT NULL,
    model_id uuid
);


--
-- Name: model_temperature_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_temperature_levels (
    temperature real NOT NULL,
    is_upper boolean NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT model_temperature_levels_id_v7_not_null NOT NULL,
    model_id uuid,
    CONSTRAINT model_temperature_levels_temperature_check CHECK (((temperature >= (0.0)::double precision) AND (temperature <= (2.0)::double precision)))
);


--
-- Name: model_voices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_voices (
    voice public.voice NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT model_voices_id_v7_not_null NOT NULL,
    model_id uuid
);


--
-- Name: models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.models (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    value text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT models_id_v7_not_null NOT NULL,
    provider_id uuid
);


--
-- Name: objective_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objective_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    objective_id uuid NOT NULL
);


--
-- Name: objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objectives (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    objective text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT objectives_id_v7_not_null NOT NULL,
    tool_call_id uuid NOT NULL
);


--
-- Name: options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.options (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    option_text text NOT NULL,
    type public.option_type NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT options_id_v7_not_null NOT NULL
);


--
-- Name: parameter_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameter_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    parameter_id uuid NOT NULL
);


--
-- Name: parameter_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameter_fields (
    "default" boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    field_id uuid NOT NULL,
    parameter_id uuid NOT NULL
);


--
-- Name: parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameters (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    active boolean DEFAULT false NOT NULL,
    document_parameter boolean DEFAULT false NOT NULL,
    persona_parameter boolean DEFAULT false NOT NULL,
    scenario_parameter boolean DEFAULT false NOT NULL,
    video_parameter boolean DEFAULT false NOT NULL,
    simulation_parameter boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT parameters_id_v7_not_null NOT NULL
);


--
-- Name: persona_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    persona_id uuid NOT NULL
);


--
-- Name: persona_examples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_examples (
    idx integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    example_id uuid NOT NULL,
    persona_id uuid NOT NULL
);


--
-- Name: persona_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_fields (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    field_id uuid NOT NULL,
    persona_id uuid NOT NULL
);


--
-- Name: personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personas (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    color text NOT NULL,
    icon text NOT NULL,
    active boolean DEFAULT false NOT NULL,
    instructions text,
    id uuid DEFAULT uuidv7() CONSTRAINT personas_id_v7_not_null NOT NULL
);


--
-- Name: problem_statement_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.problem_statement_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    problem_statement_id uuid NOT NULL
);


--
-- Name: problem_statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.problem_statements (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    problem_statement text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT problem_statements_id_v7_not_null NOT NULL,
    tool_call_id uuid NOT NULL
);


--
-- Name: profile_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_activity (
    last_active timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT profile_activity_id_v7_not_null NOT NULL,
    profile_id uuid
);


--
-- Name: profile_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_departments (
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    profile_id uuid NOT NULL
);


--
-- Name: profile_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_emails (
    email text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    profile_id uuid
);


--
-- Name: profile_request_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_request_limits (
    requests_per_day integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    profile_id uuid,
    CONSTRAINT profile_request_limits_requests_per_day_check CHECK ((requests_per_day > 0))
);


--
-- Name: TABLE profile_request_limits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.profile_request_limits IS 'Stores daily request limits for profiles. One row per profile.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login timestamp with time zone DEFAULT now() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    role public.profile_role DEFAULT 'guest'::public.profile_role NOT NULL,
    active boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT profiles_id_v7_not_null NOT NULL
);


--
-- Name: prompt_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prompt_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    prompt_id uuid NOT NULL
);


--
-- Name: prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prompts (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    system_prompt text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT prompts_id_v7_not_null NOT NULL
);


--
-- Name: provider_endpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_endpoints (
    base_url text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provider_id uuid,
    CONSTRAINT provider_endpoints_base_url_check CHECK ((base_url <> ''::text))
);


--
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    value text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT providers_id_v7_not_null NOT NULL
);


--
-- Name: question_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_answers (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    option_id uuid NOT NULL,
    question_id uuid NOT NULL
);


--
-- Name: question_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    question_id uuid NOT NULL
);


--
-- Name: question_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_options (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    option_id uuid NOT NULL,
    question_id uuid NOT NULL
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    question_text text NOT NULL,
    allow_multiple boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT questions_id_v7_not_null NOT NULL,
    tool_call_id uuid NOT NULL
);


--
-- Name: quiz_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_responses (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT quiz_responses_id_v7_not_null NOT NULL,
    option_id uuid,
    question_id uuid,
    quiz_id uuid
);


--
-- Name: quizzes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quizzes (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT quizzes_id_v7_not_null NOT NULL,
    video_id uuid
);


--
-- Name: rubric_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    rubric_id uuid NOT NULL
);


--
-- Name: rubric_grade_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_grade_agents (
    id uuid DEFAULT uuidv7() NOT NULL,
    rubric_id uuid NOT NULL,
    grade_agent_id uuid CONSTRAINT rubric_grade_agents_grade_text_agent_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_id uuid NOT NULL
);


--
-- Name: rubric_grade_agents_audio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_grade_agents_audio (
    rubric_grade_agent_id uuid CONSTRAINT rubric_grade_agents_voice_rubric_grade_agent_id_not_null NOT NULL,
    audio_agent_id uuid CONSTRAINT rubric_grade_agents_voice_grade_voice_agent_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT rubric_grade_agents_voice_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT rubric_grade_agents_voice_updated_at_not_null NOT NULL
);


--
-- Name: rubric_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_groups (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    group_id uuid NOT NULL,
    rubric_id uuid NOT NULL
);


--
-- Name: rubric_standard_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_standard_groups (
    rubric_id uuid NOT NULL,
    standard_group_id uuid NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rubrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubrics (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    points integer NOT NULL,
    pass_points integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT rubrics_id_v7_not_null NOT NULL,
    rubric_agent_id uuid,
    agent_role public.agent_role NOT NULL
);


--
-- Name: run_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.run_models (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    model_id uuid NOT NULL,
    run_id uuid NOT NULL
);


--
-- Name: run_personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.run_personas (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    persona_id uuid NOT NULL,
    run_id uuid NOT NULL
);


--
-- Name: run_pricing_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.run_pricing_usage (
    pricing_type public.pricing_type NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    run_id uuid NOT NULL,
    unit_id uuid NOT NULL
);


--
-- Name: run_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.run_profiles (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    profile_id uuid NOT NULL,
    run_id uuid NOT NULL
);


--
-- Name: runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runs (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cached_input_tokens integer DEFAULT 0 NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT runs_id_v7_not_null NOT NULL,
    agent_id uuid,
    key_id uuid
);


--
-- Name: scenario_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    scenario_id uuid NOT NULL
);


--
-- Name: scenario_document_ranges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_document_ranges (
    min_count integer DEFAULT 0 NOT NULL,
    max_count integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    scenario_id uuid,
    CONSTRAINT scenario_document_ranges_min_max_check CHECK (((min_count >= 0) AND (max_count >= min_count)))
);


--
-- Name: scenario_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_documents (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    document_id uuid NOT NULL,
    scenario_id uuid NOT NULL
);


--
-- Name: scenario_field_ranges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_field_ranges (
    min_count integer DEFAULT 1 NOT NULL,
    max_count integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parameter_id uuid,
    scenario_id uuid,
    CONSTRAINT scenario_field_ranges_min_max_check CHECK (((min_count >= 1) AND (max_count >= min_count)))
);


--
-- Name: scenario_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_fields (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    field_id uuid NOT NULL,
    scenario_id uuid NOT NULL
);


--
-- Name: scenario_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_groups (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    group_id uuid NOT NULL,
    scenario_id uuid NOT NULL
);


--
-- Name: scenario_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_images (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_id uuid NOT NULL,
    scenario_id uuid NOT NULL
);


--
-- Name: scenario_objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_objectives (
    idx integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    objective_id uuid NOT NULL,
    scenario_id uuid NOT NULL
);


--
-- Name: scenario_parameter_ranges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_parameter_ranges (
    min_count integer DEFAULT 0 NOT NULL,
    max_count integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    scenario_id uuid,
    CONSTRAINT scenario_parameter_ranges_min_max_check CHECK (((min_count >= 0) AND (max_count >= min_count)))
);


--
-- Name: scenario_parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_parameters (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parameter_id uuid NOT NULL,
    scenario_id uuid NOT NULL
);


--
-- Name: scenario_persona_ranges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_persona_ranges (
    min_count integer DEFAULT 1 NOT NULL,
    max_count integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    scenario_id uuid,
    CONSTRAINT scenario_persona_ranges_min_max_check CHECK (((min_count >= 1) AND (max_count >= min_count)))
);


--
-- Name: scenario_personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_personas (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    persona_id uuid NOT NULL,
    scenario_id uuid NOT NULL
);


--
-- Name: scenario_problem_statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_problem_statements (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    problem_statement_id uuid NOT NULL,
    scenario_id uuid NOT NULL
);


--
-- Name: scenario_question_times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_question_times (
    scenario_id uuid NOT NULL,
    question_id uuid NOT NULL,
    video_id uuid NOT NULL,
    "time" integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scenario_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_questions (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    question_id uuid NOT NULL,
    scenario_id uuid NOT NULL
);


--
-- Name: scenario_time_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_time_limits (
    simulation_id uuid NOT NULL,
    scenario_id uuid NOT NULL,
    time_limit_seconds integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scenario_time_limits_time_limit_seconds_check CHECK ((time_limit_seconds > 0))
);


--
-- Name: scenario_tree; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_tree (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    child_id uuid NOT NULL,
    parent_id uuid NOT NULL
);


--
-- Name: scenario_video_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_video_images (
    idx integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_id uuid NOT NULL,
    scenario_id uuid NOT NULL,
    video_id uuid NOT NULL
);


--
-- Name: scenario_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_videos (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    scenario_id uuid NOT NULL,
    video_id uuid NOT NULL
);


--
-- Name: scenarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenarios (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    objectives_enabled boolean DEFAULT true NOT NULL,
    images_enabled boolean DEFAULT true NOT NULL,
    video_enabled boolean DEFAULT false NOT NULL,
    questions_enabled boolean DEFAULT false NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT scenarios_id_v7_not_null NOT NULL,
    scenario_agent_id uuid,
    video_agent_id uuid,
    image_agent_id uuid,
    problem_statement_enabled boolean DEFAULT true NOT NULL
);


--
-- Name: service_health; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_health (
    ts timestamp with time zone NOT NULL,
    service text NOT NULL,
    ok boolean NOT NULL,
    latency_ms double precision NOT NULL,
    error text DEFAULT ''::text NOT NULL
);


--
-- Name: setting_auth_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_auth_keys (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    auth_id uuid NOT NULL,
    auth_item_id uuid NOT NULL,
    key_id uuid NOT NULL,
    settings_id uuid NOT NULL
);


--
-- Name: setting_auth_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_auth_values (
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    auth_id uuid NOT NULL,
    auth_item_id uuid NOT NULL,
    settings_id uuid NOT NULL
);


--
-- Name: setting_auths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_auths (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    auth_id uuid NOT NULL,
    settings_id uuid NOT NULL
);


--
-- Name: setting_provider_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_provider_keys (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    key_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    settings_id uuid NOT NULL
);


--
-- Name: setting_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_providers (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provider_id uuid NOT NULL,
    settings_id uuid NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean NOT NULL,
    primary_color text NOT NULL,
    accent text NOT NULL,
    background text NOT NULL,
    surface text NOT NULL,
    success text NOT NULL,
    warning text NOT NULL,
    error text NOT NULL,
    sidebar_background text NOT NULL,
    sidebar_primary text NOT NULL,
    chart1 text NOT NULL,
    chart2 text NOT NULL,
    chart3 text NOT NULL,
    chart4 text NOT NULL,
    chart5 text NOT NULL,
    guest_login_enabled boolean NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT settings_id_v7_not_null NOT NULL,
    success_threshold integer NOT NULL,
    warning_threshold integer NOT NULL,
    danger_threshold integer NOT NULL
);


--
-- Name: settings_default_account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_default_account (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    profile_id uuid NOT NULL,
    settings_id uuid NOT NULL
);


--
-- Name: settings_default_department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_default_department (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    settings_id uuid NOT NULL
);


--
-- Name: settings_default_guest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_default_guest (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    profile_id uuid NOT NULL,
    settings_id uuid NOT NULL
);


--
-- Name: simulation_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation_attempts (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    infinite_mode boolean DEFAULT false NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT simulation_attempts_id_v7_not_null NOT NULL,
    simulation_id uuid
);


--
-- Name: simulation_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    simulation_id uuid NOT NULL
);


--
-- Name: simulation_hints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation_hints (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    hint text NOT NULL,
    idx integer NOT NULL,
    simulation_message_id uuid
);


--
-- Name: simulation_scenarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation_scenarios (
    "position" integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hints_enabled boolean DEFAULT false NOT NULL,
    copy_paste_allowed boolean DEFAULT false NOT NULL,
    audio_enabled boolean DEFAULT false NOT NULL,
    text_enabled boolean DEFAULT true NOT NULL,
    scenario_id uuid NOT NULL,
    simulation_id uuid NOT NULL,
    show_problem_statement boolean DEFAULT true NOT NULL,
    show_objectives boolean DEFAULT true NOT NULL,
    show_images boolean DEFAULT true NOT NULL
);


--
-- Name: simulation_scenarios_rubric_grade_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation_scenarios_rubric_grade_agents (
    simulation_id uuid NOT NULL,
    scenario_id uuid NOT NULL,
    rubric_grade_agent_id uuid CONSTRAINT simulation_scenarios_rubric_grad_rubric_grade_agent_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: simulations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulations (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    description text DEFAULT 'No description provided'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    practice_simulation boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT simulations_id_v7_not_null NOT NULL,
    simulation_text_agent_id uuid,
    simulation_voice_agent_id uuid,
    hint_agent_id uuid
);


--
-- Name: standard_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standard_groups (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    short_name text NOT NULL,
    description text NOT NULL,
    points integer NOT NULL,
    pass_points integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT standard_groups_id_v7_not_null NOT NULL,
    tool_call_id uuid NOT NULL
);


--
-- Name: standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standards (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    points integer NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT standards_id_v7_not_null NOT NULL,
    standard_group_id uuid
);


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    args jsonb DEFAULT '{}'::jsonb NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT templates_id_v7_not_null NOT NULL,
    upload_id uuid,
    tool_call_id uuid NOT NULL
);


--
-- Name: test_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_runs (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    run_id uuid NOT NULL,
    test_id uuid NOT NULL
);


--
-- Name: tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tests (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    trace_id text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT tests_id_v7_not_null NOT NULL,
    run_id uuid
);


--
-- Name: tool_call_arguments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_call_arguments (
    arguments_json jsonb NOT NULL,
    arguments_raw text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tool_call_id uuid NOT NULL
);


--
-- Name: tool_call_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_call_results (
    result_content text NOT NULL,
    result_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tool_call_id uuid
);


--
-- Name: tool_call_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_call_runs (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    run_id uuid NOT NULL,
    tool_call_id uuid NOT NULL
);


--
-- Name: tool_calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_calls (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    call_id text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT tool_calls_id_v7_not_null NOT NULL,
    tool_id uuid
);


--
-- Name: tools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tools (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    tool_type public.tool_type NOT NULL,
    agent_role public.agent_role NOT NULL,
    arguments jsonb DEFAULT '{}'::jsonb NOT NULL,
    argument_descriptions jsonb DEFAULT '{}'::jsonb NOT NULL,
    argument_defaults jsonb DEFAULT '{}'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    name text NOT NULL,
    unit_category public.unit_category NOT NULL,
    value integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT units_id_v7_not_null NOT NULL
);


--
-- Name: uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uploads (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    file_path text NOT NULL,
    mime_type text NOT NULL,
    size bigint NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT uploads_id_v7_not_null NOT NULL
);


--
-- Name: video_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    video_id uuid NOT NULL
);


--
-- Name: video_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_uploads (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    upload_id uuid NOT NULL,
    video_id uuid NOT NULL
);


--
-- Name: videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.videos (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    length_seconds integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    image_enabled boolean DEFAULT true NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT videos_id_v7_not_null NOT NULL,
    tool_call_id uuid NOT NULL,
    CONSTRAINT videos_length_seconds_check CHECK ((length_seconds > 0))
);


--
-- Name: row_changes row_changes_pkey; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.row_changes
    ADD CONSTRAINT row_changes_pkey PRIMARY KEY (id);


--
-- Name: activity activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_pkey PRIMARY KEY (id);


--
-- Name: agent_department_prompts agent_department_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_department_prompts
    ADD CONSTRAINT agent_department_prompts_pkey PRIMARY KEY (agent_id, department_id, prompt_id);


--
-- Name: agent_departments agent_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_departments
    ADD CONSTRAINT agent_departments_pkey PRIMARY KEY (agent_id, department_id);


--
-- Name: agent_prompts agent_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_prompts
    ADD CONSTRAINT agent_prompts_pkey PRIMARY KEY (agent_id, prompt_id);


--
-- Name: agent_reasoning_levels agent_reasoning_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_reasoning_levels
    ADD CONSTRAINT agent_reasoning_levels_pkey PRIMARY KEY (agent_id, model_reasoning_level_id);


--
-- Name: agent_temperature_levels agent_temperature_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_temperature_levels
    ADD CONSTRAINT agent_temperature_levels_pkey PRIMARY KEY (agent_id, model_temperature_level_id);


--
-- Name: agent_tools agent_tools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tools
    ADD CONSTRAINT agent_tools_pkey PRIMARY KEY (agent_id, tool_id);


--
-- Name: agent_voices agent_voices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_voices
    ADD CONSTRAINT agent_voices_pkey PRIMARY KEY (agent_id, model_voice_id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: app_metrics app_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_metrics
    ADD CONSTRAINT app_metrics_pkey PRIMARY KEY (ts);


--
-- Name: attempt_chats attempt_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_chats
    ADD CONSTRAINT attempt_chats_pkey PRIMARY KEY (attempt_id, chat_id);


--
-- Name: attempt_profiles attempt_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_profiles
    ADD CONSTRAINT attempt_profiles_pkey PRIMARY KEY (attempt_id, profile_id);


--
-- Name: attempt_quizzes attempt_quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_quizzes
    ADD CONSTRAINT attempt_quizzes_pkey PRIMARY KEY (attempt_id, quiz_id);


--
-- Name: attempt_tests attempt_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_tests
    ADD CONSTRAINT attempt_tests_pkey PRIMARY KEY (attempt_id, test_id);


--
-- Name: auth_items auth_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_items
    ADD CONSTRAINT auth_items_pkey PRIMARY KEY (id);


--
-- Name: auth auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth
    ADD CONSTRAINT auth_pkey PRIMARY KEY (id);


--
-- Name: chat_groups chat_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_groups
    ADD CONSTRAINT chat_groups_pkey PRIMARY KEY (chat_id, group_id);


--
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);


--
-- Name: cohort_departments cohort_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_departments
    ADD CONSTRAINT cohort_departments_pkey PRIMARY KEY (cohort_id, department_id);


--
-- Name: cohort_profiles cohort_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_profiles
    ADD CONSTRAINT cohort_profiles_pkey PRIMARY KEY (cohort_id, profile_id);


--
-- Name: cohort_simulations cohort_simulations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_simulations
    ADD CONSTRAINT cohort_simulations_pkey PRIMARY KEY (cohort_id, simulation_id);


--
-- Name: cohorts cohorts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohorts
    ADD CONSTRAINT cohorts_pkey PRIMARY KEY (id);


--
-- Name: debug_info debug_info_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debug_info
    ADD CONSTRAINT debug_info_pkey PRIMARY KEY (id);


--
-- Name: department_settings department_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_settings
    ADD CONSTRAINT department_settings_pkey PRIMARY KEY (department_id, settings_id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: document_departments document_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_departments
    ADD CONSTRAINT document_departments_pkey PRIMARY KEY (document_id, department_id);


--
-- Name: document_fields document_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_fields
    ADD CONSTRAINT document_fields_pkey PRIMARY KEY (document_id, field_id);


--
-- Name: document_groups document_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_groups
    ADD CONSTRAINT document_groups_pkey PRIMARY KEY (document_id, group_id);


--
-- Name: document_templates document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_pkey PRIMARY KEY (document_id, template_id);


--
-- Name: document_tree document_tree_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tree
    ADD CONSTRAINT document_tree_pkey PRIMARY KEY (parent_id, child_id);


--
-- Name: document_uploads document_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_uploads
    ADD CONSTRAINT document_uploads_pkey PRIMARY KEY (document_id, upload_id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: drafts drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_pkey PRIMARY KEY (id);


--
-- Name: eval_agents eval_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_agents
    ADD CONSTRAINT eval_agents_pkey PRIMARY KEY (eval_id, agent_id);


--
-- Name: eval_attempts eval_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_attempts
    ADD CONSTRAINT eval_attempts_pkey PRIMARY KEY (id);


--
-- Name: eval_departments eval_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_departments
    ADD CONSTRAINT eval_departments_pkey PRIMARY KEY (eval_id, department_id);


--
-- Name: eval_groups eval_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_groups
    ADD CONSTRAINT eval_groups_pkey PRIMARY KEY (eval_id, group_id);


--
-- Name: eval_groups_rubric_grade_agents eval_groups_rubric_grade_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_groups_rubric_grade_agents
    ADD CONSTRAINT eval_groups_rubric_grade_agents_pkey PRIMARY KEY (eval_id, group_id, rubric_grade_agent_id);


--
-- Name: eval_runs eval_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs
    ADD CONSTRAINT eval_runs_pkey PRIMARY KEY (eval_id, run_id);


--
-- Name: eval_runs_rubric_grade_agents eval_runs_rubric_grade_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs_rubric_grade_agents
    ADD CONSTRAINT eval_runs_rubric_grade_agents_pkey PRIMARY KEY (eval_id, run_id, rubric_grade_agent_id);


--
-- Name: evals evals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evals
    ADD CONSTRAINT evals_pkey PRIMARY KEY (id);


--
-- Name: examples examples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examples
    ADD CONSTRAINT examples_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: feedbacks feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_pkey PRIMARY KEY (id);


--
-- Name: field_conditional_parameters field_conditional_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_conditional_parameters
    ADD CONSTRAINT field_conditional_parameters_pkey PRIMARY KEY (field_id, conditional_parameter_id);


--
-- Name: field_departments field_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_departments
    ADD CONSTRAINT field_departments_pkey PRIMARY KEY (field_id, department_id);


--
-- Name: fields fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fields
    ADD CONSTRAINT fields_pkey PRIMARY KEY (id);


--
-- Name: grade_groups grade_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_groups
    ADD CONSTRAINT grade_groups_pkey PRIMARY KEY (chat_id, group_id);


--
-- Name: grades grades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_pkey PRIMARY KEY (id);


--
-- Name: group_order group_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_order
    ADD CONSTRAINT group_order_pkey PRIMARY KEY (group_id, agent_id, position_idx);


--
-- Name: group_runs group_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_runs
    ADD CONSTRAINT group_runs_pkey PRIMARY KEY (group_id, run_id);


--
-- Name: group_stop group_stop_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_stop
    ADD CONSTRAINT group_stop_pkey PRIMARY KEY (group_id, tool_id, position_idx);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: image_departments image_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_departments
    ADD CONSTRAINT image_departments_pkey PRIMARY KEY (image_id, department_id);


--
-- Name: image_uploads image_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_uploads
    ADD CONSTRAINT image_uploads_pkey PRIMARY KEY (image_id, upload_id);


--
-- Name: images images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_pkey PRIMARY KEY (id);


--
-- Name: keys keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keys
    ADD CONSTRAINT keys_pkey PRIMARY KEY (id);


--
-- Name: message_audio message_audio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_audio
    ADD CONSTRAINT message_audio_pkey PRIMARY KEY (message_id, upload_id);


--
-- Name: message_feedbacks message_feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedbacks
    ADD CONSTRAINT message_feedbacks_pkey PRIMARY KEY (id);


--
-- Name: message_personas message_personas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_personas
    ADD CONSTRAINT message_personas_pkey PRIMARY KEY (message_id, persona_id);


--
-- Name: message_runs message_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_runs
    ADD CONSTRAINT message_runs_pkey PRIMARY KEY (message_id, run_id);


--
-- Name: message_tree message_tree_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_tree
    ADD CONSTRAINT message_tree_pkey PRIMARY KEY (parent_id, child_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: model_departments model_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_departments
    ADD CONSTRAINT model_departments_pkey PRIMARY KEY (model_id, department_id);


--
-- Name: model_modalities model_modalities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_modalities
    ADD CONSTRAINT model_modalities_pkey PRIMARY KEY (model_id, modality, is_input);


--
-- Name: model_pricing model_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_pricing
    ADD CONSTRAINT model_pricing_pkey PRIMARY KEY (model_id, pricing_type, unit_id);


--
-- Name: model_reasoning_levels model_reasoning_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_reasoning_levels
    ADD CONSTRAINT model_reasoning_levels_pkey PRIMARY KEY (id);


--
-- Name: model_temperature_levels model_temperature_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_temperature_levels
    ADD CONSTRAINT model_temperature_levels_pkey PRIMARY KEY (id);


--
-- Name: model_voices model_voices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_voices
    ADD CONSTRAINT model_voices_pkey PRIMARY KEY (id);


--
-- Name: models models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.models
    ADD CONSTRAINT models_pkey PRIMARY KEY (id);


--
-- Name: objective_departments objective_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_departments
    ADD CONSTRAINT objective_departments_pkey PRIMARY KEY (objective_id, department_id);


--
-- Name: objectives objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives
    ADD CONSTRAINT objectives_pkey PRIMARY KEY (id);


--
-- Name: options options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_pkey PRIMARY KEY (id);


--
-- Name: parameter_departments parameter_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_departments
    ADD CONSTRAINT parameter_departments_pkey PRIMARY KEY (parameter_id, department_id);


--
-- Name: parameter_fields parameter_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_fields
    ADD CONSTRAINT parameter_fields_pkey PRIMARY KEY (parameter_id, field_id);


--
-- Name: parameters parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameters
    ADD CONSTRAINT parameters_pkey PRIMARY KEY (id);


--
-- Name: persona_departments persona_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_departments
    ADD CONSTRAINT persona_departments_pkey PRIMARY KEY (persona_id, department_id);


--
-- Name: persona_examples persona_examples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_examples
    ADD CONSTRAINT persona_examples_pkey PRIMARY KEY (persona_id, example_id);


--
-- Name: persona_fields persona_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_fields
    ADD CONSTRAINT persona_fields_pkey PRIMARY KEY (persona_id, field_id);


--
-- Name: personas personas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personas
    ADD CONSTRAINT personas_pkey PRIMARY KEY (id);


--
-- Name: problem_statement_departments problem_statement_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_statement_departments
    ADD CONSTRAINT problem_statement_departments_pkey PRIMARY KEY (problem_statement_id, department_id);


--
-- Name: problem_statements problem_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_statements
    ADD CONSTRAINT problem_statements_pkey PRIMARY KEY (id);


--
-- Name: profile_activity profile_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_activity
    ADD CONSTRAINT profile_activity_pkey PRIMARY KEY (id);


--
-- Name: profile_departments profile_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_departments
    ADD CONSTRAINT profile_departments_pkey PRIMARY KEY (profile_id, department_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: prompt_departments prompt_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_departments
    ADD CONSTRAINT prompt_departments_pkey PRIMARY KEY (prompt_id, department_id);


--
-- Name: prompts prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompts
    ADD CONSTRAINT prompts_pkey PRIMARY KEY (id);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: question_answers question_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_answers
    ADD CONSTRAINT question_answers_pkey PRIMARY KEY (question_id, option_id);


--
-- Name: question_departments question_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_departments
    ADD CONSTRAINT question_departments_pkey PRIMARY KEY (question_id, department_id);


--
-- Name: question_options question_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_pkey PRIMARY KEY (question_id, option_id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: quiz_responses quiz_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_responses
    ADD CONSTRAINT quiz_responses_pkey PRIMARY KEY (id);


--
-- Name: quizzes quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_pkey PRIMARY KEY (id);


--
-- Name: rubric_departments rubric_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_departments
    ADD CONSTRAINT rubric_departments_pkey PRIMARY KEY (rubric_id, department_id);


--
-- Name: rubric_grade_agents rubric_grade_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents
    ADD CONSTRAINT rubric_grade_agents_pkey PRIMARY KEY (id);


--
-- Name: rubric_grade_agents rubric_grade_agents_rubric_grade_agent_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents
    ADD CONSTRAINT rubric_grade_agents_rubric_grade_agent_unique UNIQUE (rubric_id, grade_agent_id, agent_id);


--
-- Name: rubric_grade_agents_audio rubric_grade_agents_voice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents_audio
    ADD CONSTRAINT rubric_grade_agents_voice_pkey PRIMARY KEY (rubric_grade_agent_id, audio_agent_id);


--
-- Name: rubric_groups rubric_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_groups
    ADD CONSTRAINT rubric_groups_pkey PRIMARY KEY (rubric_id, group_id);


--
-- Name: rubric_standard_groups rubric_standard_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_standard_groups
    ADD CONSTRAINT rubric_standard_groups_pkey PRIMARY KEY (rubric_id, standard_group_id);


--
-- Name: rubrics rubrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubrics
    ADD CONSTRAINT rubrics_pkey PRIMARY KEY (id);


--
-- Name: run_models run_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_models
    ADD CONSTRAINT run_models_pkey PRIMARY KEY (run_id, model_id);


--
-- Name: run_personas run_personas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_personas
    ADD CONSTRAINT run_personas_pkey PRIMARY KEY (run_id, persona_id);


--
-- Name: run_pricing_usage run_pricing_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_pricing_usage
    ADD CONSTRAINT run_pricing_usage_pkey PRIMARY KEY (run_id, pricing_type, unit_id);


--
-- Name: run_profiles run_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_profiles
    ADD CONSTRAINT run_profiles_pkey PRIMARY KEY (run_id, profile_id);


--
-- Name: runs runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_pkey PRIMARY KEY (id);


--
-- Name: scenario_departments scenario_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_departments
    ADD CONSTRAINT scenario_departments_pkey PRIMARY KEY (scenario_id, department_id);


--
-- Name: scenario_documents scenario_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_documents
    ADD CONSTRAINT scenario_documents_pkey PRIMARY KEY (scenario_id, document_id);


--
-- Name: scenario_fields scenario_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_fields
    ADD CONSTRAINT scenario_fields_pkey PRIMARY KEY (scenario_id, field_id);


--
-- Name: scenario_groups scenario_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_groups
    ADD CONSTRAINT scenario_groups_pkey PRIMARY KEY (scenario_id, group_id);


--
-- Name: scenario_images scenario_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_images
    ADD CONSTRAINT scenario_images_pkey PRIMARY KEY (scenario_id, image_id);


--
-- Name: scenario_objectives scenario_objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_objectives
    ADD CONSTRAINT scenario_objectives_pkey PRIMARY KEY (scenario_id, objective_id);


--
-- Name: scenario_parameters scenario_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_parameters
    ADD CONSTRAINT scenario_parameters_pkey PRIMARY KEY (scenario_id, parameter_id);


--
-- Name: scenario_personas scenario_personas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_personas
    ADD CONSTRAINT scenario_personas_pkey PRIMARY KEY (scenario_id, persona_id);


--
-- Name: scenario_problem_statements scenario_problem_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_problem_statements
    ADD CONSTRAINT scenario_problem_statements_pkey PRIMARY KEY (scenario_id, problem_statement_id);


--
-- Name: scenario_question_times scenario_question_times_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_question_times
    ADD CONSTRAINT scenario_question_times_pkey PRIMARY KEY (scenario_id, question_id, video_id, "time");


--
-- Name: scenario_questions scenario_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_questions
    ADD CONSTRAINT scenario_questions_pkey PRIMARY KEY (scenario_id, question_id);


--
-- Name: scenario_time_limits scenario_time_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_time_limits
    ADD CONSTRAINT scenario_time_limits_pkey PRIMARY KEY (simulation_id, scenario_id);


--
-- Name: scenario_tree scenario_tree_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_tree
    ADD CONSTRAINT scenario_tree_pkey PRIMARY KEY (parent_id, child_id);


--
-- Name: scenario_video_images scenario_video_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_video_images
    ADD CONSTRAINT scenario_video_images_pkey PRIMARY KEY (scenario_id, video_id, image_id);


--
-- Name: scenario_videos scenario_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_videos
    ADD CONSTRAINT scenario_videos_pkey PRIMARY KEY (scenario_id, video_id);


--
-- Name: scenarios scenarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenarios
    ADD CONSTRAINT scenarios_pkey PRIMARY KEY (id);


--
-- Name: service_health service_health_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_health
    ADD CONSTRAINT service_health_pkey PRIMARY KEY (ts, service);


--
-- Name: setting_auth_keys setting_auth_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_keys
    ADD CONSTRAINT setting_auth_keys_pkey PRIMARY KEY (settings_id, auth_id, auth_item_id, key_id);


--
-- Name: setting_auth_values setting_auth_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_values
    ADD CONSTRAINT setting_auth_values_pkey PRIMARY KEY (settings_id, auth_id, auth_item_id);


--
-- Name: setting_auths setting_auths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auths
    ADD CONSTRAINT setting_auths_pkey PRIMARY KEY (settings_id, auth_id);


--
-- Name: setting_provider_keys setting_provider_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_provider_keys
    ADD CONSTRAINT setting_provider_keys_pkey PRIMARY KEY (settings_id, provider_id, key_id);


--
-- Name: setting_providers setting_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_providers
    ADD CONSTRAINT setting_providers_pkey PRIMARY KEY (settings_id, provider_id);


--
-- Name: settings_default_account settings_default_account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_account
    ADD CONSTRAINT settings_default_account_pkey PRIMARY KEY (settings_id, profile_id);


--
-- Name: settings_default_department settings_default_department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_department
    ADD CONSTRAINT settings_default_department_pkey PRIMARY KEY (settings_id, department_id);


--
-- Name: settings_default_guest settings_default_guest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_guest
    ADD CONSTRAINT settings_default_guest_pkey PRIMARY KEY (settings_id, profile_id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: simulation_attempts simulation_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_attempts
    ADD CONSTRAINT simulation_attempts_pkey PRIMARY KEY (id);


--
-- Name: simulation_departments simulation_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_departments
    ADD CONSTRAINT simulation_departments_pkey PRIMARY KEY (simulation_id, department_id);


--
-- Name: simulation_scenarios simulation_scenarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_scenarios
    ADD CONSTRAINT simulation_scenarios_pkey PRIMARY KEY (simulation_id, scenario_id);


--
-- Name: simulation_scenarios_rubric_grade_agents simulation_scenarios_rubric_grade_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_scenarios_rubric_grade_agents
    ADD CONSTRAINT simulation_scenarios_rubric_grade_agents_pkey PRIMARY KEY (simulation_id, scenario_id, rubric_grade_agent_id);


--
-- Name: simulations simulations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulations
    ADD CONSTRAINT simulations_pkey PRIMARY KEY (id);


--
-- Name: standard_groups standard_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_groups
    ADD CONSTRAINT standard_groups_pkey PRIMARY KEY (id);


--
-- Name: standards standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standards
    ADD CONSTRAINT standards_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: test_runs test_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_runs
    ADD CONSTRAINT test_runs_pkey PRIMARY KEY (test_id, run_id);


--
-- Name: tests tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_pkey PRIMARY KEY (id);


--
-- Name: tool_call_arguments tool_call_arguments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_call_arguments
    ADD CONSTRAINT tool_call_arguments_pkey PRIMARY KEY (tool_call_id);


--
-- Name: tool_call_runs tool_call_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_call_runs
    ADD CONSTRAINT tool_call_runs_pkey PRIMARY KEY (tool_call_id, run_id);


--
-- Name: tool_calls tool_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_calls
    ADD CONSTRAINT tool_calls_pkey PRIMARY KEY (id);


--
-- Name: tools tools_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tools
    ADD CONSTRAINT tools_name_key UNIQUE (name);


--
-- Name: tools tools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tools
    ADD CONSTRAINT tools_pkey PRIMARY KEY (id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: uploads uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploads
    ADD CONSTRAINT uploads_pkey PRIMARY KEY (id);


--
-- Name: video_departments video_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_departments
    ADD CONSTRAINT video_departments_pkey PRIMARY KEY (video_id, department_id);


--
-- Name: video_uploads video_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_uploads
    ADD CONSTRAINT video_uploads_pkey PRIMARY KEY (video_id, upload_id);


--
-- Name: videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (id);


--
-- Name: row_changes_changed_at_idx; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX row_changes_changed_at_idx ON audit.row_changes USING btree (changed_at DESC);


--
-- Name: row_changes_table_op_idx; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX row_changes_table_op_idx ON audit.row_changes USING btree (table_name, op);


--
-- Name: activity_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_created_at_idx ON public.activity USING btree (created_at);


--
-- Name: activity_endpoint_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_endpoint_idx ON public.activity USING btree (endpoint);


--
-- Name: activity_error_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_error_idx ON public.activity USING btree (error);


--
-- Name: activity_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_profile_id_v7_idx ON public.activity USING btree (profile_id);


--
-- Name: agent_department_prompts_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_department_prompts_agent_id_v7_idx ON public.agent_department_prompts USING btree (agent_id);


--
-- Name: agent_department_prompts_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_department_prompts_department_id_v7_idx ON public.agent_department_prompts USING btree (department_id);


--
-- Name: agent_department_prompts_prompt_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_department_prompts_prompt_id_v7_idx ON public.agent_department_prompts USING btree (prompt_id);


--
-- Name: agent_departments_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_departments_active_idx ON public.agent_departments USING btree (active);


--
-- Name: agent_departments_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_departments_agent_id_v7_idx ON public.agent_departments USING btree (agent_id);


--
-- Name: agent_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_departments_department_id_v7_idx ON public.agent_departments USING btree (department_id);


--
-- Name: agent_prompts_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_prompts_agent_id_v7_idx ON public.agent_prompts USING btree (agent_id);


--
-- Name: agent_prompts_prompt_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_prompts_prompt_id_v7_idx ON public.agent_prompts USING btree (prompt_id);


--
-- Name: agent_reasoning_levels_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_reasoning_levels_active_idx ON public.agent_reasoning_levels USING btree (active);


--
-- Name: agent_reasoning_levels_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_reasoning_levels_agent_id_v7_idx ON public.agent_reasoning_levels USING btree (agent_id);


--
-- Name: agent_reasoning_levels_model_reasoning_level_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_reasoning_levels_model_reasoning_level_id_v7_idx ON public.agent_reasoning_levels USING btree (model_reasoning_level_id);


--
-- Name: agent_temperature_levels_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_temperature_levels_active_idx ON public.agent_temperature_levels USING btree (active);


--
-- Name: agent_temperature_levels_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_temperature_levels_agent_id_v7_idx ON public.agent_temperature_levels USING btree (agent_id);


--
-- Name: agent_temperature_levels_model_temperature_level_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_temperature_levels_model_temperature_level_id_v7_idx ON public.agent_temperature_levels USING btree (model_temperature_level_id);


--
-- Name: agent_tools_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tools_active_idx ON public.agent_tools USING btree (active);


--
-- Name: agent_tools_agent_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tools_agent_active_idx ON public.agent_tools USING btree (agent_id, active);


--
-- Name: agent_tools_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tools_agent_id_idx ON public.agent_tools USING btree (agent_id);


--
-- Name: agent_tools_tool_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_tools_tool_id_idx ON public.agent_tools USING btree (tool_id);


--
-- Name: agent_voices_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_voices_active_idx ON public.agent_voices USING btree (active);


--
-- Name: agent_voices_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_voices_agent_id_v7_idx ON public.agent_voices USING btree (agent_id);


--
-- Name: agent_voices_model_voice_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_voices_model_voice_id_v7_idx ON public.agent_voices USING btree (model_voice_id);


--
-- Name: agents_model_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agents_model_id_v7_idx ON public.agents USING btree (model_id);


--
-- Name: app_metrics_ts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_metrics_ts_idx ON public.app_metrics USING btree (ts);


--
-- Name: attempt_chats_attempt_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_chats_attempt_id_v7_idx ON public.attempt_chats USING btree (attempt_id);


--
-- Name: attempt_chats_chat_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_chats_chat_id_v7_idx ON public.attempt_chats USING btree (chat_id);


--
-- Name: attempt_profiles_attempt_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_profiles_attempt_active_idx ON public.attempt_profiles USING btree (attempt_id, profile_id) WHERE (active = true);


--
-- Name: attempt_profiles_attempt_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_profiles_attempt_id_v7_idx ON public.attempt_profiles USING btree (attempt_id);


--
-- Name: attempt_profiles_profile_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_profiles_profile_active_idx ON public.attempt_profiles USING btree (profile_id, attempt_id) WHERE (active = true);


--
-- Name: attempt_profiles_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_profiles_profile_id_v7_idx ON public.attempt_profiles USING btree (profile_id);


--
-- Name: attempt_quizzes_attempt_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_quizzes_attempt_id_v7_idx ON public.attempt_quizzes USING btree (attempt_id);


--
-- Name: attempt_quizzes_quiz_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_quizzes_quiz_id_v7_idx ON public.attempt_quizzes USING btree (quiz_id);


--
-- Name: attempt_tests_attempt_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_tests_attempt_id_v7_idx ON public.attempt_tests USING btree (attempt_id);


--
-- Name: attempt_tests_test_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_tests_test_id_v7_idx ON public.attempt_tests USING btree (test_id);


--
-- Name: auth_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_active_idx ON public.auth USING btree (active);


--
-- Name: auth_items_auth_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_items_auth_id_v7_idx ON public.auth_items USING btree (auth_id);


--
-- Name: auth_items_encrypted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_items_encrypted_idx ON public.auth_items USING btree (encrypted);


--
-- Name: auth_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_slug_idx ON public.auth USING btree (slug);


--
-- Name: auth_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_slug_unique ON public.auth USING btree (slug);


--
-- Name: chat_groups_chat_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_groups_chat_id_v7_idx ON public.chat_groups USING btree (chat_id);


--
-- Name: chat_groups_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_groups_group_id_v7_idx ON public.chat_groups USING btree (group_id);


--
-- Name: chats_id_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chats_id_created_idx ON public.chats USING btree (id, created_at);


--
-- Name: chats_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chats_scenario_id_v7_idx ON public.chats USING btree (scenario_id);


--
-- Name: cohort_departments_cohort_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_departments_cohort_id_v7_idx ON public.cohort_departments USING btree (cohort_id);


--
-- Name: cohort_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_departments_department_id_v7_idx ON public.cohort_departments USING btree (department_id);


--
-- Name: cohort_profiles_cohort_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_profiles_cohort_id_v7_idx ON public.cohort_profiles USING btree (cohort_id);


--
-- Name: cohort_profiles_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_profiles_profile_id_v7_idx ON public.cohort_profiles USING btree (profile_id);


--
-- Name: cohort_simulations_cohort_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_simulations_cohort_id_v7_idx ON public.cohort_simulations USING btree (cohort_id);


--
-- Name: cohort_simulations_simulation_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_simulations_simulation_id_v7_idx ON public.cohort_simulations USING btree (simulation_id);


--
-- Name: debug_info_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX debug_info_run_id_v7_idx ON public.debug_info USING btree (run_id);


--
-- Name: department_settings_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_settings_active_idx ON public.department_settings USING btree (active);


--
-- Name: department_settings_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_settings_department_id_v7_idx ON public.department_settings USING btree (department_id);


--
-- Name: department_settings_settings_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_settings_settings_id_v7_idx ON public.department_settings USING btree (settings_id);


--
-- Name: document_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_departments_department_id_v7_idx ON public.document_departments USING btree (department_id);


--
-- Name: document_departments_document_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_departments_document_id_v7_idx ON public.document_departments USING btree (document_id);


--
-- Name: document_fields_document_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_fields_document_id_v7_idx ON public.document_fields USING btree (document_id);


--
-- Name: document_fields_field_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_fields_field_id_v7_idx ON public.document_fields USING btree (field_id);


--
-- Name: document_groups_document_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_groups_document_id_v7_idx ON public.document_groups USING btree (document_id);


--
-- Name: document_groups_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_groups_group_id_v7_idx ON public.document_groups USING btree (group_id);


--
-- Name: document_templates_document_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_templates_document_id_v7_idx ON public.document_templates USING btree (document_id);


--
-- Name: document_templates_template_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_templates_template_id_v7_idx ON public.document_templates USING btree (template_id);


--
-- Name: document_tree_child_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_tree_child_id_v7_idx ON public.document_tree USING btree (child_id);


--
-- Name: document_tree_parent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_tree_parent_id_v7_idx ON public.document_tree USING btree (parent_id);


--
-- Name: document_uploads_document_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_uploads_document_id_v7_idx ON public.document_uploads USING btree (document_id);


--
-- Name: document_uploads_upload_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_uploads_upload_id_v7_idx ON public.document_uploads USING btree (upload_id);


--
-- Name: documents_classify_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_classify_agent_id_v7_idx ON public.documents USING btree (classify_agent_id);


--
-- Name: documents_document_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_document_agent_id_v7_idx ON public.documents USING btree (document_agent_id);


--
-- Name: eval_agents_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_agents_agent_id_idx ON public.eval_agents USING btree (agent_id);


--
-- Name: eval_agents_eval_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_agents_eval_id_idx ON public.eval_agents USING btree (eval_id);


--
-- Name: eval_attempts_archived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_attempts_archived_idx ON public.eval_attempts USING btree (archived);


--
-- Name: eval_attempts_eval_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_attempts_eval_id_v7_idx ON public.eval_attempts USING btree (eval_id);


--
-- Name: eval_attempts_infinite_mode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_attempts_infinite_mode_idx ON public.eval_attempts USING btree (infinite_mode);


--
-- Name: eval_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_departments_department_id_v7_idx ON public.eval_departments USING btree (department_id);


--
-- Name: eval_departments_eval_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_departments_eval_id_v7_idx ON public.eval_departments USING btree (eval_id);


--
-- Name: eval_groups_eval_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_groups_eval_id_idx ON public.eval_groups USING btree (eval_id);


--
-- Name: eval_groups_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_groups_group_id_idx ON public.eval_groups USING btree (group_id);


--
-- Name: eval_groups_rubric_grade_agents_eval_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_groups_rubric_grade_agents_eval_id_idx ON public.eval_groups_rubric_grade_agents USING btree (eval_id);


--
-- Name: eval_groups_rubric_grade_agents_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_groups_rubric_grade_agents_group_id_idx ON public.eval_groups_rubric_grade_agents USING btree (group_id);


--
-- Name: eval_groups_rubric_grade_agents_rubric_grade_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_groups_rubric_grade_agents_rubric_grade_agent_id_idx ON public.eval_groups_rubric_grade_agents USING btree (rubric_grade_agent_id);


--
-- Name: eval_runs_eval_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_runs_eval_id_v7_idx ON public.eval_runs USING btree (eval_id);


--
-- Name: eval_runs_rubric_grade_agents_eval_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_runs_rubric_grade_agents_eval_id_idx ON public.eval_runs_rubric_grade_agents USING btree (eval_id);


--
-- Name: eval_runs_rubric_grade_agents_rubric_grade_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_runs_rubric_grade_agents_rubric_grade_agent_id_idx ON public.eval_runs_rubric_grade_agents USING btree (rubric_grade_agent_id);


--
-- Name: eval_runs_rubric_grade_agents_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_runs_rubric_grade_agents_run_id_idx ON public.eval_runs_rubric_grade_agents USING btree (run_id);


--
-- Name: eval_runs_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_runs_run_id_v7_idx ON public.eval_runs USING btree (run_id);


--
-- Name: evals_use_groups_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evals_use_groups_idx ON public.evals USING btree (use_groups);


--
-- Name: examples_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX examples_created_at_idx ON public.examples USING btree (created_at);


--
-- Name: feedback_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_created_at_idx ON public.feedback USING btree (created_at);


--
-- Name: feedback_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_profile_id_v7_idx ON public.feedback USING btree (profile_id);


--
-- Name: feedback_resolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_resolved_idx ON public.feedback USING btree (resolved);


--
-- Name: feedback_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_type_idx ON public.feedback USING btree (type);


--
-- Name: feedbacks_grade_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedbacks_grade_id_v7_idx ON public.feedbacks USING btree (grade_id);


--
-- Name: feedbacks_grade_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedbacks_grade_idx ON public.feedbacks USING btree (grade_id);


--
-- Name: feedbacks_standard_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedbacks_standard_id_v7_idx ON public.feedbacks USING btree (standard_id);


--
-- Name: field_conditional_parameters_conditional_parameter_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_conditional_parameters_conditional_parameter_id_v7_idx ON public.field_conditional_parameters USING btree (conditional_parameter_id);


--
-- Name: field_conditional_parameters_field_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_conditional_parameters_field_id_v7_idx ON public.field_conditional_parameters USING btree (field_id);


--
-- Name: field_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_departments_department_id_v7_idx ON public.field_departments USING btree (department_id);


--
-- Name: field_departments_field_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_departments_field_id_v7_idx ON public.field_departments USING btree (field_id);


--
-- Name: grade_groups_chat_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_groups_chat_id_v7_idx ON public.grade_groups USING btree (chat_id);


--
-- Name: grade_groups_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_groups_group_id_v7_idx ON public.grade_groups USING btree (group_id);


--
-- Name: grades_rubric_grade_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grades_rubric_grade_agent_id_idx ON public.grades USING btree (rubric_grade_agent_id);


--
-- Name: grades_run_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grades_run_created_idx ON public.grades USING btree (run_id, created_at DESC);


--
-- Name: grades_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grades_run_id_v7_idx ON public.grades USING btree (run_id);


--
-- Name: group_order_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_order_agent_id_idx ON public.group_order USING btree (agent_id);


--
-- Name: group_order_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_order_group_id_idx ON public.group_order USING btree (group_id);


--
-- Name: group_order_group_position_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX group_order_group_position_uniq ON public.group_order USING btree (group_id, position_idx);


--
-- Name: group_runs_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_runs_group_id_idx ON public.group_runs USING btree (group_id);


--
-- Name: group_runs_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_runs_group_id_v7_idx ON public.group_runs USING btree (group_id);


--
-- Name: group_runs_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_runs_run_id_idx ON public.group_runs USING btree (run_id);


--
-- Name: group_runs_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_runs_run_id_v7_idx ON public.group_runs USING btree (run_id);


--
-- Name: group_stop_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_stop_group_id_idx ON public.group_stop USING btree (group_id);


--
-- Name: group_stop_group_position_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX group_stop_group_position_uniq ON public.group_stop USING btree (group_id, position_idx);


--
-- Name: group_stop_tool_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_stop_tool_id_idx ON public.group_stop USING btree (tool_id);


--
-- Name: groups_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_created_at_idx ON public.groups USING btree (created_at);


--
-- Name: groups_trace_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_trace_id_idx ON public.groups USING btree (trace_id);


--
-- Name: idx_cohort_profiles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_profiles_active ON public.cohort_profiles USING btree (active) WHERE (active = true);


--
-- Name: idx_cohort_simulations_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_simulations_active ON public.cohort_simulations USING btree (active) WHERE (active = true);


--
-- Name: idx_drafts_profile_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drafts_profile_resource ON public.drafts USING btree (profile_id, resource_type);


--
-- Name: idx_scenarios_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenarios_active ON public.scenarios USING btree (active) WHERE (active = true);


--
-- Name: idx_simulation_scenarios_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_scenarios_active ON public.simulation_scenarios USING btree (active) WHERE (active = true);


--
-- Name: image_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_departments_department_id_v7_idx ON public.image_departments USING btree (department_id);


--
-- Name: image_departments_image_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_departments_image_id_v7_idx ON public.image_departments USING btree (image_id);


--
-- Name: image_uploads_image_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_uploads_image_id_v7_idx ON public.image_uploads USING btree (image_id);


--
-- Name: image_uploads_upload_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_uploads_upload_id_v7_idx ON public.image_uploads USING btree (upload_id);


--
-- Name: images_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_active_idx ON public.images USING btree (active);


--
-- Name: images_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_created_at_idx ON public.images USING btree (created_at);


--
-- Name: images_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_name_idx ON public.images USING btree (name);


--
-- Name: images_tool_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_tool_call_id_idx ON public.images USING btree (tool_call_id);


--
-- Name: keys_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX keys_active_idx ON public.keys USING btree (active);


--
-- Name: keys_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX keys_name_idx ON public.keys USING btree (name);


--
-- Name: message_audio_message_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_audio_message_id_v7_idx ON public.message_audio USING btree (message_id);


--
-- Name: message_audio_upload_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_audio_upload_id_v7_idx ON public.message_audio USING btree (upload_id);


--
-- Name: message_content_message_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_content_message_id_v7_idx ON public.message_content USING btree (message_id);


--
-- Name: message_content_tool_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_content_tool_call_id_idx ON public.message_content USING btree (tool_call_id);


--
-- Name: message_feedback_highlight_message_feedback_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_feedback_highlight_message_feedback_id_v7_idx ON public.message_feedback_highlight USING btree (message_feedback_id);


--
-- Name: message_feedback_replace_message_feedback_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_feedback_replace_message_feedback_id_v7_idx ON public.message_feedback_replace USING btree (message_feedback_id);


--
-- Name: message_feedbacks_grade_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_feedbacks_grade_id_v7_idx ON public.message_feedbacks USING btree (grade_id);


--
-- Name: message_feedbacks_message_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_feedbacks_message_id_v7_idx ON public.message_feedbacks USING btree (message_id);


--
-- Name: message_feedbacks_tool_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_feedbacks_tool_call_id_idx ON public.message_feedbacks USING btree (tool_call_id);


--
-- Name: message_personas_message_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_personas_message_id_v7_idx ON public.message_personas USING btree (message_id);


--
-- Name: message_personas_persona_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_personas_persona_id_v7_idx ON public.message_personas USING btree (persona_id);


--
-- Name: message_runs_message_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_runs_message_id_v7_idx ON public.message_runs USING btree (message_id);


--
-- Name: message_runs_run_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_runs_run_created_idx ON public.message_runs USING btree (run_id, created_at);


--
-- Name: message_runs_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_runs_run_id_v7_idx ON public.message_runs USING btree (run_id);


--
-- Name: message_tree_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_tree_active_idx ON public.message_tree USING btree (active);


--
-- Name: message_tree_child_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_tree_child_id_v7_idx ON public.message_tree USING btree (child_id);


--
-- Name: message_tree_parent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_tree_parent_id_v7_idx ON public.message_tree USING btree (parent_id);


--
-- Name: model_departments_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_departments_active_idx ON public.model_departments USING btree (active);


--
-- Name: model_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_departments_department_id_v7_idx ON public.model_departments USING btree (department_id);


--
-- Name: model_departments_model_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_departments_model_id_v7_idx ON public.model_departments USING btree (model_id);


--
-- Name: model_endpoints_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_endpoints_active_idx ON public.model_endpoints USING btree (active);


--
-- Name: model_endpoints_model_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_endpoints_model_id_v7_idx ON public.model_endpoints USING btree (model_id);


--
-- Name: model_modalities_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_modalities_active_idx ON public.model_modalities USING btree (active);


--
-- Name: model_modalities_is_input_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_modalities_is_input_idx ON public.model_modalities USING btree (is_input);


--
-- Name: model_modalities_modality_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_modalities_modality_idx ON public.model_modalities USING btree (modality);


--
-- Name: model_modalities_model_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_modalities_model_id_v7_idx ON public.model_modalities USING btree (model_id);


--
-- Name: model_pricing_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_pricing_active_idx ON public.model_pricing USING btree (active);


--
-- Name: model_pricing_model_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_pricing_model_id_v7_idx ON public.model_pricing USING btree (model_id);


--
-- Name: model_pricing_pricing_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_pricing_pricing_type_idx ON public.model_pricing USING btree (pricing_type);


--
-- Name: model_pricing_unit_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_pricing_unit_id_v7_idx ON public.model_pricing USING btree (unit_id);


--
-- Name: model_qualities_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_qualities_active_idx ON public.model_qualities USING btree (active);


--
-- Name: model_qualities_model_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_qualities_model_id_v7_idx ON public.model_qualities USING btree (model_id);


--
-- Name: model_qualities_quality_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_qualities_quality_idx ON public.model_qualities USING btree (quality);


--
-- Name: model_reasoning_levels_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_reasoning_levels_active_idx ON public.model_reasoning_levels USING btree (active);


--
-- Name: model_reasoning_levels_model_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_reasoning_levels_model_id_v7_idx ON public.model_reasoning_levels USING btree (model_id);


--
-- Name: model_reasoning_levels_reasoning_level_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_reasoning_levels_reasoning_level_idx ON public.model_reasoning_levels USING btree (reasoning_level);


--
-- Name: model_runs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_runs_created_at_idx ON public.runs USING btree (created_at);


--
-- Name: model_temperature_levels_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_temperature_levels_active_idx ON public.model_temperature_levels USING btree (active);


--
-- Name: model_temperature_levels_model_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_temperature_levels_model_id_v7_idx ON public.model_temperature_levels USING btree (model_id);


--
-- Name: model_temperature_levels_temperature_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_temperature_levels_temperature_idx ON public.model_temperature_levels USING btree (temperature);


--
-- Name: model_voices_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_voices_active_idx ON public.model_voices USING btree (active);


--
-- Name: model_voices_model_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_voices_model_id_v7_idx ON public.model_voices USING btree (model_id);


--
-- Name: model_voices_voice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_voices_voice_idx ON public.model_voices USING btree (voice);


--
-- Name: models_provider_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX models_provider_id_v7_idx ON public.models USING btree (provider_id);


--
-- Name: objective_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX objective_departments_department_id_v7_idx ON public.objective_departments USING btree (department_id);


--
-- Name: objective_departments_objective_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX objective_departments_objective_id_v7_idx ON public.objective_departments USING btree (objective_id);


--
-- Name: objectives_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX objectives_created_at_idx ON public.objectives USING btree (created_at);


--
-- Name: objectives_tool_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX objectives_tool_call_id_idx ON public.objectives USING btree (tool_call_id);


--
-- Name: options_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX options_active_idx ON public.options USING btree (active);


--
-- Name: parameter_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_departments_department_id_v7_idx ON public.parameter_departments USING btree (department_id);


--
-- Name: parameter_departments_parameter_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_departments_parameter_id_v7_idx ON public.parameter_departments USING btree (parameter_id);


--
-- Name: parameter_fields_field_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_fields_field_id_v7_idx ON public.parameter_fields USING btree (field_id);


--
-- Name: parameter_fields_parameter_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_fields_parameter_id_v7_idx ON public.parameter_fields USING btree (parameter_id);


--
-- Name: persona_departments_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_departments_active_idx ON public.persona_departments USING btree (active);


--
-- Name: persona_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_departments_department_id_v7_idx ON public.persona_departments USING btree (department_id);


--
-- Name: persona_departments_persona_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_departments_persona_id_v7_idx ON public.persona_departments USING btree (persona_id);


--
-- Name: persona_examples_example_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_examples_example_id_v7_idx ON public.persona_examples USING btree (example_id);


--
-- Name: persona_examples_persona_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_examples_persona_id_v7_idx ON public.persona_examples USING btree (persona_id);


--
-- Name: persona_fields_field_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_fields_field_id_v7_idx ON public.persona_fields USING btree (field_id);


--
-- Name: persona_fields_persona_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_fields_persona_id_v7_idx ON public.persona_fields USING btree (persona_id);


--
-- Name: personas_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personas_id_idx ON public.personas USING btree (id);


--
-- Name: problem_statement_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problem_statement_departments_department_id_v7_idx ON public.problem_statement_departments USING btree (department_id);


--
-- Name: problem_statement_departments_problem_statement_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problem_statement_departments_problem_statement_id_v7_idx ON public.problem_statement_departments USING btree (problem_statement_id);


--
-- Name: problem_statements_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problem_statements_created_at_idx ON public.problem_statements USING btree (created_at);


--
-- Name: problem_statements_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problem_statements_name_idx ON public.problem_statements USING btree (name);


--
-- Name: problem_statements_tool_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problem_statements_tool_call_id_idx ON public.problem_statements USING btree (tool_call_id);


--
-- Name: profile_activity_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_activity_created_at_idx ON public.profile_activity USING btree (created_at);


--
-- Name: profile_activity_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_activity_profile_id_v7_idx ON public.profile_activity USING btree (profile_id);


--
-- Name: profile_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_departments_department_id_v7_idx ON public.profile_departments USING btree (department_id);


--
-- Name: profile_departments_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_departments_profile_id_v7_idx ON public.profile_departments USING btree (profile_id);


--
-- Name: profile_emails_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_emails_email_idx ON public.profile_emails USING btree (email);


--
-- Name: profile_emails_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profile_emails_email_unique ON public.profile_emails USING btree (email);


--
-- Name: profile_emails_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_emails_profile_id_v7_idx ON public.profile_emails USING btree (profile_id);


--
-- Name: profile_request_limits_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_request_limits_profile_id_v7_idx ON public.profile_request_limits USING btree (profile_id);


--
-- Name: prompt_departments_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prompt_departments_active_idx ON public.prompt_departments USING btree (active);


--
-- Name: prompt_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prompt_departments_department_id_v7_idx ON public.prompt_departments USING btree (department_id);


--
-- Name: prompt_departments_prompt_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prompt_departments_prompt_id_v7_idx ON public.prompt_departments USING btree (prompt_id);


--
-- Name: prompts_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prompts_created_at_idx ON public.prompts USING btree (created_at);


--
-- Name: provider_endpoints_provider_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_endpoints_provider_id_v7_idx ON public.provider_endpoints USING btree (provider_id);


--
-- Name: providers_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX providers_active_idx ON public.providers USING btree (active);


--
-- Name: providers_value_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX providers_value_unique ON public.providers USING btree (value) WHERE (active = true);


--
-- Name: question_answers_option_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX question_answers_option_id_v7_idx ON public.question_answers USING btree (option_id);


--
-- Name: question_answers_question_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX question_answers_question_id_v7_idx ON public.question_answers USING btree (question_id);


--
-- Name: question_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX question_departments_department_id_v7_idx ON public.question_departments USING btree (department_id);


--
-- Name: question_departments_question_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX question_departments_question_id_v7_idx ON public.question_departments USING btree (question_id);


--
-- Name: question_options_option_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX question_options_option_id_v7_idx ON public.question_options USING btree (option_id);


--
-- Name: question_options_question_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX question_options_question_id_v7_idx ON public.question_options USING btree (question_id);


--
-- Name: questions_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX questions_active_idx ON public.questions USING btree (active);


--
-- Name: questions_tool_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX questions_tool_call_id_idx ON public.questions USING btree (tool_call_id);


--
-- Name: quiz_responses_option_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quiz_responses_option_id_v7_idx ON public.quiz_responses USING btree (option_id);


--
-- Name: quiz_responses_question_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quiz_responses_question_id_v7_idx ON public.quiz_responses USING btree (question_id);


--
-- Name: quiz_responses_quiz_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quiz_responses_quiz_id_v7_idx ON public.quiz_responses USING btree (quiz_id);


--
-- Name: quizzes_video_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quizzes_video_id_v7_idx ON public.quizzes USING btree (video_id);


--
-- Name: rubric_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_departments_department_id_v7_idx ON public.rubric_departments USING btree (department_id);


--
-- Name: rubric_departments_rubric_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_departments_rubric_id_v7_idx ON public.rubric_departments USING btree (rubric_id);


--
-- Name: rubric_grade_agents_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_grade_agents_agent_id_idx ON public.rubric_grade_agents USING btree (agent_id);


--
-- Name: rubric_grade_agents_audio_audio_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_grade_agents_audio_audio_agent_id_idx ON public.rubric_grade_agents_audio USING btree (audio_agent_id);


--
-- Name: rubric_grade_agents_grade_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_grade_agents_grade_agent_id_idx ON public.rubric_grade_agents USING btree (grade_agent_id);


--
-- Name: rubric_grade_agents_rubric_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_grade_agents_rubric_id_idx ON public.rubric_grade_agents USING btree (rubric_id);


--
-- Name: rubric_grade_agents_voice_rubric_grade_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_grade_agents_voice_rubric_grade_agent_id_idx ON public.rubric_grade_agents_audio USING btree (rubric_grade_agent_id);


--
-- Name: rubric_groups_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_groups_group_id_v7_idx ON public.rubric_groups USING btree (group_id);


--
-- Name: rubric_groups_rubric_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_groups_rubric_id_v7_idx ON public.rubric_groups USING btree (rubric_id);


--
-- Name: rubric_standard_groups_rubric_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_standard_groups_rubric_id_idx ON public.rubric_standard_groups USING btree (rubric_id);


--
-- Name: rubric_standard_groups_rubric_position_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX rubric_standard_groups_rubric_position_uniq ON public.rubric_standard_groups USING btree (rubric_id, "position");


--
-- Name: rubric_standard_groups_standard_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_standard_groups_standard_group_id_idx ON public.rubric_standard_groups USING btree (standard_group_id);


--
-- Name: rubrics_agent_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubrics_agent_role_idx ON public.rubrics USING btree (agent_role);


--
-- Name: rubrics_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubrics_id_idx ON public.rubrics USING btree (id);


--
-- Name: rubrics_rubric_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubrics_rubric_agent_id_v7_idx ON public.rubrics USING btree (rubric_agent_id);


--
-- Name: run_models_model_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_models_model_id_v7_idx ON public.run_models USING btree (model_id);


--
-- Name: run_models_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_models_run_id_v7_idx ON public.run_models USING btree (run_id);


--
-- Name: run_personas_persona_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_personas_persona_id_v7_idx ON public.run_personas USING btree (persona_id);


--
-- Name: run_personas_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_personas_run_id_v7_idx ON public.run_personas USING btree (run_id);


--
-- Name: run_pricing_usage_pricing_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_pricing_usage_pricing_type_idx ON public.run_pricing_usage USING btree (pricing_type);


--
-- Name: run_pricing_usage_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_pricing_usage_run_id_v7_idx ON public.run_pricing_usage USING btree (run_id);


--
-- Name: run_pricing_usage_unit_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_pricing_usage_unit_id_v7_idx ON public.run_pricing_usage USING btree (unit_id);


--
-- Name: run_profiles_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_profiles_profile_id_v7_idx ON public.run_profiles USING btree (profile_id);


--
-- Name: run_profiles_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_profiles_run_id_v7_idx ON public.run_profiles USING btree (run_id);


--
-- Name: runs_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX runs_agent_id_v7_idx ON public.runs USING btree (agent_id);


--
-- Name: runs_key_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX runs_key_id_v7_idx ON public.runs USING btree (key_id);


--
-- Name: scenario_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_departments_department_id_v7_idx ON public.scenario_departments USING btree (department_id);


--
-- Name: scenario_departments_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_departments_scenario_id_v7_idx ON public.scenario_departments USING btree (scenario_id);


--
-- Name: scenario_document_ranges_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_document_ranges_scenario_id_v7_idx ON public.scenario_document_ranges USING btree (scenario_id);


--
-- Name: scenario_documents_document_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_documents_document_id_v7_idx ON public.scenario_documents USING btree (document_id);


--
-- Name: scenario_documents_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_documents_scenario_id_v7_idx ON public.scenario_documents USING btree (scenario_id);


--
-- Name: scenario_field_ranges_parameter_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_field_ranges_parameter_id_v7_idx ON public.scenario_field_ranges USING btree (parameter_id);


--
-- Name: scenario_field_ranges_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_field_ranges_scenario_id_v7_idx ON public.scenario_field_ranges USING btree (scenario_id);


--
-- Name: scenario_fields_field_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_fields_field_id_v7_idx ON public.scenario_fields USING btree (field_id);


--
-- Name: scenario_fields_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_fields_scenario_id_v7_idx ON public.scenario_fields USING btree (scenario_id);


--
-- Name: scenario_groups_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_groups_group_id_v7_idx ON public.scenario_groups USING btree (group_id);


--
-- Name: scenario_groups_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_groups_scenario_id_v7_idx ON public.scenario_groups USING btree (scenario_id);


--
-- Name: scenario_images_image_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_images_image_id_v7_idx ON public.scenario_images USING btree (image_id);


--
-- Name: scenario_images_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_images_scenario_id_v7_idx ON public.scenario_images USING btree (scenario_id);


--
-- Name: scenario_objectives_objective_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_objectives_objective_id_v7_idx ON public.scenario_objectives USING btree (objective_id);


--
-- Name: scenario_objectives_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_objectives_scenario_id_v7_idx ON public.scenario_objectives USING btree (scenario_id);


--
-- Name: scenario_parameter_ranges_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_parameter_ranges_scenario_id_v7_idx ON public.scenario_parameter_ranges USING btree (scenario_id);


--
-- Name: scenario_parameters_parameter_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_parameters_parameter_id_v7_idx ON public.scenario_parameters USING btree (parameter_id);


--
-- Name: scenario_parameters_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_parameters_scenario_id_v7_idx ON public.scenario_parameters USING btree (scenario_id);


--
-- Name: scenario_persona_ranges_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_persona_ranges_scenario_id_v7_idx ON public.scenario_persona_ranges USING btree (scenario_id);


--
-- Name: scenario_personas_persona_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_personas_persona_id_v7_idx ON public.scenario_personas USING btree (persona_id);


--
-- Name: scenario_personas_scenario_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_personas_scenario_active_idx ON public.scenario_personas USING btree (scenario_id, persona_id) WHERE (active = true);


--
-- Name: scenario_personas_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_personas_scenario_id_v7_idx ON public.scenario_personas USING btree (scenario_id);


--
-- Name: scenario_problem_statements_problem_statement_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_problem_statements_problem_statement_id_v7_idx ON public.scenario_problem_statements USING btree (problem_statement_id);


--
-- Name: scenario_problem_statements_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_problem_statements_scenario_id_v7_idx ON public.scenario_problem_statements USING btree (scenario_id);


--
-- Name: scenario_question_times_scenario_id_question_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_question_times_scenario_id_question_id_idx ON public.scenario_question_times USING btree (scenario_id, question_id);


--
-- Name: scenario_question_times_scenario_id_question_id_video_id_ac_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_question_times_scenario_id_question_id_video_id_ac_idx ON public.scenario_question_times USING btree (scenario_id, question_id, video_id, active);


--
-- Name: scenario_question_times_scenario_id_video_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_question_times_scenario_id_video_id_idx ON public.scenario_question_times USING btree (scenario_id, video_id);


--
-- Name: scenario_questions_question_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_questions_question_id_v7_idx ON public.scenario_questions USING btree (question_id);


--
-- Name: scenario_questions_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_questions_scenario_id_v7_idx ON public.scenario_questions USING btree (scenario_id);


--
-- Name: scenario_time_limits_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_time_limits_scenario_id_idx ON public.scenario_time_limits USING btree (scenario_id);


--
-- Name: scenario_time_limits_simulation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_time_limits_simulation_id_idx ON public.scenario_time_limits USING btree (simulation_id);


--
-- Name: scenario_tree_child_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_tree_child_id_v7_idx ON public.scenario_tree USING btree (child_id);


--
-- Name: scenario_tree_parent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_tree_parent_id_v7_idx ON public.scenario_tree USING btree (parent_id);


--
-- Name: scenario_video_images_image_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_video_images_image_id_v7_idx ON public.scenario_video_images USING btree (image_id);


--
-- Name: scenario_video_images_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_video_images_scenario_id_v7_idx ON public.scenario_video_images USING btree (scenario_id);


--
-- Name: scenario_video_images_video_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_video_images_video_id_v7_idx ON public.scenario_video_images USING btree (video_id);


--
-- Name: scenario_videos_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_videos_scenario_id_v7_idx ON public.scenario_videos USING btree (scenario_id);


--
-- Name: scenario_videos_video_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_videos_video_id_v7_idx ON public.scenario_videos USING btree (video_id);


--
-- Name: scenarios_id_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenarios_id_active_idx ON public.scenarios USING btree (id, active);


--
-- Name: scenarios_image_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenarios_image_agent_id_v7_idx ON public.scenarios USING btree (image_agent_id);


--
-- Name: scenarios_scenario_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenarios_scenario_agent_id_v7_idx ON public.scenarios USING btree (scenario_agent_id);


--
-- Name: scenarios_video_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenarios_video_agent_id_v7_idx ON public.scenarios USING btree (video_agent_id);


--
-- Name: service_health_service_ts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_health_service_ts_idx ON public.service_health USING btree (service, ts);


--
-- Name: setting_auth_keys_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auth_keys_active_idx ON public.setting_auth_keys USING btree (active);


--
-- Name: setting_auth_keys_auth_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auth_keys_auth_id_v7_idx ON public.setting_auth_keys USING btree (auth_id);


--
-- Name: setting_auth_keys_auth_item_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auth_keys_auth_item_id_v7_idx ON public.setting_auth_keys USING btree (auth_item_id);


--
-- Name: setting_auth_keys_key_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auth_keys_key_id_v7_idx ON public.setting_auth_keys USING btree (key_id);


--
-- Name: setting_auth_keys_settings_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auth_keys_settings_id_v7_idx ON public.setting_auth_keys USING btree (settings_id);


--
-- Name: setting_auth_values_auth_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auth_values_auth_id_v7_idx ON public.setting_auth_values USING btree (auth_id);


--
-- Name: setting_auth_values_auth_item_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auth_values_auth_item_id_v7_idx ON public.setting_auth_values USING btree (auth_item_id);


--
-- Name: setting_auth_values_settings_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auth_values_settings_id_v7_idx ON public.setting_auth_values USING btree (settings_id);


--
-- Name: setting_auths_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auths_active_idx ON public.setting_auths USING btree (active);


--
-- Name: setting_auths_auth_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auths_auth_id_v7_idx ON public.setting_auths USING btree (auth_id);


--
-- Name: setting_auths_settings_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auths_settings_id_v7_idx ON public.setting_auths USING btree (settings_id);


--
-- Name: setting_provider_keys_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_provider_keys_active_idx ON public.setting_provider_keys USING btree (active);


--
-- Name: setting_provider_keys_key_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_provider_keys_key_id_v7_idx ON public.setting_provider_keys USING btree (key_id);


--
-- Name: setting_provider_keys_provider_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_provider_keys_provider_id_v7_idx ON public.setting_provider_keys USING btree (provider_id);


--
-- Name: setting_provider_keys_settings_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_provider_keys_settings_id_v7_idx ON public.setting_provider_keys USING btree (settings_id);


--
-- Name: setting_providers_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_providers_active_idx ON public.setting_providers USING btree (active);


--
-- Name: setting_providers_provider_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_providers_provider_id_v7_idx ON public.setting_providers USING btree (provider_id);


--
-- Name: setting_providers_settings_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_providers_settings_id_v7_idx ON public.setting_providers USING btree (settings_id);


--
-- Name: settings_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_active_idx ON public.settings USING btree (active);


--
-- Name: settings_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_created_at_idx ON public.settings USING btree (created_at);


--
-- Name: settings_default_account_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_default_account_active_idx ON public.settings_default_account USING btree (active);


--
-- Name: settings_default_account_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_default_account_profile_id_v7_idx ON public.settings_default_account USING btree (profile_id);


--
-- Name: settings_default_account_settings_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_default_account_settings_id_v7_idx ON public.settings_default_account USING btree (settings_id);


--
-- Name: settings_default_department_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_default_department_active_idx ON public.settings_default_department USING btree (active);


--
-- Name: settings_default_department_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_default_department_department_id_v7_idx ON public.settings_default_department USING btree (department_id);


--
-- Name: settings_default_department_settings_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_default_department_settings_id_v7_idx ON public.settings_default_department USING btree (settings_id);


--
-- Name: settings_default_guest_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_default_guest_active_idx ON public.settings_default_guest USING btree (active);


--
-- Name: settings_default_guest_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_default_guest_profile_id_v7_idx ON public.settings_default_guest USING btree (profile_id);


--
-- Name: settings_default_guest_settings_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_default_guest_settings_id_v7_idx ON public.settings_default_guest USING btree (settings_id);


--
-- Name: simulation_attempts_archived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_attempts_archived_idx ON public.simulation_attempts USING btree (archived);


--
-- Name: simulation_attempts_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_attempts_created_at_idx ON public.simulation_attempts USING btree (created_at);


--
-- Name: simulation_attempts_simulation_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_attempts_simulation_id_v7_idx ON public.simulation_attempts USING btree (simulation_id);


--
-- Name: simulation_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_departments_department_id_v7_idx ON public.simulation_departments USING btree (department_id);


--
-- Name: simulation_departments_simulation_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_departments_simulation_id_v7_idx ON public.simulation_departments USING btree (simulation_id);


--
-- Name: simulation_hints_simulation_message_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_hints_simulation_message_id_v7_idx ON public.simulation_hints USING btree (simulation_message_id);


--
-- Name: simulation_scenarios_rubric_grade_agents_rubric_grade_agent_id_; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_scenarios_rubric_grade_agents_rubric_grade_agent_id_ ON public.simulation_scenarios_rubric_grade_agents USING btree (rubric_grade_agent_id);


--
-- Name: simulation_scenarios_rubric_grade_agents_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_scenarios_rubric_grade_agents_scenario_id_idx ON public.simulation_scenarios_rubric_grade_agents USING btree (scenario_id);


--
-- Name: simulation_scenarios_rubric_grade_agents_simulation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_scenarios_rubric_grade_agents_simulation_id_idx ON public.simulation_scenarios_rubric_grade_agents USING btree (simulation_id);


--
-- Name: simulation_scenarios_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_scenarios_scenario_id_v7_idx ON public.simulation_scenarios USING btree (scenario_id);


--
-- Name: simulation_scenarios_simulation_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_scenarios_simulation_id_v7_idx ON public.simulation_scenarios USING btree (simulation_id);


--
-- Name: simulations_hint_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulations_hint_agent_id_v7_idx ON public.simulations USING btree (hint_agent_id);


--
-- Name: simulations_id_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulations_id_active_idx ON public.simulations USING btree (id, active);


--
-- Name: simulations_simulation_text_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulations_simulation_text_agent_id_v7_idx ON public.simulations USING btree (simulation_text_agent_id);


--
-- Name: simulations_simulation_voice_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulations_simulation_voice_agent_id_v7_idx ON public.simulations USING btree (simulation_voice_agent_id);


--
-- Name: standard_groups_tool_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standard_groups_tool_call_id_idx ON public.standard_groups USING btree (tool_call_id);


--
-- Name: standards_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standards_group_idx ON public.standards USING btree (standard_group_id);


--
-- Name: standards_standard_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standards_standard_group_id_v7_idx ON public.standards USING btree (standard_group_id);


--
-- Name: templates_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX templates_created_at_idx ON public.templates USING btree (created_at);


--
-- Name: templates_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX templates_name_idx ON public.templates USING btree (name);


--
-- Name: templates_tool_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX templates_tool_call_id_idx ON public.templates USING btree (tool_call_id);


--
-- Name: templates_upload_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX templates_upload_id_v7_idx ON public.templates USING btree (upload_id);


--
-- Name: test_runs_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_runs_run_id_v7_idx ON public.test_runs USING btree (run_id);


--
-- Name: test_runs_test_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_runs_test_id_v7_idx ON public.test_runs USING btree (test_id);


--
-- Name: tests_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tests_run_id_v7_idx ON public.tests USING btree (run_id);


--
-- Name: tool_call_arguments_tool_call_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_call_arguments_tool_call_id_v7_idx ON public.tool_call_arguments USING btree (tool_call_id);


--
-- Name: tool_call_results_tool_call_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_call_results_tool_call_id_v7_idx ON public.tool_call_results USING btree (tool_call_id);


--
-- Name: tool_call_runs_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_call_runs_run_id_v7_idx ON public.tool_call_runs USING btree (run_id);


--
-- Name: tool_call_runs_tool_call_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_call_runs_tool_call_id_v7_idx ON public.tool_call_runs USING btree (tool_call_id);


--
-- Name: tool_calls_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tool_calls_call_id_idx ON public.tool_calls USING btree (call_id);


--
-- Name: tool_calls_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_calls_created_at_idx ON public.tool_calls USING btree (created_at);


--
-- Name: tool_calls_tool_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_calls_tool_id_idx ON public.tool_calls USING btree (tool_id);


--
-- Name: tools_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tools_active_idx ON public.tools USING btree (active);


--
-- Name: tools_agent_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tools_agent_role_idx ON public.tools USING btree (agent_role);


--
-- Name: tools_tool_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tools_tool_type_idx ON public.tools USING btree (tool_type);


--
-- Name: units_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX units_active_idx ON public.units USING btree (active);


--
-- Name: units_unique_name_value_category_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX units_unique_name_value_category_active ON public.units USING btree (name, value, unit_category) WHERE (active = true);


--
-- Name: units_unit_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX units_unit_category_idx ON public.units USING btree (unit_category);


--
-- Name: units_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX units_value_idx ON public.units USING btree (value);


--
-- Name: uploads_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX uploads_created_at_idx ON public.uploads USING btree (created_at);


--
-- Name: uploads_file_path_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX uploads_file_path_idx ON public.uploads USING btree (file_path);


--
-- Name: video_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX video_departments_department_id_v7_idx ON public.video_departments USING btree (department_id);


--
-- Name: video_departments_video_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX video_departments_video_id_v7_idx ON public.video_departments USING btree (video_id);


--
-- Name: video_uploads_upload_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX video_uploads_upload_id_v7_idx ON public.video_uploads USING btree (upload_id);


--
-- Name: video_uploads_video_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX video_uploads_video_id_v7_idx ON public.video_uploads USING btree (video_id);


--
-- Name: videos_tool_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX videos_tool_call_id_idx ON public.videos USING btree (tool_call_id);


--
-- Name: row_changes trg_audit_notify_row_change; Type: TRIGGER; Schema: audit; Owner: -
--

CREATE TRIGGER trg_audit_notify_row_change AFTER INSERT ON audit.row_changes FOR EACH ROW EXECUTE FUNCTION audit.notify_row_change();


--
-- Name: scenario_document_ranges scenario_document_ranges_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER scenario_document_ranges_updated_at BEFORE UPDATE ON public.scenario_document_ranges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: scenario_field_ranges scenario_field_ranges_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER scenario_field_ranges_updated_at BEFORE UPDATE ON public.scenario_field_ranges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: scenario_parameter_ranges scenario_parameter_ranges_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER scenario_parameter_ranges_updated_at BEFORE UPDATE ON public.scenario_parameter_ranges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: scenario_persona_ranges scenario_persona_ranges_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER scenario_persona_ranges_updated_at BEFORE UPDATE ON public.scenario_persona_ranges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: agents trg_audit_agents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_agents AFTER INSERT OR DELETE OR UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: cohorts trg_audit_cohorts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_cohorts AFTER INSERT OR DELETE OR UPDATE ON public.cohorts FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: debug_info trg_audit_debug_info; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_debug_info AFTER INSERT OR DELETE OR UPDATE ON public.debug_info FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: departments trg_audit_departments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_departments AFTER INSERT OR DELETE OR UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: documents trg_audit_documents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_documents AFTER INSERT OR DELETE OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: fields trg_audit_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_fields AFTER INSERT OR DELETE OR UPDATE ON public.fields FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: runs trg_audit_model_runs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_model_runs AFTER INSERT OR DELETE OR UPDATE ON public.runs FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: models trg_audit_models; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_models AFTER INSERT OR DELETE OR UPDATE ON public.models FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: parameters trg_audit_parameters; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_parameters AFTER INSERT OR DELETE OR UPDATE ON public.parameters FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: personas trg_audit_personas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_personas AFTER INSERT OR DELETE OR UPDATE ON public.personas FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: profiles trg_audit_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_profiles AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: rubrics trg_audit_rubrics; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_rubrics AFTER INSERT OR DELETE OR UPDATE ON public.rubrics FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: scenarios trg_audit_scenarios; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_scenarios AFTER INSERT OR DELETE OR UPDATE ON public.scenarios FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: simulation_attempts trg_audit_simulation_attempts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_simulation_attempts AFTER INSERT OR DELETE OR UPDATE ON public.simulation_attempts FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: chats trg_audit_simulation_chats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_simulation_chats AFTER INSERT OR DELETE OR UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: simulation_hints trg_audit_simulation_hints; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_simulation_hints AFTER INSERT OR DELETE OR UPDATE ON public.simulation_hints FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('simulation_message_id', 'idx');


--
-- Name: simulations trg_audit_simulations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_simulations AFTER INSERT OR DELETE OR UPDATE ON public.simulations FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: standard_groups trg_audit_standard_groups; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_standard_groups AFTER INSERT OR DELETE OR UPDATE ON public.standard_groups FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: standards trg_audit_standards; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_standards AFTER INSERT OR DELETE OR UPDATE ON public.standards FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: activity activity_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: agent_department_prompts agent_department_prompts_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_department_prompts
    ADD CONSTRAINT agent_department_prompts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: agent_department_prompts agent_department_prompts_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_department_prompts
    ADD CONSTRAINT agent_department_prompts_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: agent_department_prompts agent_department_prompts_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_department_prompts
    ADD CONSTRAINT agent_department_prompts_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id);


--
-- Name: agent_departments agent_departments_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_departments
    ADD CONSTRAINT agent_departments_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: agent_departments agent_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_departments
    ADD CONSTRAINT agent_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: agent_prompts agent_prompts_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_prompts
    ADD CONSTRAINT agent_prompts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: agent_prompts agent_prompts_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_prompts
    ADD CONSTRAINT agent_prompts_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id);


--
-- Name: agent_reasoning_levels agent_reasoning_levels_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_reasoning_levels
    ADD CONSTRAINT agent_reasoning_levels_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: agent_reasoning_levels agent_reasoning_levels_model_reasoning_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_reasoning_levels
    ADD CONSTRAINT agent_reasoning_levels_model_reasoning_level_id_fkey FOREIGN KEY (model_reasoning_level_id) REFERENCES public.model_reasoning_levels(id);


--
-- Name: agent_temperature_levels agent_temperature_levels_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_temperature_levels
    ADD CONSTRAINT agent_temperature_levels_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: agent_temperature_levels agent_temperature_levels_model_temperature_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_temperature_levels
    ADD CONSTRAINT agent_temperature_levels_model_temperature_level_id_fkey FOREIGN KEY (model_temperature_level_id) REFERENCES public.model_temperature_levels(id);


--
-- Name: agent_tools agent_tools_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tools
    ADD CONSTRAINT agent_tools_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_tools agent_tools_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tools
    ADD CONSTRAINT agent_tools_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE;


--
-- Name: agent_voices agent_voices_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_voices
    ADD CONSTRAINT agent_voices_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: agent_voices agent_voices_model_voice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_voices
    ADD CONSTRAINT agent_voices_model_voice_id_fkey FOREIGN KEY (model_voice_id) REFERENCES public.model_voices(id);


--
-- Name: agents agents_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: attempt_chats attempt_chats_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_chats
    ADD CONSTRAINT attempt_chats_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.simulation_attempts(id);


--
-- Name: attempt_chats attempt_chats_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_chats
    ADD CONSTRAINT attempt_chats_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id);


--
-- Name: attempt_profiles attempt_profiles_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_profiles
    ADD CONSTRAINT attempt_profiles_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.simulation_attempts(id);


--
-- Name: attempt_profiles attempt_profiles_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_profiles
    ADD CONSTRAINT attempt_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: attempt_quizzes attempt_quizzes_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_quizzes
    ADD CONSTRAINT attempt_quizzes_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.simulation_attempts(id);


--
-- Name: attempt_quizzes attempt_quizzes_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_quizzes
    ADD CONSTRAINT attempt_quizzes_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id);


--
-- Name: attempt_tests attempt_tests_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_tests
    ADD CONSTRAINT attempt_tests_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.eval_attempts(id);


--
-- Name: attempt_tests attempt_tests_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_tests
    ADD CONSTRAINT attempt_tests_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id);


--
-- Name: auth_items auth_items_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_items
    ADD CONSTRAINT auth_items_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id);


--
-- Name: chat_groups chat_groups_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_groups
    ADD CONSTRAINT chat_groups_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id);


--
-- Name: chat_groups chat_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_groups
    ADD CONSTRAINT chat_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: chats chats_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: cohort_departments cohort_departments_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_departments
    ADD CONSTRAINT cohort_departments_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: cohort_departments cohort_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_departments
    ADD CONSTRAINT cohort_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: cohort_profiles cohort_profiles_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_profiles
    ADD CONSTRAINT cohort_profiles_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: cohort_profiles cohort_profiles_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_profiles
    ADD CONSTRAINT cohort_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: cohort_simulations cohort_simulations_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_simulations
    ADD CONSTRAINT cohort_simulations_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: cohort_simulations cohort_simulations_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_simulations
    ADD CONSTRAINT cohort_simulations_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulations(id);


--
-- Name: debug_info debug_info_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debug_info
    ADD CONSTRAINT debug_info_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: department_settings department_settings_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_settings
    ADD CONSTRAINT department_settings_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: department_settings department_settings_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_settings
    ADD CONSTRAINT department_settings_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.settings(id);


--
-- Name: document_departments document_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_departments
    ADD CONSTRAINT document_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: document_departments document_departments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_departments
    ADD CONSTRAINT document_departments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: document_fields document_fields_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_fields
    ADD CONSTRAINT document_fields_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: document_fields document_fields_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_fields
    ADD CONSTRAINT document_fields_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id);


--
-- Name: document_groups document_groups_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_groups
    ADD CONSTRAINT document_groups_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: document_groups document_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_groups
    ADD CONSTRAINT document_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: document_templates document_templates_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: document_templates document_templates_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id);


--
-- Name: document_tree document_tree_child_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tree
    ADD CONSTRAINT document_tree_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.documents(id);


--
-- Name: document_tree document_tree_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tree
    ADD CONSTRAINT document_tree_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.documents(id);


--
-- Name: document_uploads document_uploads_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_uploads
    ADD CONSTRAINT document_uploads_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: document_uploads document_uploads_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_uploads
    ADD CONSTRAINT document_uploads_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id);


--
-- Name: documents documents_classify_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_classify_agent_id_fkey FOREIGN KEY (classify_agent_id) REFERENCES public.agents(id);


--
-- Name: documents documents_document_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_document_agent_id_fkey FOREIGN KEY (document_agent_id) REFERENCES public.agents(id);


--
-- Name: drafts drafts_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: eval_agents eval_agents_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_agents
    ADD CONSTRAINT eval_agents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: eval_agents eval_agents_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_agents
    ADD CONSTRAINT eval_agents_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.evals(id) ON DELETE CASCADE;


--
-- Name: eval_attempts eval_attempts_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_attempts
    ADD CONSTRAINT eval_attempts_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.evals(id);


--
-- Name: eval_departments eval_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_departments
    ADD CONSTRAINT eval_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: eval_departments eval_departments_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_departments
    ADD CONSTRAINT eval_departments_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.evals(id);


--
-- Name: eval_groups eval_groups_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_groups
    ADD CONSTRAINT eval_groups_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.evals(id) ON DELETE CASCADE;


--
-- Name: eval_groups eval_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_groups
    ADD CONSTRAINT eval_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: eval_groups_rubric_grade_agents eval_groups_rubric_grade_agents_eval_id_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_groups_rubric_grade_agents
    ADD CONSTRAINT eval_groups_rubric_grade_agents_eval_id_group_id_fkey FOREIGN KEY (eval_id, group_id) REFERENCES public.eval_groups(eval_id, group_id) ON DELETE CASCADE;


--
-- Name: eval_groups_rubric_grade_agents eval_groups_rubric_grade_agents_rubric_grade_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_groups_rubric_grade_agents
    ADD CONSTRAINT eval_groups_rubric_grade_agents_rubric_grade_agent_id_fkey FOREIGN KEY (rubric_grade_agent_id) REFERENCES public.rubric_grade_agents(id) ON DELETE CASCADE;


--
-- Name: eval_runs eval_runs_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs
    ADD CONSTRAINT eval_runs_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.evals(id);


--
-- Name: eval_runs_rubric_grade_agents eval_runs_rubric_grade_agents_eval_id_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs_rubric_grade_agents
    ADD CONSTRAINT eval_runs_rubric_grade_agents_eval_id_run_id_fkey FOREIGN KEY (eval_id, run_id) REFERENCES public.eval_runs(eval_id, run_id) ON DELETE CASCADE;


--
-- Name: eval_runs_rubric_grade_agents eval_runs_rubric_grade_agents_rubric_grade_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs_rubric_grade_agents
    ADD CONSTRAINT eval_runs_rubric_grade_agents_rubric_grade_agent_id_fkey FOREIGN KEY (rubric_grade_agent_id) REFERENCES public.rubric_grade_agents(id) ON DELETE CASCADE;


--
-- Name: eval_runs eval_runs_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs
    ADD CONSTRAINT eval_runs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: feedback feedback_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: feedbacks feedbacks_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id);


--
-- Name: feedbacks feedbacks_standard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_standard_id_fkey FOREIGN KEY (standard_id) REFERENCES public.standards(id);


--
-- Name: field_conditional_parameters field_conditional_parameters_conditional_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_conditional_parameters
    ADD CONSTRAINT field_conditional_parameters_conditional_parameter_id_fkey FOREIGN KEY (conditional_parameter_id) REFERENCES public.parameters(id);


--
-- Name: field_conditional_parameters field_conditional_parameters_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_conditional_parameters
    ADD CONSTRAINT field_conditional_parameters_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id);


--
-- Name: field_departments field_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_departments
    ADD CONSTRAINT field_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: field_departments field_departments_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_departments
    ADD CONSTRAINT field_departments_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id);


--
-- Name: grade_groups grade_groups_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_groups
    ADD CONSTRAINT grade_groups_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id);


--
-- Name: grade_groups grade_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_groups
    ADD CONSTRAINT grade_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: grades grades_rubric_grade_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_rubric_grade_agent_id_fkey FOREIGN KEY (rubric_grade_agent_id) REFERENCES public.rubric_grade_agents(id) ON DELETE SET NULL;


--
-- Name: grades grades_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: group_order group_order_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_order
    ADD CONSTRAINT group_order_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: group_order group_order_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_order
    ADD CONSTRAINT group_order_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_runs group_runs_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_runs
    ADD CONSTRAINT group_runs_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: group_runs group_runs_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_runs
    ADD CONSTRAINT group_runs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: group_stop group_stop_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_stop
    ADD CONSTRAINT group_stop_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_stop group_stop_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_stop
    ADD CONSTRAINT group_stop_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE;


--
-- Name: image_departments image_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_departments
    ADD CONSTRAINT image_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: image_departments image_departments_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_departments
    ADD CONSTRAINT image_departments_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: image_uploads image_uploads_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_uploads
    ADD CONSTRAINT image_uploads_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: image_uploads image_uploads_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_uploads
    ADD CONSTRAINT image_uploads_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id);


--
-- Name: images images_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.tool_calls(id);


--
-- Name: message_audio message_audio_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_audio
    ADD CONSTRAINT message_audio_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id);


--
-- Name: message_audio message_audio_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_audio
    ADD CONSTRAINT message_audio_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id);


--
-- Name: message_content message_content_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_content
    ADD CONSTRAINT message_content_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id);


--
-- Name: message_content message_content_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_content
    ADD CONSTRAINT message_content_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.tool_calls(id);


--
-- Name: message_feedback_highlight message_feedback_highlight_message_feedback_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback_highlight
    ADD CONSTRAINT message_feedback_highlight_message_feedback_id_fkey FOREIGN KEY (message_feedback_id) REFERENCES public.message_feedbacks(id);


--
-- Name: message_feedback_replace message_feedback_replace_message_feedback_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback_replace
    ADD CONSTRAINT message_feedback_replace_message_feedback_id_fkey FOREIGN KEY (message_feedback_id) REFERENCES public.message_feedbacks(id);


--
-- Name: message_feedbacks message_feedbacks_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedbacks
    ADD CONSTRAINT message_feedbacks_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id);


--
-- Name: message_feedbacks message_feedbacks_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedbacks
    ADD CONSTRAINT message_feedbacks_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id);


--
-- Name: message_feedbacks message_feedbacks_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedbacks
    ADD CONSTRAINT message_feedbacks_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.tool_calls(id);


--
-- Name: message_personas message_personas_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_personas
    ADD CONSTRAINT message_personas_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id);


--
-- Name: message_personas message_personas_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_personas
    ADD CONSTRAINT message_personas_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(id);


--
-- Name: message_runs message_runs_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_runs
    ADD CONSTRAINT message_runs_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id);


--
-- Name: message_runs message_runs_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_runs
    ADD CONSTRAINT message_runs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: message_tree message_tree_child_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_tree
    ADD CONSTRAINT message_tree_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.messages(id);


--
-- Name: message_tree message_tree_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_tree
    ADD CONSTRAINT message_tree_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.messages(id);


--
-- Name: model_departments model_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_departments
    ADD CONSTRAINT model_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: model_departments model_departments_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_departments
    ADD CONSTRAINT model_departments_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: model_endpoints model_endpoints_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_endpoints
    ADD CONSTRAINT model_endpoints_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: model_modalities model_modalities_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_modalities
    ADD CONSTRAINT model_modalities_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: model_pricing model_pricing_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_pricing
    ADD CONSTRAINT model_pricing_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: model_pricing model_pricing_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_pricing
    ADD CONSTRAINT model_pricing_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: model_qualities model_qualities_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_qualities
    ADD CONSTRAINT model_qualities_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: model_reasoning_levels model_reasoning_levels_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_reasoning_levels
    ADD CONSTRAINT model_reasoning_levels_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: model_temperature_levels model_temperature_levels_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_temperature_levels
    ADD CONSTRAINT model_temperature_levels_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: model_voices model_voices_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_voices
    ADD CONSTRAINT model_voices_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: models models_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.models
    ADD CONSTRAINT models_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id);


--
-- Name: objective_departments objective_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_departments
    ADD CONSTRAINT objective_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: objective_departments objective_departments_objective_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_departments
    ADD CONSTRAINT objective_departments_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES public.objectives(id);


--
-- Name: objectives objectives_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives
    ADD CONSTRAINT objectives_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.tool_calls(id);


--
-- Name: parameter_departments parameter_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_departments
    ADD CONSTRAINT parameter_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: parameter_departments parameter_departments_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_departments
    ADD CONSTRAINT parameter_departments_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameters(id);


--
-- Name: parameter_fields parameter_fields_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_fields
    ADD CONSTRAINT parameter_fields_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id);


--
-- Name: parameter_fields parameter_fields_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_fields
    ADD CONSTRAINT parameter_fields_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameters(id);


--
-- Name: persona_departments persona_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_departments
    ADD CONSTRAINT persona_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: persona_departments persona_departments_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_departments
    ADD CONSTRAINT persona_departments_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(id);


--
-- Name: persona_examples persona_examples_example_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_examples
    ADD CONSTRAINT persona_examples_example_id_fkey FOREIGN KEY (example_id) REFERENCES public.examples(id);


--
-- Name: persona_examples persona_examples_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_examples
    ADD CONSTRAINT persona_examples_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(id) ON DELETE CASCADE;


--
-- Name: persona_fields persona_fields_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_fields
    ADD CONSTRAINT persona_fields_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id);


--
-- Name: persona_fields persona_fields_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_fields
    ADD CONSTRAINT persona_fields_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(id);


--
-- Name: problem_statement_departments problem_statement_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_statement_departments
    ADD CONSTRAINT problem_statement_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: problem_statement_departments problem_statement_departments_problem_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_statement_departments
    ADD CONSTRAINT problem_statement_departments_problem_statement_id_fkey FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statements(id);


--
-- Name: problem_statements problem_statements_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_statements
    ADD CONSTRAINT problem_statements_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.tool_calls(id);


--
-- Name: profile_activity profile_activity_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_activity
    ADD CONSTRAINT profile_activity_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: profile_departments profile_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_departments
    ADD CONSTRAINT profile_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: profile_departments profile_departments_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_departments
    ADD CONSTRAINT profile_departments_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: profile_emails profile_emails_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_emails
    ADD CONSTRAINT profile_emails_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: profile_request_limits profile_request_limits_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_request_limits
    ADD CONSTRAINT profile_request_limits_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: prompt_departments prompt_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_departments
    ADD CONSTRAINT prompt_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: prompt_departments prompt_departments_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_departments
    ADD CONSTRAINT prompt_departments_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id);


--
-- Name: provider_endpoints provider_endpoints_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_endpoints
    ADD CONSTRAINT provider_endpoints_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id);


--
-- Name: question_answers question_answers_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_answers
    ADD CONSTRAINT question_answers_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.options(id);


--
-- Name: question_answers question_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_answers
    ADD CONSTRAINT question_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: question_departments question_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_departments
    ADD CONSTRAINT question_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: question_departments question_departments_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_departments
    ADD CONSTRAINT question_departments_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: question_options question_options_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.options(id);


--
-- Name: question_options question_options_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: questions questions_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.tool_calls(id);


--
-- Name: quiz_responses quiz_responses_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_responses
    ADD CONSTRAINT quiz_responses_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.options(id);


--
-- Name: quiz_responses quiz_responses_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_responses
    ADD CONSTRAINT quiz_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: quiz_responses quiz_responses_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_responses
    ADD CONSTRAINT quiz_responses_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id);


--
-- Name: quizzes quizzes_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id);


--
-- Name: rubric_departments rubric_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_departments
    ADD CONSTRAINT rubric_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: rubric_departments rubric_departments_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_departments
    ADD CONSTRAINT rubric_departments_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubrics(id);


--
-- Name: rubric_grade_agents rubric_grade_agents_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents
    ADD CONSTRAINT rubric_grade_agents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: rubric_grade_agents_audio rubric_grade_agents_audio_audio_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents_audio
    ADD CONSTRAINT rubric_grade_agents_audio_audio_agent_id_fkey FOREIGN KEY (audio_agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: rubric_grade_agents rubric_grade_agents_grade_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents
    ADD CONSTRAINT rubric_grade_agents_grade_agent_id_fkey FOREIGN KEY (grade_agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: rubric_grade_agents rubric_grade_agents_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents
    ADD CONSTRAINT rubric_grade_agents_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubrics(id) ON DELETE CASCADE;


--
-- Name: rubric_grade_agents_audio rubric_grade_agents_voice_rubric_grade_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents_audio
    ADD CONSTRAINT rubric_grade_agents_voice_rubric_grade_agent_id_fkey FOREIGN KEY (rubric_grade_agent_id) REFERENCES public.rubric_grade_agents(id) ON DELETE CASCADE;


--
-- Name: rubric_groups rubric_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_groups
    ADD CONSTRAINT rubric_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: rubric_groups rubric_groups_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_groups
    ADD CONSTRAINT rubric_groups_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubrics(id);


--
-- Name: rubric_standard_groups rubric_standard_groups_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_standard_groups
    ADD CONSTRAINT rubric_standard_groups_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubrics(id) ON DELETE CASCADE;


--
-- Name: rubric_standard_groups rubric_standard_groups_standard_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_standard_groups
    ADD CONSTRAINT rubric_standard_groups_standard_group_id_fkey FOREIGN KEY (standard_group_id) REFERENCES public.standard_groups(id) ON DELETE CASCADE;


--
-- Name: rubrics rubrics_rubric_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubrics
    ADD CONSTRAINT rubrics_rubric_agent_id_fkey FOREIGN KEY (rubric_agent_id) REFERENCES public.agents(id);


--
-- Name: run_models run_models_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_models
    ADD CONSTRAINT run_models_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: run_models run_models_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_models
    ADD CONSTRAINT run_models_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: run_personas run_personas_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_personas
    ADD CONSTRAINT run_personas_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(id);


--
-- Name: run_personas run_personas_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_personas
    ADD CONSTRAINT run_personas_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: run_pricing_usage run_pricing_usage_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_pricing_usage
    ADD CONSTRAINT run_pricing_usage_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: run_pricing_usage run_pricing_usage_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_pricing_usage
    ADD CONSTRAINT run_pricing_usage_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: run_profiles run_profiles_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_profiles
    ADD CONSTRAINT run_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: run_profiles run_profiles_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_profiles
    ADD CONSTRAINT run_profiles_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: runs runs_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: runs runs_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.keys(id);


--
-- Name: scenario_departments scenario_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_departments
    ADD CONSTRAINT scenario_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: scenario_departments scenario_departments_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_departments
    ADD CONSTRAINT scenario_departments_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_document_ranges scenario_document_ranges_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_document_ranges
    ADD CONSTRAINT scenario_document_ranges_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_documents scenario_documents_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_documents
    ADD CONSTRAINT scenario_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: scenario_documents scenario_documents_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_documents
    ADD CONSTRAINT scenario_documents_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_field_ranges scenario_field_ranges_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_field_ranges
    ADD CONSTRAINT scenario_field_ranges_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameters(id);


--
-- Name: scenario_field_ranges scenario_field_ranges_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_field_ranges
    ADD CONSTRAINT scenario_field_ranges_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_fields scenario_fields_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_fields
    ADD CONSTRAINT scenario_fields_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id);


--
-- Name: scenario_fields scenario_fields_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_fields
    ADD CONSTRAINT scenario_fields_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_groups scenario_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_groups
    ADD CONSTRAINT scenario_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: scenario_groups scenario_groups_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_groups
    ADD CONSTRAINT scenario_groups_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_images scenario_images_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_images
    ADD CONSTRAINT scenario_images_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: scenario_images scenario_images_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_images
    ADD CONSTRAINT scenario_images_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_objectives scenario_objectives_objective_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_objectives
    ADD CONSTRAINT scenario_objectives_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES public.objectives(id);


--
-- Name: scenario_objectives scenario_objectives_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_objectives
    ADD CONSTRAINT scenario_objectives_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_parameter_ranges scenario_parameter_ranges_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_parameter_ranges
    ADD CONSTRAINT scenario_parameter_ranges_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_parameters scenario_parameters_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_parameters
    ADD CONSTRAINT scenario_parameters_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameters(id);


--
-- Name: scenario_parameters scenario_parameters_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_parameters
    ADD CONSTRAINT scenario_parameters_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_persona_ranges scenario_persona_ranges_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_persona_ranges
    ADD CONSTRAINT scenario_persona_ranges_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_personas scenario_personas_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_personas
    ADD CONSTRAINT scenario_personas_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(id);


--
-- Name: scenario_personas scenario_personas_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_personas
    ADD CONSTRAINT scenario_personas_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_problem_statements scenario_problem_statements_problem_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_problem_statements
    ADD CONSTRAINT scenario_problem_statements_problem_statement_id_fkey FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statements(id);


--
-- Name: scenario_problem_statements scenario_problem_statements_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_problem_statements
    ADD CONSTRAINT scenario_problem_statements_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_questions scenario_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_questions
    ADD CONSTRAINT scenario_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: scenario_questions scenario_questions_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_questions
    ADD CONSTRAINT scenario_questions_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_tree scenario_tree_child_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_tree
    ADD CONSTRAINT scenario_tree_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_tree scenario_tree_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_tree
    ADD CONSTRAINT scenario_tree_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_video_images scenario_video_images_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_video_images
    ADD CONSTRAINT scenario_video_images_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: scenario_video_images scenario_video_images_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_video_images
    ADD CONSTRAINT scenario_video_images_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_video_images scenario_video_images_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_video_images
    ADD CONSTRAINT scenario_video_images_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id);


--
-- Name: scenario_videos scenario_videos_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_videos
    ADD CONSTRAINT scenario_videos_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: scenario_videos scenario_videos_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_videos
    ADD CONSTRAINT scenario_videos_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id);


--
-- Name: scenarios scenarios_image_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenarios
    ADD CONSTRAINT scenarios_image_agent_id_fkey FOREIGN KEY (image_agent_id) REFERENCES public.agents(id);


--
-- Name: scenarios scenarios_scenario_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenarios
    ADD CONSTRAINT scenarios_scenario_agent_id_fkey FOREIGN KEY (scenario_agent_id) REFERENCES public.agents(id);


--
-- Name: scenarios scenarios_video_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenarios
    ADD CONSTRAINT scenarios_video_agent_id_fkey FOREIGN KEY (video_agent_id) REFERENCES public.agents(id);


--
-- Name: setting_auth_keys setting_auth_keys_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_keys
    ADD CONSTRAINT setting_auth_keys_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id);


--
-- Name: setting_auth_keys setting_auth_keys_auth_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_keys
    ADD CONSTRAINT setting_auth_keys_auth_item_id_fkey FOREIGN KEY (auth_item_id) REFERENCES public.auth_items(id);


--
-- Name: setting_auth_keys setting_auth_keys_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_keys
    ADD CONSTRAINT setting_auth_keys_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.keys(id);


--
-- Name: setting_auth_keys setting_auth_keys_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_keys
    ADD CONSTRAINT setting_auth_keys_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.settings(id);


--
-- Name: setting_auth_values setting_auth_values_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_values
    ADD CONSTRAINT setting_auth_values_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id);


--
-- Name: setting_auth_values setting_auth_values_auth_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_values
    ADD CONSTRAINT setting_auth_values_auth_item_id_fkey FOREIGN KEY (auth_item_id) REFERENCES public.auth_items(id);


--
-- Name: setting_auth_values setting_auth_values_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_values
    ADD CONSTRAINT setting_auth_values_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.settings(id);


--
-- Name: setting_auths setting_auths_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auths
    ADD CONSTRAINT setting_auths_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id);


--
-- Name: setting_auths setting_auths_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auths
    ADD CONSTRAINT setting_auths_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.settings(id);


--
-- Name: setting_provider_keys setting_provider_keys_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_provider_keys
    ADD CONSTRAINT setting_provider_keys_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.keys(id);


--
-- Name: setting_provider_keys setting_provider_keys_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_provider_keys
    ADD CONSTRAINT setting_provider_keys_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id);


--
-- Name: setting_provider_keys setting_provider_keys_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_provider_keys
    ADD CONSTRAINT setting_provider_keys_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.settings(id);


--
-- Name: setting_providers setting_providers_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_providers
    ADD CONSTRAINT setting_providers_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id);


--
-- Name: setting_providers setting_providers_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_providers
    ADD CONSTRAINT setting_providers_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.settings(id);


--
-- Name: settings_default_account settings_default_account_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_account
    ADD CONSTRAINT settings_default_account_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: settings_default_account settings_default_account_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_account
    ADD CONSTRAINT settings_default_account_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.settings(id);


--
-- Name: settings_default_department settings_default_department_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_department
    ADD CONSTRAINT settings_default_department_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: settings_default_department settings_default_department_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_department
    ADD CONSTRAINT settings_default_department_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.settings(id);


--
-- Name: settings_default_guest settings_default_guest_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_guest
    ADD CONSTRAINT settings_default_guest_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: settings_default_guest settings_default_guest_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_guest
    ADD CONSTRAINT settings_default_guest_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.settings(id);


--
-- Name: simulation_attempts simulation_attempts_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_attempts
    ADD CONSTRAINT simulation_attempts_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulations(id);


--
-- Name: simulation_departments simulation_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_departments
    ADD CONSTRAINT simulation_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: simulation_departments simulation_departments_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_departments
    ADD CONSTRAINT simulation_departments_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulations(id);


--
-- Name: simulation_hints simulation_hints_simulation_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_hints
    ADD CONSTRAINT simulation_hints_simulation_message_id_fkey FOREIGN KEY (simulation_message_id) REFERENCES public.messages(id);


--
-- Name: simulation_scenarios_rubric_grade_agents simulation_scenarios_rubric_grad_simulation_id_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_scenarios_rubric_grade_agents
    ADD CONSTRAINT simulation_scenarios_rubric_grad_simulation_id_scenario_id_fkey FOREIGN KEY (simulation_id, scenario_id) REFERENCES public.simulation_scenarios(simulation_id, scenario_id) ON DELETE CASCADE;


--
-- Name: simulation_scenarios_rubric_grade_agents simulation_scenarios_rubric_grade_ag_rubric_grade_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_scenarios_rubric_grade_agents
    ADD CONSTRAINT simulation_scenarios_rubric_grade_ag_rubric_grade_agent_id_fkey FOREIGN KEY (rubric_grade_agent_id) REFERENCES public.rubric_grade_agents(id) ON DELETE CASCADE;


--
-- Name: simulation_scenarios simulation_scenarios_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_scenarios
    ADD CONSTRAINT simulation_scenarios_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id);


--
-- Name: simulation_scenarios simulation_scenarios_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_scenarios
    ADD CONSTRAINT simulation_scenarios_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulations(id);


--
-- Name: simulations simulations_hint_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulations
    ADD CONSTRAINT simulations_hint_agent_id_fkey FOREIGN KEY (hint_agent_id) REFERENCES public.agents(id);


--
-- Name: simulations simulations_simulation_text_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulations
    ADD CONSTRAINT simulations_simulation_text_agent_id_fkey FOREIGN KEY (simulation_text_agent_id) REFERENCES public.agents(id);


--
-- Name: simulations simulations_simulation_voice_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulations
    ADD CONSTRAINT simulations_simulation_voice_agent_id_fkey FOREIGN KEY (simulation_voice_agent_id) REFERENCES public.agents(id);


--
-- Name: standard_groups standard_groups_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_groups
    ADD CONSTRAINT standard_groups_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.tool_calls(id);


--
-- Name: standards standards_standard_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standards
    ADD CONSTRAINT standards_standard_group_id_fkey FOREIGN KEY (standard_group_id) REFERENCES public.standard_groups(id);


--
-- Name: templates templates_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.tool_calls(id);


--
-- Name: templates templates_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id);


--
-- Name: test_runs test_runs_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_runs
    ADD CONSTRAINT test_runs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: test_runs test_runs_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_runs
    ADD CONSTRAINT test_runs_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id);


--
-- Name: tests tests_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: tool_call_arguments tool_call_arguments_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_call_arguments
    ADD CONSTRAINT tool_call_arguments_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.tool_calls(id);


--
-- Name: tool_call_results tool_call_results_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_call_results
    ADD CONSTRAINT tool_call_results_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.tool_calls(id);


--
-- Name: tool_call_runs tool_call_runs_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_call_runs
    ADD CONSTRAINT tool_call_runs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: tool_call_runs tool_call_runs_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_call_runs
    ADD CONSTRAINT tool_call_runs_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.tool_calls(id);


--
-- Name: tool_calls tool_calls_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_calls
    ADD CONSTRAINT tool_calls_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id);


--
-- Name: video_departments video_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_departments
    ADD CONSTRAINT video_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: video_departments video_departments_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_departments
    ADD CONSTRAINT video_departments_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id);


--
-- Name: video_uploads video_uploads_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_uploads
    ADD CONSTRAINT video_uploads_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id);


--
-- Name: video_uploads video_uploads_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_uploads
    ADD CONSTRAINT video_uploads_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id);


--
-- Name: videos videos_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.tool_calls(id);


--
-- PostgreSQL database dump complete
--

\unrestrict hL2lcalDptoT8Gu9AFWQPx2foVy0FIRueoyGzziXPE3lnvxWAgUFj2PTxwG7gkB

