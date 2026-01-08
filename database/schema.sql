--
-- PostgreSQL database dump
--

\restrict 5lRSv44tAqbi3yC5hHSaDD3kRv0Kp5pKVItNRGQx1Hc9smrKo84aSsl0jzWM8eR

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
-- Name: artifacts; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.artifacts AS ENUM (
    'agent',
    'chat',
    'document',
    'grade',
    'message',
    'rubric',
    'run',
    'scenario',
    'cohort',
    'simulation',
    'persona',
    'parameter',
    'field',
    'model',
    'eval',
    'department',
    'provider',
    'auth',
    'key',
    'setting',
    'profile'
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
-- Name: resources; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resources AS ENUM (
    'agents',
    'auth',
    'cohorts',
    'colors',
    'content',
    'debug_info',
    'departments',
    'descriptions',
    'evals',
    'feedback',
    'fields',
    'flags',
    'html',
    'icons',
    'keys',
    'models',
    'names',
    'parameters',
    'personas',
    'points',
    'profiles',
    'providers',
    'rubrics',
    'scenarios',
    'settings',
    'simulations',
    'thresholds',
    'times',
    'conversations',
    'documents',
    'hints',
    'images',
    'improvements',
    'objectives',
    'options',
    'problem_statements',
    'prompts',
    'questions',
    'responses',
    'schemas',
    'schema_fields',
    'schema_field_items',
    'standard_groups',
    'strengths',
    'templates',
    'template_array_items',
    'template_values',
    'videos',
    'analyses',
    'instructions'
);


--
-- Name: schema_field_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.schema_field_type AS ENUM (
    'string',
    'number',
    'boolean',
    'array'
);


--
-- Name: type_agent_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_agent_flags AS ENUM (
    'active'
);


--
-- Name: type_auth_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_auth_flags AS ENUM (
    'active'
);


--
-- Name: type_cohort_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_cohort_flags AS ENUM (
    'active'
);


--
-- Name: type_department_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_department_flags AS ENUM (
    'active'
);


--
-- Name: type_document_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_document_flags AS ENUM (
    'active',
    'template'
);


--
-- Name: type_eval_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_eval_flags AS ENUM (
    'active',
    'dynamic',
    'groups'
);


--
-- Name: type_field_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_field_flags AS ENUM (
    'active'
);


--
-- Name: type_key_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_key_flags AS ENUM (
    'active'
);


--
-- Name: type_model_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_model_flags AS ENUM (
    'active'
);


--
-- Name: type_parameter_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_parameter_flags AS ENUM (
    'active',
    'document_parameter',
    'persona_parameter',
    'scenario_parameter',
    'video_parameter',
    'simulation_parameter'
);


--
-- Name: type_persona_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_persona_flags AS ENUM (
    'active'
);


--
-- Name: type_profile_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_profile_flags AS ENUM (
    'active'
);


--
-- Name: type_profile_names; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_profile_names AS ENUM (
    'first',
    'last',
    'full'
);


--
-- Name: type_provider_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_provider_flags AS ENUM (
    'active'
);


--
-- Name: type_rubric_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_rubric_flags AS ENUM (
    'active'
);


--
-- Name: type_rubric_points; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_rubric_points AS ENUM (
    'total',
    'pass'
);


--
-- Name: type_scenario_domains; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_scenario_domains AS ENUM (
    'default',
    'video',
    'image'
);


--
-- Name: type_scenario_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_scenario_flags AS ENUM (
    'active',
    'objectives_enabled',
    'images_enabled',
    'video_enabled',
    'questions_enabled',
    'problem_statement_enabled'
);


--
-- Name: type_setting_colors; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_setting_colors AS ENUM (
    'primary',
    'accent',
    'background',
    'surface',
    'success',
    'warning',
    'error',
    'sidebar_background',
    'sidebar_primary',
    'chart1',
    'chart2',
    'chart3',
    'chart4',
    'chart5'
);


--
-- Name: type_setting_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_setting_flags AS ENUM (
    'active',
    'guest_login_enabled'
);


--
-- Name: type_setting_thresholds; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_setting_thresholds AS ENUM (
    'success',
    'warning',
    'danger'
);


--
-- Name: type_simulation_domains; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_simulation_domains AS ENUM (
    'text',
    'voice'
);


--
-- Name: type_simulation_flags; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_simulation_flags AS ENUM (
    'active',
    'practice'
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
-- Name: agent_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_descriptions (
    agent_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_domains (
    agent_id uuid NOT NULL,
    domain_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_flags (
    agent_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_agent_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_instructions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_instructions (
    agent_id uuid CONSTRAINT agent_developer_instructions_agent_id_not_null NOT NULL,
    instruction_id uuid CONSTRAINT agent_developer_instructions_developer_instruction_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT agent_developer_instructions_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT agent_developer_instructions_updated_at_not_null NOT NULL
);


--
-- Name: agent_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_models (
    agent_id uuid NOT NULL,
    model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_names (
    agent_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    id uuid DEFAULT uuidv7() CONSTRAINT agents_id_v7_not_null NOT NULL
);


--
-- Name: analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analyses (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    content text NOT NULL
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
    auth_type text NOT NULL,
    slug text NOT NULL,
    icon_url text DEFAULT ''::text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT auth_id_v7_not_null NOT NULL
);


--
-- Name: auth_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_descriptions (
    auth_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_flags (
    auth_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_auth_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: auth_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_names (
    auth_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calls (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT tool_calls_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT tool_calls_updated_at_not_null NOT NULL,
    call_id text CONSTRAINT tool_calls_call_id_not_null NOT NULL,
    completed boolean DEFAULT false CONSTRAINT tool_calls_completed_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT calls_id_v7_not_null NOT NULL,
    tool_id uuid CONSTRAINT tool_calls_tool_id_not_null NOT NULL,
    template_id uuid
);


--
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_conversations (
    chat_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: chat_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_responses (
    chat_id uuid NOT NULL,
    response_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: cohort_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort_descriptions (
    cohort_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cohort_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort_flags (
    cohort_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_cohort_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cohort_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort_names (
    cohort_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    id uuid DEFAULT uuidv7() CONSTRAINT cohorts_id_v7_not_null NOT NULL
);


--
-- Name: colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colors (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    hex_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content (
    id uuid DEFAULT uuidv7() NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tool_call_id uuid
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    end_reason text NOT NULL
);


--
-- Name: debug_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.debug_info (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    content text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT debug_info_id_v7_not_null NOT NULL
);


--
-- Name: department_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_descriptions (
    department_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: department_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_flags (
    department_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_department_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: department_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_names (
    department_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    id uuid DEFAULT uuidv7() CONSTRAINT departments_id_v7_not_null NOT NULL
);


--
-- Name: descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.descriptions (
    id uuid DEFAULT uuidv7() NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_agent_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_agent_domains (
    document_id uuid NOT NULL,
    agent_domain_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_content (
    document_id uuid NOT NULL,
    content_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: document_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_descriptions (
    document_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: document_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_flags (
    document_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_document_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


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
-- Name: document_html; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_html (
    document_id uuid NOT NULL,
    html_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_names (
    document_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_schemas (
    document_id uuid NOT NULL,
    schema_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    id uuid DEFAULT uuidv7() CONSTRAINT documents_id_v7_not_null NOT NULL
);


--
-- Name: domain_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_artifacts (
    domain_id uuid NOT NULL,
    artifact public.artifacts NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domains (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: eval_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_descriptions (
    eval_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: eval_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_flags (
    eval_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_eval_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: eval_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_names (
    eval_id uuid NOT NULL,
    name_id uuid NOT NULL,
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
    id uuid DEFAULT uuidv7() CONSTRAINT evals_id_v7_not_null NOT NULL
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
-- Name: field_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_descriptions (
    field_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: field_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_flags (
    field_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_field_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: field_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_names (
    field_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fields (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT fields_id_v7_not_null NOT NULL
);


--
-- Name: flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flags (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    icon_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grade_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_analyses (
    grade_id uuid NOT NULL,
    analysis_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grade_feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_feedbacks (
    grade_id uuid NOT NULL,
    feedback_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: grade_improvements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_improvements (
    grade_id uuid NOT NULL,
    improvement_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grade_strengths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_strengths (
    grade_id uuid NOT NULL,
    strength_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grade_times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_times (
    grade_id uuid NOT NULL,
    time_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grades (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text DEFAULT 'No description provided'::text NOT NULL,
    passed boolean NOT NULL,
    score integer NOT NULL,
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
-- Name: hints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hints (
    id uuid DEFAULT uuidv7() NOT NULL,
    hint text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: html; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.html (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text,
    active boolean DEFAULT true NOT NULL,
    completed boolean DEFAULT false NOT NULL
);


--
-- Name: html_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.html_uploads (
    html_id uuid NOT NULL,
    upload_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: icons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icons (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    tool_call_id uuid NOT NULL,
    description text NOT NULL
);


--
-- Name: improvements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.improvements (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text DEFAULT 'No description provided'::text NOT NULL,
    tool_call_id uuid NOT NULL,
    message_id uuid NOT NULL
);


--
-- Name: instruction_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instruction_schemas (
    instruction_id uuid CONSTRAINT developer_instruction_schemas_developer_instruction_id_not_null NOT NULL,
    schema_id uuid CONSTRAINT developer_instruction_schemas_schema_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT developer_instruction_schemas_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT developer_instruction_schemas_updated_at_not_null NOT NULL
);


--
-- Name: instructions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instructions (
    id uuid DEFAULT uuidv7() CONSTRAINT developer_instructions_id_not_null NOT NULL,
    template text CONSTRAINT developer_instructions_template_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT developer_instructions_active_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT developer_instructions_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT developer_instructions_updated_at_not_null NOT NULL
);


--
-- Name: key_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.key_descriptions (
    key_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: key_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.key_flags (
    key_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_key_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: key_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.key_names (
    key_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.keys (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    key text NOT NULL,
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
    message_id uuid NOT NULL,
    content_id uuid NOT NULL,
    idx integer CONSTRAINT message_content_idx_not_null1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT message_content_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT message_content_updated_at_not_null1 NOT NULL,
    CONSTRAINT message_content_idx_check1 CHECK ((idx >= 0))
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
-- Name: message_hints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_hints (
    message_id uuid NOT NULL,
    hint_id uuid NOT NULL,
    idx integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_hints_idx_check CHECK ((idx >= 0))
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
-- Name: model_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_descriptions (
    model_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: model_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_flags (
    model_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_model_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: model_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_names (
    model_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: model_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_providers (
    model_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    value text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT models_id_v7_not_null NOT NULL
);


--
-- Name: names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.names (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT options_id_v7_not_null NOT NULL,
    is_correct boolean DEFAULT false NOT NULL
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
-- Name: parameter_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameter_descriptions (
    parameter_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: parameter_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameter_fields (
    parameter_id uuid NOT NULL,
    field_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: parameter_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameter_flags (
    parameter_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_parameter_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: parameter_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameter_names (
    parameter_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameters (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT parameters_id_v7_not_null NOT NULL
);


--
-- Name: persona_colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_colors (
    persona_id uuid NOT NULL,
    color_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: persona_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_descriptions (
    persona_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: persona_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_flags (
    persona_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_persona_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: persona_icons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_icons (
    persona_id uuid NOT NULL,
    icon_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: persona_instructions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_instructions (
    persona_id uuid NOT NULL,
    instruction_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: persona_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_names (
    persona_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personas (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT personas_id_v7_not_null NOT NULL
);


--
-- Name: points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.points (
    id uuid DEFAULT uuidv7() NOT NULL,
    value integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: profile_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_flags (
    profile_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_profile_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profile_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_names (
    profile_id uuid NOT NULL,
    name_id uuid NOT NULL,
    type public.type_profile_names NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    role public.profile_role DEFAULT 'guest'::public.profile_role NOT NULL,
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
-- Name: provider_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_descriptions (
    provider_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: provider_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_flags (
    provider_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_provider_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: provider_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_names (
    provider_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    value text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT providers_id_v7_not_null NOT NULL
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
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    question_text text NOT NULL,
    allow_multiple boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT questions_id_v7_not_null NOT NULL,
    "time" integer NOT NULL
);


--
-- Name: resource_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resource_schemas (
    schema_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    resource public.resources
);


--
-- Name: resource_tools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resource_tools (
    tool_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    resource public.resources
);


--
-- Name: responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.responses (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT quiz_responses_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT quiz_responses_updated_at_not_null NOT NULL,
    completed boolean DEFAULT false CONSTRAINT quiz_responses_completed_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT quiz_responses_id_v7_not_null NOT NULL,
    option_id uuid,
    question_id uuid
);


--
-- Name: rubric_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_artifacts (
    rubric_id uuid NOT NULL,
    artifact public.artifacts NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: rubric_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_descriptions (
    rubric_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rubric_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_domains (
    rubric_id uuid NOT NULL,
    domain_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rubric_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_flags (
    rubric_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_rubric_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: rubric_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_names (
    rubric_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rubric_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_points (
    rubric_id uuid NOT NULL,
    point_id uuid NOT NULL,
    type public.type_rubric_points NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    id uuid DEFAULT uuidv7() CONSTRAINT rubrics_id_v7_not_null NOT NULL,
    rubric_domain_id uuid
);


--
-- Name: run_debug_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.run_debug_info (
    run_id uuid NOT NULL,
    debug_info_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: scenario_agent_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_agent_domains (
    scenario_id uuid CONSTRAINT scenario_domains_scenario_id_not_null NOT NULL,
    agent_domain_id uuid CONSTRAINT scenario_domains_domain_id_not_null NOT NULL,
    type public.type_scenario_domains CONSTRAINT scenario_domains_type_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT scenario_domains_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT scenario_domains_updated_at_not_null NOT NULL
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
-- Name: scenario_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_descriptions (
    scenario_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: scenario_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_flags (
    scenario_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_scenario_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: scenario_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_names (
    scenario_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: scenario_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_options (
    scenario_id uuid NOT NULL,
    option_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: scenario_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_templates (
    scenario_id uuid NOT NULL,
    template_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    id uuid DEFAULT uuidv7() CONSTRAINT scenarios_id_v7_not_null NOT NULL
);


--
-- Name: schema_field_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_field_items (
    schema_field_id uuid NOT NULL,
    item_schema_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_fields (
    id uuid DEFAULT uuidv7() NOT NULL,
    schema_id uuid NOT NULL,
    name text NOT NULL,
    field_type public.schema_field_type NOT NULL,
    required boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    template text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    default_value text DEFAULT ''::text NOT NULL
);


--
-- Name: schema_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_templates (
    schema_id uuid NOT NULL,
    template_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schemas (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: setting_colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_colors (
    setting_id uuid NOT NULL,
    color_id uuid NOT NULL,
    type public.type_setting_colors NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: setting_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_descriptions (
    setting_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: setting_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_flags (
    setting_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_setting_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: setting_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_names (
    setting_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: setting_thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_thresholds (
    setting_id uuid NOT NULL,
    threshold_id uuid NOT NULL,
    type public.type_setting_thresholds NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT settings_id_v7_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: simulation_agent_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation_agent_domains (
    simulation_id uuid CONSTRAINT simulation_domains_simulation_id_not_null NOT NULL,
    agent_domain_id uuid CONSTRAINT simulation_domains_domain_id_not_null NOT NULL,
    type public.type_simulation_domains CONSTRAINT simulation_domains_type_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT simulation_domains_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT simulation_domains_updated_at_not_null NOT NULL
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
-- Name: simulation_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation_descriptions (
    simulation_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: simulation_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation_flags (
    simulation_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    type public.type_simulation_flags NOT NULL,
    value boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: simulation_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation_names (
    simulation_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    id uuid DEFAULT uuidv7() CONSTRAINT simulations_id_v7_not_null NOT NULL
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
-- Name: strengths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.strengths (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text DEFAULT 'No description provided'::text NOT NULL,
    tool_call_id uuid NOT NULL,
    message_id uuid NOT NULL
);


--
-- Name: template_array_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_array_items (
    template_id uuid NOT NULL,
    schema_field_id uuid NOT NULL,
    item_template_id uuid NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: template_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_values (
    id uuid DEFAULT uuidv7() NOT NULL,
    template_id uuid NOT NULL,
    schema_field_id uuid NOT NULL,
    string_value text,
    number_value numeric,
    boolean_value boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT template_values_check CHECK ((((((string_value IS NOT NULL))::integer + ((number_value IS NOT NULL))::integer) + ((boolean_value IS NOT NULL))::integer) = 1))
);


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT templates_id_v7_not_null NOT NULL,
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
-- Name: thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thresholds (
    id uuid DEFAULT uuidv7() NOT NULL,
    value integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.times (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    time_taken integer NOT NULL,
    active boolean DEFAULT true NOT NULL
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
-- Name: tool_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_schemas (
    tool_id uuid NOT NULL,
    schema_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    active boolean DEFAULT true NOT NULL,
    template_id uuid NOT NULL
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
    completed boolean DEFAULT false NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT videos_id_v7_not_null NOT NULL,
    tool_call_id uuid NOT NULL,
    description text NOT NULL,
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
-- Name: agent_descriptions agent_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_descriptions
    ADD CONSTRAINT agent_descriptions_pkey PRIMARY KEY (agent_id, description_id);


--
-- Name: agent_instructions agent_developer_instructions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_instructions
    ADD CONSTRAINT agent_developer_instructions_pkey PRIMARY KEY (agent_id, instruction_id);


--
-- Name: agent_domains agent_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_domains
    ADD CONSTRAINT agent_domains_pkey PRIMARY KEY (agent_id, domain_id);


--
-- Name: agent_flags agent_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_flags
    ADD CONSTRAINT agent_flags_pkey PRIMARY KEY (agent_id, flag_id, type);


--
-- Name: agent_models agent_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_models
    ADD CONSTRAINT agent_models_pkey PRIMARY KEY (agent_id, model_id);


--
-- Name: agent_names agent_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_names
    ADD CONSTRAINT agent_names_pkey PRIMARY KEY (agent_id, name_id);


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
-- Name: analyses analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analyses
    ADD CONSTRAINT analyses_pkey PRIMARY KEY (id);


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
-- Name: attempt_tests attempt_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_tests
    ADD CONSTRAINT attempt_tests_pkey PRIMARY KEY (attempt_id, test_id);


--
-- Name: auth_descriptions auth_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_descriptions
    ADD CONSTRAINT auth_descriptions_pkey PRIMARY KEY (auth_id, description_id);


--
-- Name: auth_flags auth_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_flags
    ADD CONSTRAINT auth_flags_pkey PRIMARY KEY (auth_id, flag_id, type);


--
-- Name: auth_items auth_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_items
    ADD CONSTRAINT auth_items_pkey PRIMARY KEY (id);


--
-- Name: auth_names auth_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_names
    ADD CONSTRAINT auth_names_pkey PRIMARY KEY (auth_id, name_id);


--
-- Name: auth auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth
    ADD CONSTRAINT auth_pkey PRIMARY KEY (id);


--
-- Name: calls calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);


--
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (chat_id, conversation_id);


--
-- Name: chat_groups chat_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_groups
    ADD CONSTRAINT chat_groups_pkey PRIMARY KEY (chat_id, group_id);


--
-- Name: chat_responses chat_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_responses
    ADD CONSTRAINT chat_responses_pkey PRIMARY KEY (chat_id, response_id);


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
-- Name: cohort_descriptions cohort_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_descriptions
    ADD CONSTRAINT cohort_descriptions_pkey PRIMARY KEY (cohort_id, description_id);


--
-- Name: cohort_flags cohort_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_flags
    ADD CONSTRAINT cohort_flags_pkey PRIMARY KEY (cohort_id, flag_id, type);


--
-- Name: cohort_names cohort_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_names
    ADD CONSTRAINT cohort_names_pkey PRIMARY KEY (cohort_id, name_id);


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
-- Name: colors colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_pkey PRIMARY KEY (id);


--
-- Name: content content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content
    ADD CONSTRAINT content_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: debug_info debug_info_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debug_info
    ADD CONSTRAINT debug_info_pkey PRIMARY KEY (id);


--
-- Name: department_descriptions department_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_descriptions
    ADD CONSTRAINT department_descriptions_pkey PRIMARY KEY (department_id, description_id);


--
-- Name: department_flags department_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_flags
    ADD CONSTRAINT department_flags_pkey PRIMARY KEY (department_id, flag_id, type);


--
-- Name: department_names department_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_names
    ADD CONSTRAINT department_names_pkey PRIMARY KEY (department_id, name_id);


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
-- Name: descriptions descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descriptions
    ADD CONSTRAINT descriptions_pkey PRIMARY KEY (id);


--
-- Name: instruction_schemas developer_instruction_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instruction_schemas
    ADD CONSTRAINT developer_instruction_schemas_pkey PRIMARY KEY (instruction_id, schema_id);


--
-- Name: instructions developer_instructions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instructions
    ADD CONSTRAINT developer_instructions_pkey PRIMARY KEY (id);


--
-- Name: document_agent_domains document_agent_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_agent_domains
    ADD CONSTRAINT document_agent_domains_pkey PRIMARY KEY (document_id, agent_domain_id);


--
-- Name: document_content document_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_content
    ADD CONSTRAINT document_content_pkey PRIMARY KEY (document_id, content_id);


--
-- Name: document_departments document_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_departments
    ADD CONSTRAINT document_departments_pkey PRIMARY KEY (document_id, department_id);


--
-- Name: document_descriptions document_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_descriptions
    ADD CONSTRAINT document_descriptions_pkey PRIMARY KEY (document_id, description_id);


--
-- Name: document_fields document_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_fields
    ADD CONSTRAINT document_fields_pkey PRIMARY KEY (document_id, field_id);


--
-- Name: document_flags document_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_flags
    ADD CONSTRAINT document_flags_pkey PRIMARY KEY (document_id, flag_id, type);


--
-- Name: document_groups document_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_groups
    ADD CONSTRAINT document_groups_pkey PRIMARY KEY (document_id, group_id);


--
-- Name: document_html document_html_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_html
    ADD CONSTRAINT document_html_pkey PRIMARY KEY (document_id, html_id);


--
-- Name: document_names document_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_names
    ADD CONSTRAINT document_names_pkey PRIMARY KEY (document_id, name_id);


--
-- Name: document_schemas document_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_schemas
    ADD CONSTRAINT document_schemas_pkey PRIMARY KEY (document_id, schema_id);


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
-- Name: domain_artifacts domain_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_artifacts
    ADD CONSTRAINT domain_artifacts_pkey PRIMARY KEY (domain_id, artifact);


--
-- Name: domains domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);


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
-- Name: eval_descriptions eval_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_descriptions
    ADD CONSTRAINT eval_descriptions_pkey PRIMARY KEY (eval_id, description_id);


--
-- Name: eval_flags eval_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_flags
    ADD CONSTRAINT eval_flags_pkey PRIMARY KEY (eval_id, flag_id, type);


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
-- Name: eval_names eval_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_names
    ADD CONSTRAINT eval_names_pkey PRIMARY KEY (eval_id, name_id);


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
-- Name: field_descriptions field_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_descriptions
    ADD CONSTRAINT field_descriptions_pkey PRIMARY KEY (field_id, description_id);


--
-- Name: field_flags field_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_flags
    ADD CONSTRAINT field_flags_pkey PRIMARY KEY (field_id, flag_id, type);


--
-- Name: field_names field_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_names
    ADD CONSTRAINT field_names_pkey PRIMARY KEY (field_id, name_id);


--
-- Name: fields fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fields
    ADD CONSTRAINT fields_pkey PRIMARY KEY (id);


--
-- Name: flags flags_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flags
    ADD CONSTRAINT flags_name_key UNIQUE (name);


--
-- Name: flags flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flags
    ADD CONSTRAINT flags_pkey PRIMARY KEY (id);


--
-- Name: grade_analyses grade_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_analyses
    ADD CONSTRAINT grade_analyses_pkey PRIMARY KEY (grade_id, analysis_id);


--
-- Name: grade_feedbacks grade_feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_feedbacks
    ADD CONSTRAINT grade_feedbacks_pkey PRIMARY KEY (grade_id, feedback_id);


--
-- Name: grade_groups grade_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_groups
    ADD CONSTRAINT grade_groups_pkey PRIMARY KEY (chat_id, group_id);


--
-- Name: grade_improvements grade_improvements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_improvements
    ADD CONSTRAINT grade_improvements_pkey PRIMARY KEY (grade_id, improvement_id);


--
-- Name: grade_strengths grade_strengths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_strengths
    ADD CONSTRAINT grade_strengths_pkey PRIMARY KEY (grade_id, strength_id);


--
-- Name: grade_times grade_times_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_times
    ADD CONSTRAINT grade_times_pkey PRIMARY KEY (grade_id, time_id);


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
-- Name: hints hints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hints
    ADD CONSTRAINT hints_pkey PRIMARY KEY (id);


--
-- Name: html html_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.html
    ADD CONSTRAINT html_pkey PRIMARY KEY (id);


--
-- Name: html_uploads html_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.html_uploads
    ADD CONSTRAINT html_uploads_pkey PRIMARY KEY (html_id, upload_id);


--
-- Name: icons icons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icons
    ADD CONSTRAINT icons_pkey PRIMARY KEY (id);


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
-- Name: improvements improvements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.improvements
    ADD CONSTRAINT improvements_pkey PRIMARY KEY (id);


--
-- Name: key_descriptions key_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_descriptions
    ADD CONSTRAINT key_descriptions_pkey PRIMARY KEY (key_id, description_id);


--
-- Name: key_flags key_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_flags
    ADD CONSTRAINT key_flags_pkey PRIMARY KEY (key_id, flag_id, type);


--
-- Name: key_names key_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_names
    ADD CONSTRAINT key_names_pkey PRIMARY KEY (key_id, name_id);


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
-- Name: message_content message_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_content
    ADD CONSTRAINT message_content_pkey PRIMARY KEY (message_id, content_id);


--
-- Name: message_hints message_hints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_hints
    ADD CONSTRAINT message_hints_pkey PRIMARY KEY (message_id, hint_id);


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
-- Name: model_descriptions model_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_descriptions
    ADD CONSTRAINT model_descriptions_pkey PRIMARY KEY (model_id, description_id);


--
-- Name: model_flags model_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_flags
    ADD CONSTRAINT model_flags_pkey PRIMARY KEY (model_id, flag_id, type);


--
-- Name: model_modalities model_modalities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_modalities
    ADD CONSTRAINT model_modalities_pkey PRIMARY KEY (model_id, modality, is_input);


--
-- Name: model_names model_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_names
    ADD CONSTRAINT model_names_pkey PRIMARY KEY (model_id, name_id);


--
-- Name: model_pricing model_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_pricing
    ADD CONSTRAINT model_pricing_pkey PRIMARY KEY (model_id, pricing_type, unit_id);


--
-- Name: model_providers model_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_providers
    ADD CONSTRAINT model_providers_pkey PRIMARY KEY (model_id, provider_id);


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
-- Name: names names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.names
    ADD CONSTRAINT names_pkey PRIMARY KEY (id);


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
-- Name: parameter_descriptions parameter_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_descriptions
    ADD CONSTRAINT parameter_descriptions_pkey PRIMARY KEY (parameter_id, description_id);


--
-- Name: parameter_fields parameter_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_fields
    ADD CONSTRAINT parameter_fields_pkey PRIMARY KEY (parameter_id, field_id);


--
-- Name: parameter_flags parameter_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_flags
    ADD CONSTRAINT parameter_flags_pkey PRIMARY KEY (parameter_id, flag_id, type);


--
-- Name: parameter_names parameter_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_names
    ADD CONSTRAINT parameter_names_pkey PRIMARY KEY (parameter_id, name_id);


--
-- Name: parameters parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameters
    ADD CONSTRAINT parameters_pkey PRIMARY KEY (id);


--
-- Name: persona_colors persona_colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_colors
    ADD CONSTRAINT persona_colors_pkey PRIMARY KEY (persona_id, color_id);


--
-- Name: persona_departments persona_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_departments
    ADD CONSTRAINT persona_departments_pkey PRIMARY KEY (persona_id, department_id);


--
-- Name: persona_descriptions persona_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_descriptions
    ADD CONSTRAINT persona_descriptions_pkey PRIMARY KEY (persona_id, description_id);


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
-- Name: persona_flags persona_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_flags
    ADD CONSTRAINT persona_flags_pkey PRIMARY KEY (persona_id, flag_id, type);


--
-- Name: persona_icons persona_icons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_icons
    ADD CONSTRAINT persona_icons_pkey PRIMARY KEY (persona_id, icon_id);


--
-- Name: persona_instructions persona_instructions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_instructions
    ADD CONSTRAINT persona_instructions_pkey PRIMARY KEY (persona_id, instruction_id);


--
-- Name: persona_names persona_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_names
    ADD CONSTRAINT persona_names_pkey PRIMARY KEY (persona_id, name_id);


--
-- Name: personas personas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personas
    ADD CONSTRAINT personas_pkey PRIMARY KEY (id);


--
-- Name: points points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points
    ADD CONSTRAINT points_pkey PRIMARY KEY (id);


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
-- Name: profile_flags profile_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_flags
    ADD CONSTRAINT profile_flags_pkey PRIMARY KEY (profile_id, flag_id, type);


--
-- Name: profile_names profile_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_names
    ADD CONSTRAINT profile_names_pkey PRIMARY KEY (profile_id, name_id, type);


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
-- Name: provider_descriptions provider_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_descriptions
    ADD CONSTRAINT provider_descriptions_pkey PRIMARY KEY (provider_id, description_id);


--
-- Name: provider_flags provider_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_flags
    ADD CONSTRAINT provider_flags_pkey PRIMARY KEY (provider_id, flag_id, type);


--
-- Name: provider_names provider_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_names
    ADD CONSTRAINT provider_names_pkey PRIMARY KEY (provider_id, name_id);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: question_departments question_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_departments
    ADD CONSTRAINT question_departments_pkey PRIMARY KEY (question_id, department_id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: responses quiz_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT quiz_responses_pkey PRIMARY KEY (id);


--
-- Name: rubric_artifacts rubric_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_artifacts
    ADD CONSTRAINT rubric_artifacts_pkey PRIMARY KEY (rubric_id, artifact);


--
-- Name: rubric_departments rubric_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_departments
    ADD CONSTRAINT rubric_departments_pkey PRIMARY KEY (rubric_id, department_id);


--
-- Name: rubric_descriptions rubric_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_descriptions
    ADD CONSTRAINT rubric_descriptions_pkey PRIMARY KEY (rubric_id, description_id);


--
-- Name: rubric_domains rubric_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_domains
    ADD CONSTRAINT rubric_domains_pkey PRIMARY KEY (rubric_id, domain_id);


--
-- Name: rubric_flags rubric_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_flags
    ADD CONSTRAINT rubric_flags_pkey PRIMARY KEY (rubric_id, flag_id, type);


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
-- Name: rubric_names rubric_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_names
    ADD CONSTRAINT rubric_names_pkey PRIMARY KEY (rubric_id, name_id);


--
-- Name: rubric_points rubric_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_points
    ADD CONSTRAINT rubric_points_pkey PRIMARY KEY (rubric_id, point_id, type);


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
-- Name: run_debug_info run_debug_info_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_debug_info
    ADD CONSTRAINT run_debug_info_pkey PRIMARY KEY (run_id, debug_info_id);


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
-- Name: scenario_descriptions scenario_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_descriptions
    ADD CONSTRAINT scenario_descriptions_pkey PRIMARY KEY (scenario_id, description_id);


--
-- Name: scenario_documents scenario_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_documents
    ADD CONSTRAINT scenario_documents_pkey PRIMARY KEY (scenario_id, document_id);


--
-- Name: scenario_agent_domains scenario_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_agent_domains
    ADD CONSTRAINT scenario_domains_pkey PRIMARY KEY (scenario_id, agent_domain_id, type);


--
-- Name: scenario_fields scenario_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_fields
    ADD CONSTRAINT scenario_fields_pkey PRIMARY KEY (scenario_id, field_id);


--
-- Name: scenario_flags scenario_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_flags
    ADD CONSTRAINT scenario_flags_pkey PRIMARY KEY (scenario_id, flag_id, type);


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
-- Name: scenario_names scenario_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_names
    ADD CONSTRAINT scenario_names_pkey PRIMARY KEY (scenario_id, name_id);


--
-- Name: scenario_objectives scenario_objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_objectives
    ADD CONSTRAINT scenario_objectives_pkey PRIMARY KEY (scenario_id, objective_id);


--
-- Name: scenario_options scenario_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_options
    ADD CONSTRAINT scenario_options_pkey PRIMARY KEY (scenario_id, option_id);


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
-- Name: scenario_questions scenario_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_questions
    ADD CONSTRAINT scenario_questions_pkey PRIMARY KEY (scenario_id, question_id);


--
-- Name: scenario_templates scenario_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_templates
    ADD CONSTRAINT scenario_templates_pkey PRIMARY KEY (scenario_id, template_id);


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
-- Name: schema_field_items schema_field_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_field_items
    ADD CONSTRAINT schema_field_items_pkey PRIMARY KEY (schema_field_id, item_schema_id);


--
-- Name: schema_fields schema_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_fields
    ADD CONSTRAINT schema_fields_pkey PRIMARY KEY (id);


--
-- Name: schema_fields schema_fields_schema_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_fields
    ADD CONSTRAINT schema_fields_schema_id_name_key UNIQUE (schema_id, name);


--
-- Name: schema_templates schema_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_templates
    ADD CONSTRAINT schema_templates_pkey PRIMARY KEY (schema_id, template_id);


--
-- Name: schemas schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schemas
    ADD CONSTRAINT schemas_pkey PRIMARY KEY (id);


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
-- Name: setting_colors setting_colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_colors
    ADD CONSTRAINT setting_colors_pkey PRIMARY KEY (setting_id, color_id, type);


--
-- Name: setting_descriptions setting_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_descriptions
    ADD CONSTRAINT setting_descriptions_pkey PRIMARY KEY (setting_id, description_id);


--
-- Name: setting_flags setting_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_flags
    ADD CONSTRAINT setting_flags_pkey PRIMARY KEY (setting_id, flag_id, type);


--
-- Name: setting_names setting_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_names
    ADD CONSTRAINT setting_names_pkey PRIMARY KEY (setting_id, name_id);


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
-- Name: setting_thresholds setting_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_thresholds
    ADD CONSTRAINT setting_thresholds_pkey PRIMARY KEY (setting_id, threshold_id, type);


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
-- Name: simulation_descriptions simulation_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_descriptions
    ADD CONSTRAINT simulation_descriptions_pkey PRIMARY KEY (simulation_id, description_id);


--
-- Name: simulation_agent_domains simulation_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_agent_domains
    ADD CONSTRAINT simulation_domains_pkey PRIMARY KEY (simulation_id, agent_domain_id, type);


--
-- Name: simulation_flags simulation_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_flags
    ADD CONSTRAINT simulation_flags_pkey PRIMARY KEY (simulation_id, flag_id, type);


--
-- Name: simulation_names simulation_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_names
    ADD CONSTRAINT simulation_names_pkey PRIMARY KEY (simulation_id, name_id);


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
-- Name: strengths strengths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strengths
    ADD CONSTRAINT strengths_pkey PRIMARY KEY (id);


--
-- Name: template_array_items template_array_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_array_items
    ADD CONSTRAINT template_array_items_pkey PRIMARY KEY (template_id, schema_field_id, item_template_id);


--
-- Name: template_values template_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_values
    ADD CONSTRAINT template_values_pkey PRIMARY KEY (id);


--
-- Name: template_values template_values_template_id_schema_field_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_values
    ADD CONSTRAINT template_values_template_id_schema_field_id_key UNIQUE (template_id, schema_field_id);


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
-- Name: thresholds thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thresholds
    ADD CONSTRAINT thresholds_pkey PRIMARY KEY (id);


--
-- Name: times times_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.times
    ADD CONSTRAINT times_pkey PRIMARY KEY (id);


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
-- Name: tool_schemas tool_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_schemas
    ADD CONSTRAINT tool_schemas_pkey PRIMARY KEY (tool_id, schema_id);


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
-- Name: agent_descriptions_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_descriptions_agent_id_idx ON public.agent_descriptions USING btree (agent_id);


--
-- Name: agent_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_descriptions_description_id_idx ON public.agent_descriptions USING btree (description_id);


--
-- Name: agent_domains_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_domains_agent_id_idx ON public.agent_domains USING btree (agent_id);


--
-- Name: agent_domains_domain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_domains_domain_id_idx ON public.agent_domains USING btree (domain_id);


--
-- Name: agent_flags_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_flags_agent_id_idx ON public.agent_flags USING btree (agent_id);


--
-- Name: agent_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_flags_flag_id_idx ON public.agent_flags USING btree (flag_id);


--
-- Name: agent_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_flags_type_idx ON public.agent_flags USING btree (type);


--
-- Name: agent_instructions_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_instructions_agent_id_idx ON public.agent_instructions USING btree (agent_id);


--
-- Name: agent_instructions_instruction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_instructions_instruction_id_idx ON public.agent_instructions USING btree (instruction_id);


--
-- Name: agent_models_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_models_agent_id_idx ON public.agent_models USING btree (agent_id);


--
-- Name: agent_models_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_models_model_id_idx ON public.agent_models USING btree (model_id);


--
-- Name: agent_names_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_names_agent_id_idx ON public.agent_names USING btree (agent_id);


--
-- Name: agent_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_names_name_id_idx ON public.agent_names USING btree (name_id);


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
-- Name: analyses_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analyses_created_at_idx ON public.analyses USING btree (created_at);


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
-- Name: attempt_tests_attempt_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_tests_attempt_id_v7_idx ON public.attempt_tests USING btree (attempt_id);


--
-- Name: attempt_tests_test_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_tests_test_id_v7_idx ON public.attempt_tests USING btree (test_id);


--
-- Name: auth_descriptions_auth_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_descriptions_auth_id_idx ON public.auth_descriptions USING btree (auth_id);


--
-- Name: auth_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_descriptions_description_id_idx ON public.auth_descriptions USING btree (description_id);


--
-- Name: auth_flags_auth_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_flags_auth_id_idx ON public.auth_flags USING btree (auth_id);


--
-- Name: auth_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_flags_flag_id_idx ON public.auth_flags USING btree (flag_id);


--
-- Name: auth_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_flags_type_idx ON public.auth_flags USING btree (type);


--
-- Name: auth_items_auth_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_items_auth_id_v7_idx ON public.auth_items USING btree (auth_id);


--
-- Name: auth_items_encrypted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_items_encrypted_idx ON public.auth_items USING btree (encrypted);


--
-- Name: auth_names_auth_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_names_auth_id_idx ON public.auth_names USING btree (auth_id);


--
-- Name: auth_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_names_name_id_idx ON public.auth_names USING btree (name_id);


--
-- Name: auth_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_slug_idx ON public.auth USING btree (slug);


--
-- Name: auth_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_slug_unique ON public.auth USING btree (slug);


--
-- Name: calls_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calls_template_id_idx ON public.calls USING btree (template_id);


--
-- Name: chat_conversations_chat_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_chat_active_idx ON public.chat_conversations USING btree (chat_id, active);


--
-- Name: chat_conversations_chat_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_chat_id_idx ON public.chat_conversations USING btree (chat_id);


--
-- Name: chat_conversations_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_conversation_id_idx ON public.chat_conversations USING btree (conversation_id);


--
-- Name: chat_groups_chat_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_groups_chat_id_v7_idx ON public.chat_groups USING btree (chat_id);


--
-- Name: chat_groups_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_groups_group_id_v7_idx ON public.chat_groups USING btree (group_id);


--
-- Name: chat_responses_chat_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_responses_chat_active_idx ON public.chat_responses USING btree (chat_id, active);


--
-- Name: chat_responses_chat_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_responses_chat_id_idx ON public.chat_responses USING btree (chat_id);


--
-- Name: chat_responses_response_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_responses_response_id_idx ON public.chat_responses USING btree (response_id);


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
-- Name: cohort_descriptions_cohort_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_descriptions_cohort_id_idx ON public.cohort_descriptions USING btree (cohort_id);


--
-- Name: cohort_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_descriptions_description_id_idx ON public.cohort_descriptions USING btree (description_id);


--
-- Name: cohort_flags_cohort_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_flags_cohort_id_idx ON public.cohort_flags USING btree (cohort_id);


--
-- Name: cohort_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_flags_flag_id_idx ON public.cohort_flags USING btree (flag_id);


--
-- Name: cohort_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_flags_type_idx ON public.cohort_flags USING btree (type);


--
-- Name: cohort_names_cohort_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_names_cohort_id_idx ON public.cohort_names USING btree (cohort_id);


--
-- Name: cohort_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_names_name_id_idx ON public.cohort_names USING btree (name_id);


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
-- Name: colors_hex_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX colors_hex_code_idx ON public.colors USING btree (hex_code);


--
-- Name: content_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_created_at_idx ON public.content USING btree (created_at);


--
-- Name: content_tool_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_tool_call_id_idx ON public.content USING btree (tool_call_id);


--
-- Name: conversations_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_created_at_idx ON public.conversations USING btree (created_at);


--
-- Name: department_descriptions_department_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_descriptions_department_id_idx ON public.department_descriptions USING btree (department_id);


--
-- Name: department_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_descriptions_description_id_idx ON public.department_descriptions USING btree (description_id);


--
-- Name: department_flags_department_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_flags_department_id_idx ON public.department_flags USING btree (department_id);


--
-- Name: department_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_flags_flag_id_idx ON public.department_flags USING btree (flag_id);


--
-- Name: department_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_flags_type_idx ON public.department_flags USING btree (type);


--
-- Name: department_names_department_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_names_department_id_idx ON public.department_names USING btree (department_id);


--
-- Name: department_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_names_name_id_idx ON public.department_names USING btree (name_id);


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
-- Name: document_agent_domains_agent_domain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_agent_domains_agent_domain_id_idx ON public.document_agent_domains USING btree (agent_domain_id);


--
-- Name: document_agent_domains_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_agent_domains_document_id_idx ON public.document_agent_domains USING btree (document_id);


--
-- Name: document_content_content_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_content_content_id_idx ON public.document_content USING btree (content_id);


--
-- Name: document_content_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_content_document_id_idx ON public.document_content USING btree (document_id);


--
-- Name: document_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_departments_department_id_v7_idx ON public.document_departments USING btree (department_id);


--
-- Name: document_departments_document_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_departments_document_id_v7_idx ON public.document_departments USING btree (document_id);


--
-- Name: document_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_descriptions_description_id_idx ON public.document_descriptions USING btree (description_id);


--
-- Name: document_descriptions_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_descriptions_document_id_idx ON public.document_descriptions USING btree (document_id);


--
-- Name: document_fields_document_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_fields_document_id_v7_idx ON public.document_fields USING btree (document_id);


--
-- Name: document_fields_field_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_fields_field_id_v7_idx ON public.document_fields USING btree (field_id);


--
-- Name: document_flags_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_flags_document_id_idx ON public.document_flags USING btree (document_id);


--
-- Name: document_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_flags_flag_id_idx ON public.document_flags USING btree (flag_id);


--
-- Name: document_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_flags_type_idx ON public.document_flags USING btree (type);


--
-- Name: document_groups_document_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_groups_document_id_v7_idx ON public.document_groups USING btree (document_id);


--
-- Name: document_groups_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_groups_group_id_v7_idx ON public.document_groups USING btree (group_id);


--
-- Name: document_html_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_html_active_idx ON public.document_html USING btree (active);


--
-- Name: document_html_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_html_document_id_idx ON public.document_html USING btree (document_id);


--
-- Name: document_html_html_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_html_html_id_idx ON public.document_html USING btree (html_id);


--
-- Name: document_names_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_names_document_id_idx ON public.document_names USING btree (document_id);


--
-- Name: document_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_names_name_id_idx ON public.document_names USING btree (name_id);


--
-- Name: document_schemas_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_schemas_active_idx ON public.document_schemas USING btree (active);


--
-- Name: document_schemas_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_schemas_document_id_idx ON public.document_schemas USING btree (document_id);


--
-- Name: document_schemas_schema_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_schemas_schema_id_idx ON public.document_schemas USING btree (schema_id);


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
-- Name: domain_artifacts_artifact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_artifacts_artifact_idx ON public.domain_artifacts USING btree (artifact);


--
-- Name: domain_artifacts_domain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_artifacts_domain_id_idx ON public.domain_artifacts USING btree (domain_id);


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
-- Name: eval_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_descriptions_description_id_idx ON public.eval_descriptions USING btree (description_id);


--
-- Name: eval_descriptions_eval_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_descriptions_eval_id_idx ON public.eval_descriptions USING btree (eval_id);


--
-- Name: eval_flags_eval_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_flags_eval_id_idx ON public.eval_flags USING btree (eval_id);


--
-- Name: eval_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_flags_flag_id_idx ON public.eval_flags USING btree (flag_id);


--
-- Name: eval_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_flags_type_idx ON public.eval_flags USING btree (type);


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
-- Name: eval_names_eval_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_names_eval_id_idx ON public.eval_names USING btree (eval_id);


--
-- Name: eval_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_names_name_id_idx ON public.eval_names USING btree (name_id);


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
-- Name: field_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_descriptions_description_id_idx ON public.field_descriptions USING btree (description_id);


--
-- Name: field_descriptions_field_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_descriptions_field_id_idx ON public.field_descriptions USING btree (field_id);


--
-- Name: field_flags_field_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_flags_field_id_idx ON public.field_flags USING btree (field_id);


--
-- Name: field_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_flags_flag_id_idx ON public.field_flags USING btree (flag_id);


--
-- Name: field_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_flags_type_idx ON public.field_flags USING btree (type);


--
-- Name: field_names_field_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_names_field_id_idx ON public.field_names USING btree (field_id);


--
-- Name: field_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_names_name_id_idx ON public.field_names USING btree (name_id);


--
-- Name: flags_icon_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flags_icon_id_idx ON public.flags USING btree (icon_id);


--
-- Name: flags_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flags_name_idx ON public.flags USING btree (name);


--
-- Name: grade_analyses_analysis_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_analyses_analysis_id_idx ON public.grade_analyses USING btree (analysis_id);


--
-- Name: grade_analyses_grade_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_analyses_grade_id_idx ON public.grade_analyses USING btree (grade_id);


--
-- Name: grade_feedbacks_feedback_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_feedbacks_feedback_id_idx ON public.grade_feedbacks USING btree (feedback_id);


--
-- Name: grade_feedbacks_grade_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_feedbacks_grade_id_idx ON public.grade_feedbacks USING btree (grade_id);


--
-- Name: grade_groups_chat_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_groups_chat_id_v7_idx ON public.grade_groups USING btree (chat_id);


--
-- Name: grade_groups_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_groups_group_id_v7_idx ON public.grade_groups USING btree (group_id);


--
-- Name: grade_improvements_grade_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_improvements_grade_id_idx ON public.grade_improvements USING btree (grade_id);


--
-- Name: grade_improvements_improvement_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_improvements_improvement_id_idx ON public.grade_improvements USING btree (improvement_id);


--
-- Name: grade_strengths_grade_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_strengths_grade_id_idx ON public.grade_strengths USING btree (grade_id);


--
-- Name: grade_strengths_strength_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_strengths_strength_id_idx ON public.grade_strengths USING btree (strength_id);


--
-- Name: grade_times_grade_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_times_grade_active_idx ON public.grade_times USING btree (grade_id, active);


--
-- Name: grade_times_grade_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_times_grade_id_idx ON public.grade_times USING btree (grade_id);


--
-- Name: grade_times_time_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_times_time_id_idx ON public.grade_times USING btree (time_id);


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
-- Name: hints_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hints_created_at_idx ON public.hints USING btree (created_at);


--
-- Name: html_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX html_active_idx ON public.html USING btree (active);


--
-- Name: html_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX html_created_at_idx ON public.html USING btree (created_at);


--
-- Name: html_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX html_name_idx ON public.html USING btree (name);


--
-- Name: html_uploads_html_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX html_uploads_html_id_idx ON public.html_uploads USING btree (html_id);


--
-- Name: html_uploads_upload_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX html_uploads_upload_id_idx ON public.html_uploads USING btree (upload_id);


--
-- Name: icons_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX icons_value_idx ON public.icons USING btree (value);


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
-- Name: improvements_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX improvements_created_at_idx ON public.improvements USING btree (created_at);


--
-- Name: improvements_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX improvements_message_id_idx ON public.improvements USING btree (message_id);


--
-- Name: improvements_tool_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX improvements_tool_call_id_idx ON public.improvements USING btree (tool_call_id);


--
-- Name: instruction_schemas_instruction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX instruction_schemas_instruction_id_idx ON public.instruction_schemas USING btree (instruction_id);


--
-- Name: instruction_schemas_schema_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX instruction_schemas_schema_id_idx ON public.instruction_schemas USING btree (schema_id);


--
-- Name: instructions_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX instructions_active_idx ON public.instructions USING btree (active);


--
-- Name: key_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_descriptions_description_id_idx ON public.key_descriptions USING btree (description_id);


--
-- Name: key_descriptions_key_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_descriptions_key_id_idx ON public.key_descriptions USING btree (key_id);


--
-- Name: key_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_flags_flag_id_idx ON public.key_flags USING btree (flag_id);


--
-- Name: key_flags_key_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_flags_key_id_idx ON public.key_flags USING btree (key_id);


--
-- Name: key_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_flags_type_idx ON public.key_flags USING btree (type);


--
-- Name: key_names_key_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_names_key_id_idx ON public.key_names USING btree (key_id);


--
-- Name: key_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_names_name_id_idx ON public.key_names USING btree (name_id);


--
-- Name: message_audio_message_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_audio_message_id_v7_idx ON public.message_audio USING btree (message_id);


--
-- Name: message_audio_upload_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_audio_upload_id_v7_idx ON public.message_audio USING btree (upload_id);


--
-- Name: message_content_content_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_content_content_id_idx ON public.message_content USING btree (content_id);


--
-- Name: message_content_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_content_message_id_idx ON public.message_content USING btree (message_id);


--
-- Name: message_content_message_id_idx_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_content_message_id_idx_idx ON public.message_content USING btree (message_id, idx);


--
-- Name: message_feedback_highlight_message_feedback_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_feedback_highlight_message_feedback_id_v7_idx ON public.message_feedback_highlight USING btree (message_feedback_id);


--
-- Name: message_feedback_replace_message_feedback_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_feedback_replace_message_feedback_id_v7_idx ON public.message_feedback_replace USING btree (message_feedback_id);


--
-- Name: message_hints_hint_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_hints_hint_id_idx ON public.message_hints USING btree (hint_id);


--
-- Name: message_hints_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_hints_message_id_idx ON public.message_hints USING btree (message_id);


--
-- Name: message_hints_message_id_idx_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_hints_message_id_idx_idx ON public.message_hints USING btree (message_id, idx);


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
-- Name: model_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_descriptions_description_id_idx ON public.model_descriptions USING btree (description_id);


--
-- Name: model_descriptions_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_descriptions_model_id_idx ON public.model_descriptions USING btree (model_id);


--
-- Name: model_endpoints_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_endpoints_active_idx ON public.model_endpoints USING btree (active);


--
-- Name: model_endpoints_model_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_endpoints_model_id_v7_idx ON public.model_endpoints USING btree (model_id);


--
-- Name: model_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_flags_flag_id_idx ON public.model_flags USING btree (flag_id);


--
-- Name: model_flags_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_flags_model_id_idx ON public.model_flags USING btree (model_id);


--
-- Name: model_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_flags_type_idx ON public.model_flags USING btree (type);


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
-- Name: model_names_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_names_model_id_idx ON public.model_names USING btree (model_id);


--
-- Name: model_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_names_name_id_idx ON public.model_names USING btree (name_id);


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
-- Name: model_providers_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_providers_model_id_idx ON public.model_providers USING btree (model_id);


--
-- Name: model_providers_provider_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_providers_provider_id_idx ON public.model_providers USING btree (provider_id);


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
-- Name: names_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX names_name_idx ON public.names USING btree (name);


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
-- Name: parameter_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_descriptions_description_id_idx ON public.parameter_descriptions USING btree (description_id);


--
-- Name: parameter_descriptions_parameter_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_descriptions_parameter_id_idx ON public.parameter_descriptions USING btree (parameter_id);


--
-- Name: parameter_fields_field_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_fields_field_id_idx ON public.parameter_fields USING btree (field_id);


--
-- Name: parameter_fields_parameter_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_fields_parameter_id_idx ON public.parameter_fields USING btree (parameter_id);


--
-- Name: parameter_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_flags_flag_id_idx ON public.parameter_flags USING btree (flag_id);


--
-- Name: parameter_flags_parameter_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_flags_parameter_id_idx ON public.parameter_flags USING btree (parameter_id);


--
-- Name: parameter_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_flags_type_idx ON public.parameter_flags USING btree (type);


--
-- Name: parameter_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_names_name_id_idx ON public.parameter_names USING btree (name_id);


--
-- Name: parameter_names_parameter_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_names_parameter_id_idx ON public.parameter_names USING btree (parameter_id);


--
-- Name: persona_colors_color_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_colors_color_id_idx ON public.persona_colors USING btree (color_id);


--
-- Name: persona_colors_persona_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_colors_persona_id_idx ON public.persona_colors USING btree (persona_id);


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
-- Name: persona_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_descriptions_description_id_idx ON public.persona_descriptions USING btree (description_id);


--
-- Name: persona_descriptions_persona_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_descriptions_persona_id_idx ON public.persona_descriptions USING btree (persona_id);


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
-- Name: persona_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_flags_flag_id_idx ON public.persona_flags USING btree (flag_id);


--
-- Name: persona_flags_persona_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_flags_persona_id_idx ON public.persona_flags USING btree (persona_id);


--
-- Name: persona_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_flags_type_idx ON public.persona_flags USING btree (type);


--
-- Name: persona_icons_icon_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_icons_icon_id_idx ON public.persona_icons USING btree (icon_id);


--
-- Name: persona_icons_persona_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_icons_persona_id_idx ON public.persona_icons USING btree (persona_id);


--
-- Name: persona_instructions_instruction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_instructions_instruction_id_idx ON public.persona_instructions USING btree (instruction_id);


--
-- Name: persona_instructions_persona_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_instructions_persona_id_idx ON public.persona_instructions USING btree (persona_id);


--
-- Name: persona_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_names_name_id_idx ON public.persona_names USING btree (name_id);


--
-- Name: persona_names_persona_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_names_persona_id_idx ON public.persona_names USING btree (persona_id);


--
-- Name: personas_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personas_id_idx ON public.personas USING btree (id);


--
-- Name: points_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX points_value_idx ON public.points USING btree (value);


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
-- Name: profile_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_flags_flag_id_idx ON public.profile_flags USING btree (flag_id);


--
-- Name: profile_flags_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_flags_profile_id_idx ON public.profile_flags USING btree (profile_id);


--
-- Name: profile_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_flags_type_idx ON public.profile_flags USING btree (type);


--
-- Name: profile_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_names_name_id_idx ON public.profile_names USING btree (name_id);


--
-- Name: profile_names_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_names_profile_id_idx ON public.profile_names USING btree (profile_id);


--
-- Name: profile_names_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_names_type_idx ON public.profile_names USING btree (type);


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
-- Name: provider_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_descriptions_description_id_idx ON public.provider_descriptions USING btree (description_id);


--
-- Name: provider_descriptions_provider_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_descriptions_provider_id_idx ON public.provider_descriptions USING btree (provider_id);


--
-- Name: provider_endpoints_provider_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_endpoints_provider_id_v7_idx ON public.provider_endpoints USING btree (provider_id);


--
-- Name: provider_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_flags_flag_id_idx ON public.provider_flags USING btree (flag_id);


--
-- Name: provider_flags_provider_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_flags_provider_id_idx ON public.provider_flags USING btree (provider_id);


--
-- Name: provider_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_flags_type_idx ON public.provider_flags USING btree (type);


--
-- Name: provider_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_names_name_id_idx ON public.provider_names USING btree (name_id);


--
-- Name: provider_names_provider_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_names_provider_id_idx ON public.provider_names USING btree (provider_id);


--
-- Name: question_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX question_departments_department_id_v7_idx ON public.question_departments USING btree (department_id);


--
-- Name: question_departments_question_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX question_departments_question_id_v7_idx ON public.question_departments USING btree (question_id);


--
-- Name: questions_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX questions_active_idx ON public.questions USING btree (active);


--
-- Name: questions_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX questions_time_idx ON public.questions USING btree ("time");


--
-- Name: quiz_responses_option_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quiz_responses_option_id_v7_idx ON public.responses USING btree (option_id);


--
-- Name: quiz_responses_question_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quiz_responses_question_id_v7_idx ON public.responses USING btree (question_id);


--
-- Name: resource_schemas_schema_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX resource_schemas_schema_id_idx ON public.resource_schemas USING btree (schema_id);


--
-- Name: resource_tools_tool_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX resource_tools_tool_id_idx ON public.resource_tools USING btree (tool_id);


--
-- Name: rubric_artifacts_artifact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_artifacts_artifact_idx ON public.rubric_artifacts USING btree (artifact);


--
-- Name: rubric_artifacts_rubric_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_artifacts_rubric_id_idx ON public.rubric_artifacts USING btree (rubric_id);


--
-- Name: rubric_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_departments_department_id_v7_idx ON public.rubric_departments USING btree (department_id);


--
-- Name: rubric_departments_rubric_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_departments_rubric_id_v7_idx ON public.rubric_departments USING btree (rubric_id);


--
-- Name: rubric_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_descriptions_description_id_idx ON public.rubric_descriptions USING btree (description_id);


--
-- Name: rubric_descriptions_rubric_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_descriptions_rubric_id_idx ON public.rubric_descriptions USING btree (rubric_id);


--
-- Name: rubric_domains_domain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_domains_domain_id_idx ON public.rubric_domains USING btree (domain_id);


--
-- Name: rubric_domains_rubric_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_domains_rubric_id_idx ON public.rubric_domains USING btree (rubric_id);


--
-- Name: rubric_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_flags_flag_id_idx ON public.rubric_flags USING btree (flag_id);


--
-- Name: rubric_flags_rubric_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_flags_rubric_id_idx ON public.rubric_flags USING btree (rubric_id);


--
-- Name: rubric_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_flags_type_idx ON public.rubric_flags USING btree (type);


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
-- Name: rubric_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_names_name_id_idx ON public.rubric_names USING btree (name_id);


--
-- Name: rubric_names_rubric_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_names_rubric_id_idx ON public.rubric_names USING btree (rubric_id);


--
-- Name: rubric_points_point_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_points_point_id_idx ON public.rubric_points USING btree (point_id);


--
-- Name: rubric_points_rubric_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_points_rubric_id_idx ON public.rubric_points USING btree (rubric_id);


--
-- Name: rubric_points_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_points_type_idx ON public.rubric_points USING btree (type);


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
-- Name: rubrics_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubrics_id_idx ON public.rubrics USING btree (id);


--
-- Name: rubrics_rubric_domain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubrics_rubric_domain_id_idx ON public.rubrics USING btree (rubric_domain_id);


--
-- Name: run_debug_info_debug_info_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_debug_info_debug_info_id_idx ON public.run_debug_info USING btree (debug_info_id);


--
-- Name: run_debug_info_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_debug_info_run_id_idx ON public.run_debug_info USING btree (run_id);


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
-- Name: scenario_agent_domains_agent_domain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_agent_domains_agent_domain_id_idx ON public.scenario_agent_domains USING btree (agent_domain_id);


--
-- Name: scenario_agent_domains_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_agent_domains_scenario_id_idx ON public.scenario_agent_domains USING btree (scenario_id);


--
-- Name: scenario_agent_domains_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_agent_domains_type_idx ON public.scenario_agent_domains USING btree (type);


--
-- Name: scenario_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_departments_department_id_v7_idx ON public.scenario_departments USING btree (department_id);


--
-- Name: scenario_departments_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_departments_scenario_id_v7_idx ON public.scenario_departments USING btree (scenario_id);


--
-- Name: scenario_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_descriptions_description_id_idx ON public.scenario_descriptions USING btree (description_id);


--
-- Name: scenario_descriptions_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_descriptions_scenario_id_idx ON public.scenario_descriptions USING btree (scenario_id);


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
-- Name: scenario_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_flags_flag_id_idx ON public.scenario_flags USING btree (flag_id);


--
-- Name: scenario_flags_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_flags_scenario_id_idx ON public.scenario_flags USING btree (scenario_id);


--
-- Name: scenario_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_flags_type_idx ON public.scenario_flags USING btree (type);


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
-- Name: scenario_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_names_name_id_idx ON public.scenario_names USING btree (name_id);


--
-- Name: scenario_names_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_names_scenario_id_idx ON public.scenario_names USING btree (scenario_id);


--
-- Name: scenario_objectives_objective_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_objectives_objective_id_v7_idx ON public.scenario_objectives USING btree (objective_id);


--
-- Name: scenario_objectives_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_objectives_scenario_id_v7_idx ON public.scenario_objectives USING btree (scenario_id);


--
-- Name: scenario_options_option_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_options_option_id_idx ON public.scenario_options USING btree (option_id);


--
-- Name: scenario_options_scenario_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_options_scenario_active_idx ON public.scenario_options USING btree (scenario_id, active);


--
-- Name: scenario_options_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_options_scenario_id_idx ON public.scenario_options USING btree (scenario_id);


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
-- Name: scenario_questions_question_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_questions_question_id_idx ON public.scenario_questions USING btree (question_id);


--
-- Name: scenario_questions_question_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_questions_question_id_v7_idx ON public.scenario_questions USING btree (question_id);


--
-- Name: scenario_questions_scenario_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_questions_scenario_active_idx ON public.scenario_questions USING btree (scenario_id, active);


--
-- Name: scenario_questions_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_questions_scenario_id_idx ON public.scenario_questions USING btree (scenario_id);


--
-- Name: scenario_questions_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_questions_scenario_id_v7_idx ON public.scenario_questions USING btree (scenario_id);


--
-- Name: scenario_templates_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_templates_active_idx ON public.scenario_templates USING btree (active);


--
-- Name: scenario_templates_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_templates_scenario_id_idx ON public.scenario_templates USING btree (scenario_id);


--
-- Name: scenario_templates_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_templates_template_id_idx ON public.scenario_templates USING btree (template_id);


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
-- Name: schema_field_items_item_schema_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schema_field_items_item_schema_id_idx ON public.schema_field_items USING btree (item_schema_id);


--
-- Name: schema_field_items_schema_field_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schema_field_items_schema_field_id_idx ON public.schema_field_items USING btree (schema_field_id);


--
-- Name: schema_fields_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schema_fields_position_idx ON public.schema_fields USING btree (schema_id, "position");


--
-- Name: schema_fields_schema_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schema_fields_schema_id_idx ON public.schema_fields USING btree (schema_id);


--
-- Name: schema_templates_schema_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schema_templates_schema_id_idx ON public.schema_templates USING btree (schema_id);


--
-- Name: schema_templates_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schema_templates_template_id_idx ON public.schema_templates USING btree (template_id);


--
-- Name: schemas_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schemas_created_at_idx ON public.schemas USING btree (created_at);


--
-- Name: schemas_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schemas_updated_at_idx ON public.schemas USING btree (updated_at);


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
-- Name: setting_colors_color_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_colors_color_id_idx ON public.setting_colors USING btree (color_id);


--
-- Name: setting_colors_setting_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_colors_setting_id_idx ON public.setting_colors USING btree (setting_id);


--
-- Name: setting_colors_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_colors_type_idx ON public.setting_colors USING btree (type);


--
-- Name: setting_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_descriptions_description_id_idx ON public.setting_descriptions USING btree (description_id);


--
-- Name: setting_descriptions_setting_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_descriptions_setting_id_idx ON public.setting_descriptions USING btree (setting_id);


--
-- Name: setting_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_flags_flag_id_idx ON public.setting_flags USING btree (flag_id);


--
-- Name: setting_flags_setting_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_flags_setting_id_idx ON public.setting_flags USING btree (setting_id);


--
-- Name: setting_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_flags_type_idx ON public.setting_flags USING btree (type);


--
-- Name: setting_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_names_name_id_idx ON public.setting_names USING btree (name_id);


--
-- Name: setting_names_setting_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_names_setting_id_idx ON public.setting_names USING btree (setting_id);


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
-- Name: setting_thresholds_setting_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_thresholds_setting_id_idx ON public.setting_thresholds USING btree (setting_id);


--
-- Name: setting_thresholds_threshold_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_thresholds_threshold_id_idx ON public.setting_thresholds USING btree (threshold_id);


--
-- Name: setting_thresholds_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_thresholds_type_idx ON public.setting_thresholds USING btree (type);


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
-- Name: settings_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_updated_at_idx ON public.settings USING btree (updated_at);


--
-- Name: simulation_agent_domains_agent_domain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_agent_domains_agent_domain_id_idx ON public.simulation_agent_domains USING btree (agent_domain_id);


--
-- Name: simulation_agent_domains_simulation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_agent_domains_simulation_id_idx ON public.simulation_agent_domains USING btree (simulation_id);


--
-- Name: simulation_agent_domains_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_agent_domains_type_idx ON public.simulation_agent_domains USING btree (type);


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
-- Name: simulation_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_descriptions_description_id_idx ON public.simulation_descriptions USING btree (description_id);


--
-- Name: simulation_descriptions_simulation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_descriptions_simulation_id_idx ON public.simulation_descriptions USING btree (simulation_id);


--
-- Name: simulation_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_flags_flag_id_idx ON public.simulation_flags USING btree (flag_id);


--
-- Name: simulation_flags_simulation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_flags_simulation_id_idx ON public.simulation_flags USING btree (simulation_id);


--
-- Name: simulation_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_flags_type_idx ON public.simulation_flags USING btree (type);


--
-- Name: simulation_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_names_name_id_idx ON public.simulation_names USING btree (name_id);


--
-- Name: simulation_names_simulation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_names_simulation_id_idx ON public.simulation_names USING btree (simulation_id);


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
-- Name: strengths_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX strengths_created_at_idx ON public.strengths USING btree (created_at);


--
-- Name: strengths_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX strengths_message_id_idx ON public.strengths USING btree (message_id);


--
-- Name: strengths_tool_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX strengths_tool_call_id_idx ON public.strengths USING btree (tool_call_id);


--
-- Name: template_array_items_item_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX template_array_items_item_template_id_idx ON public.template_array_items USING btree (item_template_id);


--
-- Name: template_array_items_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX template_array_items_position_idx ON public.template_array_items USING btree (template_id, schema_field_id, "position");


--
-- Name: template_array_items_schema_field_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX template_array_items_schema_field_id_idx ON public.template_array_items USING btree (schema_field_id);


--
-- Name: template_array_items_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX template_array_items_template_id_idx ON public.template_array_items USING btree (template_id);


--
-- Name: template_values_schema_field_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX template_values_schema_field_id_idx ON public.template_values USING btree (schema_field_id);


--
-- Name: template_values_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX template_values_template_id_idx ON public.template_values USING btree (template_id);


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
-- Name: thresholds_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX thresholds_value_idx ON public.thresholds USING btree (value);


--
-- Name: times_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX times_active_idx ON public.times USING btree (active);


--
-- Name: times_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX times_created_at_idx ON public.times USING btree (created_at);


--
-- Name: times_time_taken_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX times_time_taken_idx ON public.times USING btree (time_taken);


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

CREATE UNIQUE INDEX tool_calls_call_id_idx ON public.calls USING btree (call_id);


--
-- Name: tool_calls_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_calls_created_at_idx ON public.calls USING btree (created_at);


--
-- Name: tool_calls_tool_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_calls_tool_id_idx ON public.calls USING btree (tool_id);


--
-- Name: tool_schemas_schema_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_schemas_schema_id_idx ON public.tool_schemas USING btree (schema_id);


--
-- Name: tool_schemas_tool_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_schemas_tool_id_idx ON public.tool_schemas USING btree (tool_id);


--
-- Name: tools_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tools_active_idx ON public.tools USING btree (active);


--
-- Name: tools_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tools_template_id_idx ON public.tools USING btree (template_id);


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
-- Name: agent_descriptions agent_descriptions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_descriptions
    ADD CONSTRAINT agent_descriptions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_descriptions agent_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_descriptions
    ADD CONSTRAINT agent_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: agent_instructions agent_developer_instructions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_instructions
    ADD CONSTRAINT agent_developer_instructions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_domains agent_domains_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_domains
    ADD CONSTRAINT agent_domains_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_domains agent_domains_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_domains
    ADD CONSTRAINT agent_domains_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: agent_flags agent_flags_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_flags
    ADD CONSTRAINT agent_flags_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_flags agent_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_flags
    ADD CONSTRAINT agent_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: agent_instructions agent_instructions_instruction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_instructions
    ADD CONSTRAINT agent_instructions_instruction_id_fkey FOREIGN KEY (instruction_id) REFERENCES public.instructions(id) ON DELETE CASCADE;


--
-- Name: agent_models agent_models_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_models
    ADD CONSTRAINT agent_models_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_models agent_models_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_models
    ADD CONSTRAINT agent_models_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE CASCADE;


--
-- Name: agent_names agent_names_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_names
    ADD CONSTRAINT agent_names_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_names agent_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_names
    ADD CONSTRAINT agent_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


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
-- Name: auth_descriptions auth_descriptions_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_descriptions
    ADD CONSTRAINT auth_descriptions_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id) ON DELETE CASCADE;


--
-- Name: auth_descriptions auth_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_descriptions
    ADD CONSTRAINT auth_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: auth_flags auth_flags_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_flags
    ADD CONSTRAINT auth_flags_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id) ON DELETE CASCADE;


--
-- Name: auth_flags auth_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_flags
    ADD CONSTRAINT auth_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: auth_items auth_items_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_items
    ADD CONSTRAINT auth_items_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id);


--
-- Name: auth_names auth_names_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_names
    ADD CONSTRAINT auth_names_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id) ON DELETE CASCADE;


--
-- Name: auth_names auth_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_names
    ADD CONSTRAINT auth_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: calls calls_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id);


--
-- Name: calls calls_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id);


--
-- Name: chat_conversations chat_conversations_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: chat_conversations chat_conversations_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


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
-- Name: chat_responses chat_responses_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_responses
    ADD CONSTRAINT chat_responses_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: chat_responses chat_responses_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_responses
    ADD CONSTRAINT chat_responses_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.responses(id) ON DELETE CASCADE;


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
-- Name: cohort_descriptions cohort_descriptions_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_descriptions
    ADD CONSTRAINT cohort_descriptions_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id) ON DELETE CASCADE;


--
-- Name: cohort_descriptions cohort_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_descriptions
    ADD CONSTRAINT cohort_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: cohort_flags cohort_flags_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_flags
    ADD CONSTRAINT cohort_flags_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id) ON DELETE CASCADE;


--
-- Name: cohort_flags cohort_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_flags
    ADD CONSTRAINT cohort_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: cohort_names cohort_names_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_names
    ADD CONSTRAINT cohort_names_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id) ON DELETE CASCADE;


--
-- Name: cohort_names cohort_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_names
    ADD CONSTRAINT cohort_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


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
-- Name: content content_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content
    ADD CONSTRAINT content_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.calls(id);


--
-- Name: department_descriptions department_descriptions_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_descriptions
    ADD CONSTRAINT department_descriptions_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: department_descriptions department_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_descriptions
    ADD CONSTRAINT department_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: department_flags department_flags_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_flags
    ADD CONSTRAINT department_flags_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: department_flags department_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_flags
    ADD CONSTRAINT department_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: department_names department_names_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_names
    ADD CONSTRAINT department_names_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: department_names department_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_names
    ADD CONSTRAINT department_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


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
-- Name: instruction_schemas developer_instruction_schemas_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instruction_schemas
    ADD CONSTRAINT developer_instruction_schemas_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.schemas(id) ON DELETE CASCADE;


--
-- Name: document_agent_domains document_agent_domains_agent_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_agent_domains
    ADD CONSTRAINT document_agent_domains_agent_domain_id_fkey FOREIGN KEY (agent_domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: document_agent_domains document_agent_domains_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_agent_domains
    ADD CONSTRAINT document_agent_domains_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_content document_content_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_content
    ADD CONSTRAINT document_content_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content(id) ON DELETE CASCADE;


--
-- Name: document_content document_content_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_content
    ADD CONSTRAINT document_content_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


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
-- Name: document_descriptions document_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_descriptions
    ADD CONSTRAINT document_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: document_descriptions document_descriptions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_descriptions
    ADD CONSTRAINT document_descriptions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


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
-- Name: document_flags document_flags_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_flags
    ADD CONSTRAINT document_flags_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_flags document_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_flags
    ADD CONSTRAINT document_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


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
-- Name: document_html document_html_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_html
    ADD CONSTRAINT document_html_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_html document_html_html_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_html
    ADD CONSTRAINT document_html_html_id_fkey FOREIGN KEY (html_id) REFERENCES public.html(id) ON DELETE CASCADE;


--
-- Name: document_names document_names_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_names
    ADD CONSTRAINT document_names_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_names document_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_names
    ADD CONSTRAINT document_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: document_schemas document_schemas_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_schemas
    ADD CONSTRAINT document_schemas_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_schemas document_schemas_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_schemas
    ADD CONSTRAINT document_schemas_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.schemas(id) ON DELETE CASCADE;


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
-- Name: domain_artifacts domain_artifacts_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_artifacts
    ADD CONSTRAINT domain_artifacts_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


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
-- Name: eval_descriptions eval_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_descriptions
    ADD CONSTRAINT eval_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: eval_descriptions eval_descriptions_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_descriptions
    ADD CONSTRAINT eval_descriptions_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.evals(id) ON DELETE CASCADE;


--
-- Name: eval_flags eval_flags_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_flags
    ADD CONSTRAINT eval_flags_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.evals(id) ON DELETE CASCADE;


--
-- Name: eval_flags eval_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_flags
    ADD CONSTRAINT eval_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


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
-- Name: eval_names eval_names_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_names
    ADD CONSTRAINT eval_names_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.evals(id) ON DELETE CASCADE;


--
-- Name: eval_names eval_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_names
    ADD CONSTRAINT eval_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


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
-- Name: field_descriptions field_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_descriptions
    ADD CONSTRAINT field_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: field_descriptions field_descriptions_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_descriptions
    ADD CONSTRAINT field_descriptions_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE CASCADE;


--
-- Name: field_flags field_flags_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_flags
    ADD CONSTRAINT field_flags_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE CASCADE;


--
-- Name: field_flags field_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_flags
    ADD CONSTRAINT field_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: field_names field_names_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_names
    ADD CONSTRAINT field_names_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE CASCADE;


--
-- Name: field_names field_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_names
    ADD CONSTRAINT field_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: flags flags_icon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flags
    ADD CONSTRAINT flags_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES public.icons(id);


--
-- Name: grade_analyses grade_analyses_analysis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_analyses
    ADD CONSTRAINT grade_analyses_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES public.analyses(id) ON DELETE CASCADE;


--
-- Name: grade_analyses grade_analyses_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_analyses
    ADD CONSTRAINT grade_analyses_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id) ON DELETE CASCADE;


--
-- Name: grade_feedbacks grade_feedbacks_feedback_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_feedbacks
    ADD CONSTRAINT grade_feedbacks_feedback_id_fkey FOREIGN KEY (feedback_id) REFERENCES public.feedbacks(id) ON DELETE CASCADE;


--
-- Name: grade_feedbacks grade_feedbacks_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_feedbacks
    ADD CONSTRAINT grade_feedbacks_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id) ON DELETE CASCADE;


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
-- Name: grade_improvements grade_improvements_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_improvements
    ADD CONSTRAINT grade_improvements_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id) ON DELETE CASCADE;


--
-- Name: grade_improvements grade_improvements_improvement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_improvements
    ADD CONSTRAINT grade_improvements_improvement_id_fkey FOREIGN KEY (improvement_id) REFERENCES public.improvements(id) ON DELETE CASCADE;


--
-- Name: grade_strengths grade_strengths_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_strengths
    ADD CONSTRAINT grade_strengths_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id) ON DELETE CASCADE;


--
-- Name: grade_strengths grade_strengths_strength_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_strengths
    ADD CONSTRAINT grade_strengths_strength_id_fkey FOREIGN KEY (strength_id) REFERENCES public.strengths(id) ON DELETE CASCADE;


--
-- Name: grade_times grade_times_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_times
    ADD CONSTRAINT grade_times_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id) ON DELETE CASCADE;


--
-- Name: grade_times grade_times_time_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_times
    ADD CONSTRAINT grade_times_time_id_fkey FOREIGN KEY (time_id) REFERENCES public.times(id) ON DELETE RESTRICT;


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
-- Name: html_uploads html_uploads_html_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.html_uploads
    ADD CONSTRAINT html_uploads_html_id_fkey FOREIGN KEY (html_id) REFERENCES public.html(id) ON DELETE CASCADE;


--
-- Name: html_uploads html_uploads_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.html_uploads
    ADD CONSTRAINT html_uploads_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id) ON DELETE RESTRICT;


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
    ADD CONSTRAINT images_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.calls(id);


--
-- Name: improvements improvements_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.improvements
    ADD CONSTRAINT improvements_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: improvements improvements_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.improvements
    ADD CONSTRAINT improvements_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.calls(id);


--
-- Name: instruction_schemas instruction_schemas_instruction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instruction_schemas
    ADD CONSTRAINT instruction_schemas_instruction_id_fkey FOREIGN KEY (instruction_id) REFERENCES public.instructions(id) ON DELETE CASCADE;


--
-- Name: key_descriptions key_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_descriptions
    ADD CONSTRAINT key_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: key_descriptions key_descriptions_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_descriptions
    ADD CONSTRAINT key_descriptions_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.keys(id) ON DELETE CASCADE;


--
-- Name: key_flags key_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_flags
    ADD CONSTRAINT key_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: key_flags key_flags_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_flags
    ADD CONSTRAINT key_flags_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.keys(id) ON DELETE CASCADE;


--
-- Name: key_names key_names_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_names
    ADD CONSTRAINT key_names_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.keys(id) ON DELETE CASCADE;


--
-- Name: key_names key_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_names
    ADD CONSTRAINT key_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


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
-- Name: message_content message_content_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_content
    ADD CONSTRAINT message_content_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content(id) ON DELETE CASCADE;


--
-- Name: message_content message_content_message_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_content
    ADD CONSTRAINT message_content_message_id_fkey1 FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_feedback_highlight message_feedback_highlight_message_feedback_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback_highlight
    ADD CONSTRAINT message_feedback_highlight_message_feedback_id_fkey FOREIGN KEY (message_feedback_id) REFERENCES public.strengths(id) ON DELETE CASCADE;


--
-- Name: message_feedback_replace message_feedback_replace_message_feedback_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback_replace
    ADD CONSTRAINT message_feedback_replace_message_feedback_id_fkey FOREIGN KEY (message_feedback_id) REFERENCES public.improvements(id) ON DELETE CASCADE;


--
-- Name: message_hints message_hints_hint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_hints
    ADD CONSTRAINT message_hints_hint_id_fkey FOREIGN KEY (hint_id) REFERENCES public.hints(id) ON DELETE CASCADE;


--
-- Name: message_hints message_hints_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_hints
    ADD CONSTRAINT message_hints_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


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
-- Name: model_descriptions model_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_descriptions
    ADD CONSTRAINT model_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: model_descriptions model_descriptions_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_descriptions
    ADD CONSTRAINT model_descriptions_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE CASCADE;


--
-- Name: model_endpoints model_endpoints_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_endpoints
    ADD CONSTRAINT model_endpoints_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: model_flags model_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_flags
    ADD CONSTRAINT model_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: model_flags model_flags_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_flags
    ADD CONSTRAINT model_flags_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE CASCADE;


--
-- Name: model_modalities model_modalities_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_modalities
    ADD CONSTRAINT model_modalities_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id);


--
-- Name: model_names model_names_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_names
    ADD CONSTRAINT model_names_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE CASCADE;


--
-- Name: model_names model_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_names
    ADD CONSTRAINT model_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


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
-- Name: model_providers model_providers_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_providers
    ADD CONSTRAINT model_providers_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE CASCADE;


--
-- Name: model_providers model_providers_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_providers
    ADD CONSTRAINT model_providers_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT objectives_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.calls(id);


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
-- Name: parameter_descriptions parameter_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_descriptions
    ADD CONSTRAINT parameter_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: parameter_descriptions parameter_descriptions_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_descriptions
    ADD CONSTRAINT parameter_descriptions_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameters(id) ON DELETE CASCADE;


--
-- Name: parameter_fields parameter_fields_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_fields
    ADD CONSTRAINT parameter_fields_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE CASCADE;


--
-- Name: parameter_fields parameter_fields_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_fields
    ADD CONSTRAINT parameter_fields_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameters(id) ON DELETE CASCADE;


--
-- Name: parameter_flags parameter_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_flags
    ADD CONSTRAINT parameter_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: parameter_flags parameter_flags_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_flags
    ADD CONSTRAINT parameter_flags_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameters(id) ON DELETE CASCADE;


--
-- Name: parameter_names parameter_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_names
    ADD CONSTRAINT parameter_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: parameter_names parameter_names_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_names
    ADD CONSTRAINT parameter_names_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameters(id) ON DELETE CASCADE;


--
-- Name: persona_colors persona_colors_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_colors
    ADD CONSTRAINT persona_colors_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colors(id) ON DELETE CASCADE;


--
-- Name: persona_colors persona_colors_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_colors
    ADD CONSTRAINT persona_colors_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(id) ON DELETE CASCADE;


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
-- Name: persona_descriptions persona_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_descriptions
    ADD CONSTRAINT persona_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: persona_descriptions persona_descriptions_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_descriptions
    ADD CONSTRAINT persona_descriptions_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(id) ON DELETE CASCADE;


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
-- Name: persona_flags persona_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_flags
    ADD CONSTRAINT persona_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: persona_flags persona_flags_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_flags
    ADD CONSTRAINT persona_flags_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(id) ON DELETE CASCADE;


--
-- Name: persona_icons persona_icons_icon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_icons
    ADD CONSTRAINT persona_icons_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES public.icons(id) ON DELETE CASCADE;


--
-- Name: persona_icons persona_icons_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_icons
    ADD CONSTRAINT persona_icons_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(id) ON DELETE CASCADE;


--
-- Name: persona_instructions persona_instructions_instruction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_instructions
    ADD CONSTRAINT persona_instructions_instruction_id_fkey FOREIGN KEY (instruction_id) REFERENCES public.instructions(id) ON DELETE CASCADE;


--
-- Name: persona_instructions persona_instructions_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_instructions
    ADD CONSTRAINT persona_instructions_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(id) ON DELETE CASCADE;


--
-- Name: persona_names persona_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_names
    ADD CONSTRAINT persona_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: persona_names persona_names_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_names
    ADD CONSTRAINT persona_names_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT problem_statements_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.calls(id);


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
-- Name: profile_flags profile_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_flags
    ADD CONSTRAINT profile_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: profile_flags profile_flags_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_flags
    ADD CONSTRAINT profile_flags_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profile_names profile_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_names
    ADD CONSTRAINT profile_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: profile_names profile_names_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_names
    ADD CONSTRAINT profile_names_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


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
-- Name: provider_descriptions provider_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_descriptions
    ADD CONSTRAINT provider_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: provider_descriptions provider_descriptions_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_descriptions
    ADD CONSTRAINT provider_descriptions_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: provider_endpoints provider_endpoints_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_endpoints
    ADD CONSTRAINT provider_endpoints_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id);


--
-- Name: provider_flags provider_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_flags
    ADD CONSTRAINT provider_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: provider_flags provider_flags_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_flags
    ADD CONSTRAINT provider_flags_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: provider_names provider_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_names
    ADD CONSTRAINT provider_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: provider_names provider_names_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_names
    ADD CONSTRAINT provider_names_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


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
-- Name: responses quiz_responses_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT quiz_responses_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.options(id);


--
-- Name: responses quiz_responses_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT quiz_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: resource_schemas resource_schemas_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_schemas
    ADD CONSTRAINT resource_schemas_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.schemas(id) ON DELETE CASCADE;


--
-- Name: resource_tools resource_tools_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_tools
    ADD CONSTRAINT resource_tools_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE;


--
-- Name: rubric_artifacts rubric_artifacts_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_artifacts
    ADD CONSTRAINT rubric_artifacts_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubrics(id) ON DELETE CASCADE;


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
-- Name: rubric_descriptions rubric_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_descriptions
    ADD CONSTRAINT rubric_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: rubric_descriptions rubric_descriptions_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_descriptions
    ADD CONSTRAINT rubric_descriptions_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubrics(id) ON DELETE CASCADE;


--
-- Name: rubric_domains rubric_domains_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_domains
    ADD CONSTRAINT rubric_domains_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: rubric_domains rubric_domains_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_domains
    ADD CONSTRAINT rubric_domains_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubrics(id) ON DELETE CASCADE;


--
-- Name: rubric_flags rubric_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_flags
    ADD CONSTRAINT rubric_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: rubric_flags rubric_flags_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_flags
    ADD CONSTRAINT rubric_flags_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubrics(id) ON DELETE CASCADE;


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
-- Name: rubric_names rubric_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_names
    ADD CONSTRAINT rubric_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: rubric_names rubric_names_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_names
    ADD CONSTRAINT rubric_names_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubrics(id) ON DELETE CASCADE;


--
-- Name: rubric_points rubric_points_point_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_points
    ADD CONSTRAINT rubric_points_point_id_fkey FOREIGN KEY (point_id) REFERENCES public.points(id) ON DELETE CASCADE;


--
-- Name: rubric_points rubric_points_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_points
    ADD CONSTRAINT rubric_points_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubrics(id) ON DELETE CASCADE;


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
-- Name: rubrics rubrics_rubric_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubrics
    ADD CONSTRAINT rubrics_rubric_domain_id_fkey FOREIGN KEY (rubric_domain_id) REFERENCES public.domains(id) ON DELETE SET NULL;


--
-- Name: run_debug_info run_debug_info_debug_info_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_debug_info
    ADD CONSTRAINT run_debug_info_debug_info_id_fkey FOREIGN KEY (debug_info_id) REFERENCES public.debug_info(id) ON DELETE CASCADE;


--
-- Name: run_debug_info run_debug_info_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_debug_info
    ADD CONSTRAINT run_debug_info_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;


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
-- Name: scenario_agent_domains scenario_agent_domains_agent_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_agent_domains
    ADD CONSTRAINT scenario_agent_domains_agent_domain_id_fkey FOREIGN KEY (agent_domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


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
-- Name: scenario_descriptions scenario_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_descriptions
    ADD CONSTRAINT scenario_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: scenario_descriptions scenario_descriptions_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_descriptions
    ADD CONSTRAINT scenario_descriptions_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE;


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
-- Name: scenario_agent_domains scenario_domains_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_agent_domains
    ADD CONSTRAINT scenario_domains_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE;


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
-- Name: scenario_flags scenario_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_flags
    ADD CONSTRAINT scenario_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: scenario_flags scenario_flags_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_flags
    ADD CONSTRAINT scenario_flags_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE;


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
-- Name: scenario_names scenario_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_names
    ADD CONSTRAINT scenario_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: scenario_names scenario_names_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_names
    ADD CONSTRAINT scenario_names_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE;


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
-- Name: scenario_options scenario_options_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_options
    ADD CONSTRAINT scenario_options_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.options(id) ON DELETE RESTRICT;


--
-- Name: scenario_options scenario_options_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_options
    ADD CONSTRAINT scenario_options_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE;


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
-- Name: scenario_templates scenario_templates_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_templates
    ADD CONSTRAINT scenario_templates_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE;


--
-- Name: scenario_templates scenario_templates_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_templates
    ADD CONSTRAINT scenario_templates_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


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
-- Name: schema_field_items schema_field_items_item_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_field_items
    ADD CONSTRAINT schema_field_items_item_schema_id_fkey FOREIGN KEY (item_schema_id) REFERENCES public.schemas(id) ON DELETE CASCADE;


--
-- Name: schema_field_items schema_field_items_schema_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_field_items
    ADD CONSTRAINT schema_field_items_schema_field_id_fkey FOREIGN KEY (schema_field_id) REFERENCES public.schema_fields(id) ON DELETE CASCADE;


--
-- Name: schema_fields schema_fields_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_fields
    ADD CONSTRAINT schema_fields_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.schemas(id) ON DELETE CASCADE;


--
-- Name: schema_templates schema_templates_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_templates
    ADD CONSTRAINT schema_templates_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.schemas(id) ON DELETE CASCADE;


--
-- Name: schema_templates schema_templates_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_templates
    ADD CONSTRAINT schema_templates_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


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
-- Name: setting_colors setting_colors_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_colors
    ADD CONSTRAINT setting_colors_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colors(id) ON DELETE CASCADE;


--
-- Name: setting_colors setting_colors_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_colors
    ADD CONSTRAINT setting_colors_setting_id_fkey FOREIGN KEY (setting_id) REFERENCES public.settings(id) ON DELETE CASCADE;


--
-- Name: setting_descriptions setting_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_descriptions
    ADD CONSTRAINT setting_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: setting_descriptions setting_descriptions_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_descriptions
    ADD CONSTRAINT setting_descriptions_setting_id_fkey FOREIGN KEY (setting_id) REFERENCES public.settings(id) ON DELETE CASCADE;


--
-- Name: setting_flags setting_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_flags
    ADD CONSTRAINT setting_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: setting_flags setting_flags_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_flags
    ADD CONSTRAINT setting_flags_setting_id_fkey FOREIGN KEY (setting_id) REFERENCES public.settings(id) ON DELETE CASCADE;


--
-- Name: setting_names setting_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_names
    ADD CONSTRAINT setting_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: setting_names setting_names_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_names
    ADD CONSTRAINT setting_names_setting_id_fkey FOREIGN KEY (setting_id) REFERENCES public.settings(id) ON DELETE CASCADE;


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
-- Name: setting_thresholds setting_thresholds_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_thresholds
    ADD CONSTRAINT setting_thresholds_setting_id_fkey FOREIGN KEY (setting_id) REFERENCES public.settings(id) ON DELETE CASCADE;


--
-- Name: setting_thresholds setting_thresholds_threshold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_thresholds
    ADD CONSTRAINT setting_thresholds_threshold_id_fkey FOREIGN KEY (threshold_id) REFERENCES public.thresholds(id) ON DELETE CASCADE;


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
-- Name: simulation_agent_domains simulation_agent_domains_agent_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_agent_domains
    ADD CONSTRAINT simulation_agent_domains_agent_domain_id_fkey FOREIGN KEY (agent_domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


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
-- Name: simulation_descriptions simulation_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_descriptions
    ADD CONSTRAINT simulation_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: simulation_descriptions simulation_descriptions_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_descriptions
    ADD CONSTRAINT simulation_descriptions_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE;


--
-- Name: simulation_agent_domains simulation_domains_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_agent_domains
    ADD CONSTRAINT simulation_domains_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE;


--
-- Name: simulation_flags simulation_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_flags
    ADD CONSTRAINT simulation_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: simulation_flags simulation_flags_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_flags
    ADD CONSTRAINT simulation_flags_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE;


--
-- Name: simulation_names simulation_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_names
    ADD CONSTRAINT simulation_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: simulation_names simulation_names_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_names
    ADD CONSTRAINT simulation_names_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulations(id) ON DELETE CASCADE;


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
-- Name: standard_groups standard_groups_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_groups
    ADD CONSTRAINT standard_groups_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.calls(id);


--
-- Name: standards standards_standard_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standards
    ADD CONSTRAINT standards_standard_group_id_fkey FOREIGN KEY (standard_group_id) REFERENCES public.standard_groups(id);


--
-- Name: strengths strengths_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strengths
    ADD CONSTRAINT strengths_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: strengths strengths_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strengths
    ADD CONSTRAINT strengths_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.calls(id);


--
-- Name: template_array_items template_array_items_item_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_array_items
    ADD CONSTRAINT template_array_items_item_template_id_fkey FOREIGN KEY (item_template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: template_array_items template_array_items_schema_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_array_items
    ADD CONSTRAINT template_array_items_schema_field_id_fkey FOREIGN KEY (schema_field_id) REFERENCES public.schema_fields(id) ON DELETE CASCADE;


--
-- Name: template_array_items template_array_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_array_items
    ADD CONSTRAINT template_array_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: template_values template_values_schema_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_values
    ADD CONSTRAINT template_values_schema_field_id_fkey FOREIGN KEY (schema_field_id) REFERENCES public.schema_fields(id) ON DELETE CASCADE;


--
-- Name: template_values template_values_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_values
    ADD CONSTRAINT template_values_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: templates templates_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.calls(id);


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
    ADD CONSTRAINT tool_call_arguments_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.calls(id);


--
-- Name: tool_call_results tool_call_results_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_call_results
    ADD CONSTRAINT tool_call_results_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.calls(id);


--
-- Name: tool_call_runs tool_call_runs_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_call_runs
    ADD CONSTRAINT tool_call_runs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id);


--
-- Name: tool_call_runs tool_call_runs_tool_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_call_runs
    ADD CONSTRAINT tool_call_runs_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.calls(id);


--
-- Name: tool_schemas tool_schemas_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_schemas
    ADD CONSTRAINT tool_schemas_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.schemas(id) ON DELETE CASCADE;


--
-- Name: tool_schemas tool_schemas_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_schemas
    ADD CONSTRAINT tool_schemas_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE;


--
-- Name: tools tools_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tools
    ADD CONSTRAINT tools_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id);


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
    ADD CONSTRAINT videos_tool_call_id_fkey FOREIGN KEY (tool_call_id) REFERENCES public.calls(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 5lRSv44tAqbi3yC5hHSaDD3kRv0Kp5pKVItNRGQx1Hc9smrKo84aSsl0jzWM8eR

