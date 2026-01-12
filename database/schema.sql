--
-- PostgreSQL database dump
--

\restrict J2tdwZHJoMvWsIZNNkLol9bRMKhZzdvFWjipUP9lzEPnkaoihDyZThqe4J0ipqM

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
    'auth',
    'key',
    'setting',
    'profile',
    'tool',
    'provider'
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
    'image',
    'document',
    'call'
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
    'analyses',
    'auths',
    'cohorts',
    'colors',
    'content',
    'conversations',
    'debug_info',
    'departments',
    'descriptions',
    'documents',
    'endpoints',
    'evals',
    'examples',
    'feedbacks',
    'fields',
    'flags',
    'hints',
    'html',
    'icons',
    'images',
    'improvements',
    'instructions',
    'items',
    'keys',
    'models',
    'names',
    'objectives',
    'options',
    'parameters',
    'personas',
    'points',
    'problem_statements',
    'profiles',
    'prompts',
    'protocols',
    'questions',
    'responses',
    'rubrics',
    'scenarios',
    'schemas',
    'schema_field_items',
    'schema_fields',
    'settings',
    'simulations',
    'slugs',
    'standard_groups',
    'strengths',
    'template_array_items',
    'template_values',
    'templates',
    'thresholds',
    'times',
    'videos',
    'texts',
    'audios',
    'providers'
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
    'active',
    'mcp'
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
-- Name: build_arguments_raw_for_resource(public.resources, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.build_arguments_raw_for_resource(p_resource_type public.resources, p_tool_id uuid, p_schema_id uuid, p_resource_data jsonb) RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_arg_key text;
    v_arg_value text;
    v_args_jsonb jsonb := '{}'::jsonb;
BEGIN
    -- For each schema field, extract variable names from template or use field name directly
    FOR v_arg_key, v_arg_value IN
        SELECT 
            CASE 
                -- If template is empty, use field name as argument name
                WHEN COALESCE(sf.template, '') = '' THEN sf.name
                -- If template has variables, extract first variable name (before . or |)
                -- Pattern: {{ variable }} or {{ variable.property }} or {{ variable|filter }}
                ELSE COALESCE(
                    (SELECT regexp_replace(
                        regexp_replace(sf.template, '.*\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)', '\1'),
                        '[\.\|].*', ''
                    )),
                    sf.name  -- Fallback to field name if extraction fails
                )
            END as arg_key,
            -- Look up value from resource data using schema field name
            p_resource_data->>sf.name as arg_value
        FROM schema_fields sf
        WHERE sf.schema_id = p_schema_id
        ORDER BY sf.position
    LOOP
        IF v_arg_value IS NOT NULL THEN
            v_args_jsonb := v_args_jsonb || jsonb_build_object(v_arg_key, v_arg_value);
        END IF;
    END LOOP;
    
    RETURN v_args_jsonb::text;
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
-- Name: agent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT agents_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT agents_updated_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT agents_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT agents_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT agents_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT agents_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
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
    prompt_id uuid NOT NULL,
    call_id uuid
);


--
-- Name: agent_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_id uuid NOT NULL,
    department_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: agent_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_descriptions (
    agent_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: agent_instructions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_instructions (
    agent_id uuid CONSTRAINT agent_developer_instructions_agent_id_not_null NOT NULL,
    instruction_id uuid CONSTRAINT agent_developer_instructions_developer_instruction_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT agent_developer_instructions_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT agent_developer_instructions_updated_at_not_null NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: agent_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_models (
    agent_id uuid NOT NULL,
    model_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: agent_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_names (
    agent_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: agent_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_prompts (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_id uuid NOT NULL,
    prompt_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    created_at timestamp with time zone DEFAULT now() CONSTRAINT agents_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT agents_updated_at_not_null1 NOT NULL,
    agent_id uuid DEFAULT uuidv7() CONSTRAINT agents_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT agents_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT agents_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT agents_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT agents_id_new_not_null NOT NULL
);


--
-- Name: analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analyses (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    content text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
-- Name: artifact_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artifact_resources (
    artifact public.artifacts NOT NULL,
    resource public.resources NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: audio_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audio_uploads (
    audio_id uuid NOT NULL,
    upload_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audios (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT auth_id_v7_not_null NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    group_id uuid NOT NULL
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
    auth_id uuid CONSTRAINT auth_items_new_auth_id_not_null NOT NULL,
    item_id uuid CONSTRAINT auth_items_new_item_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT auth_items_new_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT auth_items_new_updated_at_not_null NOT NULL
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
-- Name: auth_protocols; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_protocols (
    auth_id uuid NOT NULL,
    protocol_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_slugs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_slugs (
    auth_id uuid NOT NULL,
    slug_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auths (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT auth_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT auth_updated_at_not_null NOT NULL,
    auth_id uuid DEFAULT uuidv7() CONSTRAINT auth_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT auth_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT auth_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT auth_mcp_not_null NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT auths_id_new_not_null NOT NULL
);


--
-- Name: calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calls (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT tool_calls_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT tool_calls_updated_at_not_null NOT NULL,
    external_call_id text CONSTRAINT tool_calls_call_id_not_null NOT NULL,
    completed boolean DEFAULT false CONSTRAINT tool_calls_completed_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT calls_id_v7_not_null NOT NULL,
    tool_id uuid CONSTRAINT tool_calls_tool_id_not_null NOT NULL,
    template_id uuid NOT NULL,
    arguments_raw text DEFAULT ''::text NOT NULL
);


--
-- Name: chat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT chats_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT chats_updated_at_not_null NOT NULL,
    title text CONSTRAINT chats_title_not_null NOT NULL,
    completed boolean DEFAULT false CONSTRAINT chats_completed_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT chats_id_v7_not_null NOT NULL,
    scenario_id uuid
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
-- Name: cohort; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT cohorts_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT cohorts_updated_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT cohorts_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT cohorts_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT cohorts_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT cohorts_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: cohort_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cohort_id uuid NOT NULL,
    department_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: cohort_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort_descriptions (
    cohort_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: cohort_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort_names (
    cohort_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: cohort_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort_profiles (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cohort_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    simulation_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: cohorts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohorts (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT cohorts_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT cohorts_updated_at_not_null1 NOT NULL,
    cohort_id uuid DEFAULT uuidv7() CONSTRAINT cohorts_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT cohorts_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT cohorts_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT cohorts_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT cohorts_id_new_not_null NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: contents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contents (
    id uuid DEFAULT uuidv7() CONSTRAINT content_id_not_null NOT NULL,
    content text CONSTRAINT content_content_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT content_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT content_updated_at_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT content_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT content_generated_not_null NOT NULL,
    call_id uuid CONSTRAINT content_call_id_not_null NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    end_reason text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: debug_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.debug_info (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    content text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT debug_info_id_v7_not_null NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT departments_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT departments_updated_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT departments_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT departments_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT departments_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT departments_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
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
    created_at timestamp with time zone DEFAULT now() CONSTRAINT departments_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT departments_updated_at_not_null1 NOT NULL,
    department_id uuid DEFAULT uuidv7() CONSTRAINT departments_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT departments_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT departments_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT departments_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT departments_id_new_not_null NOT NULL
);


--
-- Name: descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.descriptions (
    id uuid DEFAULT uuidv7() NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT documents_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT documents_updated_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT documents_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT documents_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT documents_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT documents_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
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
-- Name: document_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    document_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: document_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_descriptions (
    document_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: document_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_fields (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    document_id uuid NOT NULL,
    field_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: document_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_names (
    document_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: document_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_schemas (
    document_id uuid NOT NULL,
    schema_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: document_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_templates (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    document_id uuid NOT NULL,
    template_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    created_at timestamp with time zone DEFAULT now() CONSTRAINT documents_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT documents_updated_at_not_null1 NOT NULL,
    document_id uuid DEFAULT uuidv7() CONSTRAINT documents_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT documents_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT documents_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT documents_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT documents_id_new_not_null NOT NULL
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
-- Name: draft_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_agents (
    draft_id uuid NOT NULL,
    agents_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_analyses (
    draft_id uuid NOT NULL,
    analyses_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_auth (
    draft_id uuid NOT NULL,
    auth_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_cohorts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_cohorts (
    draft_id uuid NOT NULL,
    cohorts_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_colors (
    draft_id uuid NOT NULL,
    colors_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_content (
    draft_id uuid NOT NULL,
    content_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_conversations (
    draft_id uuid NOT NULL,
    conversations_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_debug_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_debug_info (
    draft_id uuid NOT NULL,
    debug_info_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_departments (
    draft_id uuid NOT NULL,
    departments_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_descriptions (
    draft_id uuid NOT NULL,
    descriptions_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_documents (
    draft_id uuid NOT NULL,
    documents_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_endpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_endpoints (
    draft_id uuid NOT NULL,
    endpoints_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_evals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_evals (
    draft_id uuid NOT NULL,
    evals_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_examples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_examples (
    draft_id uuid NOT NULL,
    examples_id uuid NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_feedbacks (
    draft_id uuid NOT NULL,
    feedbacks_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_fields (
    draft_id uuid NOT NULL,
    fields_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_flags (
    draft_id uuid NOT NULL,
    flags_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_hints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_hints (
    draft_id uuid NOT NULL,
    hints_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_html; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_html (
    draft_id uuid NOT NULL,
    html_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_icons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_icons (
    draft_id uuid NOT NULL,
    icons_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_images (
    draft_id uuid NOT NULL,
    images_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_improvements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_improvements (
    draft_id uuid NOT NULL,
    improvements_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_instructions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_instructions (
    draft_id uuid NOT NULL,
    instructions_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_items (
    draft_id uuid NOT NULL,
    items_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_keys (
    draft_id uuid NOT NULL,
    keys_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_models (
    draft_id uuid NOT NULL,
    models_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_names (
    draft_id uuid NOT NULL,
    names_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_objectives (
    draft_id uuid NOT NULL,
    objectives_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_options (
    draft_id uuid NOT NULL,
    options_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_parameters (
    draft_id uuid NOT NULL,
    parameters_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_personas (
    draft_id uuid NOT NULL,
    personas_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_points (
    draft_id uuid NOT NULL,
    points_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_problem_statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_problem_statements (
    draft_id uuid NOT NULL,
    problem_statements_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_profiles (
    draft_id uuid NOT NULL,
    profiles_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_prompts (
    draft_id uuid NOT NULL,
    prompts_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_protocols; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_protocols (
    draft_id uuid NOT NULL,
    protocols_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_providers (
    draft_id uuid NOT NULL,
    providers_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_questions (
    draft_id uuid NOT NULL,
    questions_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_responses (
    draft_id uuid NOT NULL,
    responses_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_rubrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_rubrics (
    draft_id uuid NOT NULL,
    rubrics_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_scenarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_scenarios (
    draft_id uuid NOT NULL,
    scenarios_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_schema_field_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_schema_field_items (
    draft_id uuid NOT NULL,
    schema_field_items_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_schema_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_schema_fields (
    draft_id uuid NOT NULL,
    schema_fields_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_schemas (
    draft_id uuid NOT NULL,
    schemas_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_settings (
    draft_id uuid NOT NULL,
    settings_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_simulations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_simulations (
    draft_id uuid NOT NULL,
    simulations_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_slugs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_slugs (
    draft_id uuid NOT NULL,
    slugs_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_standard_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_standard_groups (
    draft_id uuid NOT NULL,
    standard_groups_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_strengths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_strengths (
    draft_id uuid NOT NULL,
    strengths_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_template_array_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_template_array_items (
    draft_id uuid NOT NULL,
    template_array_items_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_template_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_template_values (
    draft_id uuid NOT NULL,
    template_values_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_templates (
    draft_id uuid NOT NULL,
    templates_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_thresholds (
    draft_id uuid NOT NULL,
    thresholds_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_times (
    draft_id uuid NOT NULL,
    times_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: draft_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_videos (
    draft_id uuid NOT NULL,
    videos_id uuid NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    artifact public.artifacts NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: endpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.endpoints (
    id uuid DEFAULT uuidv7() NOT NULL,
    base_url text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    CONSTRAINT endpoints_base_url_check CHECK ((base_url <> ''::text))
);


--
-- Name: eval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT evals_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT evals_updated_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT evals_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT evals_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT evals_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT evals_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: eval_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_agents (
    eval_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    eval_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: eval_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_descriptions (
    eval_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    created_at timestamp with time zone DEFAULT now() CONSTRAINT evals_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT evals_updated_at_not_null1 NOT NULL,
    eval_id uuid DEFAULT uuidv7() CONSTRAINT evals_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT evals_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT evals_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT evals_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT evals_id_new_not_null NOT NULL
);


--
-- Name: examples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.examples (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    example text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT examples_id_v7_not_null NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedbacks (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    total integer NOT NULL,
    feedback text DEFAULT 'No feedback provided'::text NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT feedbacks_id_v7_not_null NOT NULL,
    standard_id uuid,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: field; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT fields_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT fields_updated_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT fields_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT fields_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT fields_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT fields_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
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
    field_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: field_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_descriptions (
    field_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: field_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_names (
    field_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fields (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT fields_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT fields_updated_at_not_null1 NOT NULL,
    field_id uuid DEFAULT uuidv7() CONSTRAINT fields_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT fields_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT fields_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT fields_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT fields_id_new_not_null NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: grade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT grades_created_at_not_null NOT NULL,
    description text DEFAULT 'No description provided'::text CONSTRAINT grades_description_not_null NOT NULL,
    passed boolean CONSTRAINT grades_passed_not_null NOT NULL,
    score integer CONSTRAINT grades_score_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT grades_id_v7_not_null NOT NULL,
    run_id uuid,
    rubric_grade_agent_id uuid
);


--
-- Name: grade_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_analyses (
    grade_id uuid NOT NULL,
    analysis_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: grade_feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_feedbacks (
    grade_id uuid NOT NULL,
    feedback_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: grade_strengths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_strengths (
    grade_id uuid NOT NULL,
    strength_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: grade_times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_times (
    grade_id uuid NOT NULL,
    time_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    completed boolean DEFAULT false NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    description text NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: improvements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.improvements (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text DEFAULT 'No description provided'::text NOT NULL,
    message_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT developer_instructions_updated_at_not_null NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.items (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    encrypted boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: key; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.key (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT keys_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT keys_updated_at_not_null NOT NULL,
    key text CONSTRAINT keys_key_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT keys_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT keys_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT keys_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT keys_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: key_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.key_descriptions (
    key_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: key_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.key_names (
    key_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.keys (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT keys_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT keys_updated_at_not_null1 NOT NULL,
    key text CONSTRAINT keys_key_not_null1 NOT NULL,
    key_id uuid DEFAULT uuidv7() CONSTRAINT keys_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT keys_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT keys_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT keys_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT keys_id_new_not_null NOT NULL
);


--
-- Name: message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT messages_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT messages_updated_at_not_null NOT NULL,
    content text,
    role public.message_role CONSTRAINT messages_role_not_null NOT NULL,
    completed boolean DEFAULT false CONSTRAINT messages_completed_not_null NOT NULL,
    audio boolean DEFAULT false CONSTRAINT messages_audio_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT messages_id_v7_not_null NOT NULL
);


--
-- Name: message_audios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_audios (
    message_id uuid NOT NULL,
    audio_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: message_calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_calls (
    message_id uuid NOT NULL,
    call_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: message_contents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_contents (
    message_id uuid CONSTRAINT message_content_message_id_not_null NOT NULL,
    content_id uuid CONSTRAINT message_content_content_id_not_null NOT NULL,
    idx integer CONSTRAINT message_content_idx_not_null1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT message_content_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT message_content_updated_at_not_null1 NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    CONSTRAINT message_contents_idx_check1 CHECK ((idx >= 0))
);


--
-- Name: message_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_documents (
    message_id uuid NOT NULL,
    document_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    CONSTRAINT message_hints_idx_check CHECK ((idx >= 0))
);


--
-- Name: message_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_images (
    message_id uuid NOT NULL,
    image_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: message_personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_personas (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    message_id uuid NOT NULL,
    persona_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
-- Name: message_texts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_texts (
    message_id uuid NOT NULL,
    text_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
-- Name: message_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_videos (
    message_id uuid NOT NULL,
    video_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: model; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT models_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT models_updated_at_not_null NOT NULL,
    value text CONSTRAINT models_value_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT models_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT models_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT models_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT models_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: model_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    model_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: model_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_descriptions (
    model_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: model_endpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_endpoints (
    model_id uuid CONSTRAINT model_endpoints_new_model_id_not_null NOT NULL,
    endpoint_id uuid CONSTRAINT model_endpoints_new_endpoint_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT model_endpoints_new_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT model_endpoints_new_updated_at_not_null NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: model_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_keys (
    model_id uuid NOT NULL,
    key_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    providers_id uuid NOT NULL,
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
    created_at timestamp with time zone DEFAULT now() CONSTRAINT models_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT models_updated_at_not_null1 NOT NULL,
    value text CONSTRAINT models_value_not_null1 NOT NULL,
    model_id uuid DEFAULT uuidv7() CONSTRAINT models_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT models_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT models_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT models_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT models_id_new_not_null NOT NULL
);


--
-- Name: names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.names (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    is_correct boolean DEFAULT false NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: parameter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameter (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT parameters_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT parameters_updated_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT parameters_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT parameters_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT parameters_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT parameters_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: parameter_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameter_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    parameter_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: parameter_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameter_descriptions (
    parameter_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: parameter_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameter_fields (
    parameter_id uuid NOT NULL,
    field_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: parameter_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameter_names (
    parameter_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameters (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT parameters_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT parameters_updated_at_not_null1 NOT NULL,
    parameter_id uuid DEFAULT uuidv7() CONSTRAINT parameters_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT parameters_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT parameters_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT parameters_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT parameters_id_new_not_null NOT NULL
);


--
-- Name: persona; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT personas_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT personas_updated_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT personas_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT personas_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT personas_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT personas_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: persona_colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_colors (
    persona_id uuid NOT NULL,
    color_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: persona_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_departments (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid NOT NULL,
    persona_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: persona_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_descriptions (
    persona_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: persona_examples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_examples (
    idx integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    example_id uuid NOT NULL,
    persona_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: persona_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_fields (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    field_id uuid NOT NULL,
    persona_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: persona_icons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_icons (
    persona_id uuid NOT NULL,
    icon_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: persona_instructions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_instructions (
    persona_id uuid NOT NULL,
    instruction_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: persona_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_names (
    persona_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personas (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT personas_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT personas_updated_at_not_null1 NOT NULL,
    persona_id uuid DEFAULT uuidv7() CONSTRAINT personas_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT personas_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT personas_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT personas_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT personas_id_new_not_null NOT NULL
);


--
-- Name: points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.points (
    id uuid DEFAULT uuidv7() NOT NULL,
    value integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: problems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.problems (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT feedback_created_at_not_null NOT NULL,
    type public.feedback_type CONSTRAINT feedback_type_not_null NOT NULL,
    message text DEFAULT 'No message provided'::text CONSTRAINT feedback_message_not_null NOT NULL,
    resolved boolean DEFAULT false CONSTRAINT feedback_resolved_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT feedback_id_v7_not_null NOT NULL,
    profile_id uuid
);


--
-- Name: profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile (
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT profiles_updated_at_not_null NOT NULL,
    last_login timestamp with time zone DEFAULT now() CONSTRAINT profiles_last_login_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT profiles_created_at_not_null NOT NULL,
    role public.profile_role DEFAULT 'guest'::public.profile_role CONSTRAINT profiles_role_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT profiles_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT profiles_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT profiles_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT profiles_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
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
    profile_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: profile_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_names (
    profile_id uuid NOT NULL,
    name_id uuid NOT NULL,
    type public.type_profile_names NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT profiles_updated_at_not_null1 NOT NULL,
    last_login timestamp with time zone DEFAULT now() CONSTRAINT profiles_last_login_not_null1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT profiles_created_at_not_null1 NOT NULL,
    role public.profile_role DEFAULT 'guest'::public.profile_role CONSTRAINT profiles_role_not_null1 NOT NULL,
    profile_id uuid DEFAULT uuidv7() CONSTRAINT profiles_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT profiles_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT profiles_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT profiles_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT profiles_id_new_not_null NOT NULL
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
    id uuid DEFAULT uuidv7() CONSTRAINT prompts_id_v7_not_null NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: protocols; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.protocols (
    id uuid DEFAULT uuidv7() NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: provider; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: provider_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_descriptions (
    provider_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    id uuid DEFAULT uuidv7() NOT NULL,
    provider_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL
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
    "time" integer NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: resource_modalities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resource_modalities (
    resource public.resources NOT NULL,
    modality public.modality_type NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    question_id uuid,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: rubric; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT rubrics_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT rubrics_updated_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT rubrics_id_v7_not_null NOT NULL,
    rubric_domain_id uuid,
    active boolean DEFAULT true CONSTRAINT rubrics_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT rubrics_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT rubrics_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
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
    rubric_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: rubric_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_descriptions (
    rubric_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: rubric_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_points (
    rubric_id uuid NOT NULL,
    point_id uuid NOT NULL,
    type public.type_rubric_points NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: rubrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubrics (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT rubrics_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT rubrics_updated_at_not_null1 NOT NULL,
    rubric_id uuid DEFAULT uuidv7() CONSTRAINT rubrics_id_v7_not_null NOT NULL,
    rubric_domain_id uuid,
    active boolean DEFAULT true CONSTRAINT rubrics_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT rubrics_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT rubrics_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT rubrics_id_new_not_null NOT NULL
);


--
-- Name: run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.run (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT runs_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT runs_updated_at_not_null NOT NULL,
    input_tokens integer DEFAULT 0 CONSTRAINT runs_input_tokens_not_null NOT NULL,
    output_tokens integer DEFAULT 0 CONSTRAINT runs_output_tokens_not_null NOT NULL,
    cached_input_tokens integer DEFAULT 0 CONSTRAINT runs_cached_input_tokens_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT runs_id_v7_not_null NOT NULL,
    agent_id uuid,
    key_id uuid,
    generated boolean DEFAULT false CONSTRAINT runs_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT runs_mcp_not_null NOT NULL
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
-- Name: scenario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT scenarios_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT scenarios_updated_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT scenarios_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT scenarios_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT scenarios_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT scenarios_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
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
    scenario_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: scenario_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_descriptions (
    scenario_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    scenario_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    scenario_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    scenario_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: scenario_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_names (
    scenario_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: scenario_objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_objectives (
    idx integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    objective_id uuid NOT NULL,
    scenario_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: scenario_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_options (
    scenario_id uuid NOT NULL,
    option_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    scenario_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    scenario_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: scenario_problem_statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_problem_statements (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    problem_statement_id uuid NOT NULL,
    scenario_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: scenario_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_questions (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    question_id uuid NOT NULL,
    scenario_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: scenario_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_templates (
    scenario_id uuid NOT NULL,
    template_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    video_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: scenarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenarios (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT scenarios_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT scenarios_updated_at_not_null1 NOT NULL,
    scenario_id uuid DEFAULT uuidv7() CONSTRAINT scenarios_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT scenarios_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT scenarios_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT scenarios_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT scenarios_id_new_not_null NOT NULL
);


--
-- Name: schema_field_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_field_items (
    schema_field_id uuid NOT NULL,
    item_schema_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    default_value text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
-- Name: setting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT settings_created_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT settings_id_v7_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT settings_updated_at_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT settings_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT settings_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT settings_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
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
    settings_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: setting_colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_colors (
    setting_id uuid NOT NULL,
    color_id uuid NOT NULL,
    type public.type_setting_colors NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: setting_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_descriptions (
    setting_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: setting_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_names (
    setting_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: setting_provider_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_provider_keys (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    key_id uuid NOT NULL,
    settings_id uuid NOT NULL,
    providers_id uuid NOT NULL
);


--
-- Name: setting_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_providers (
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    settings_id uuid NOT NULL,
    providers_id uuid NOT NULL
);


--
-- Name: setting_thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_thresholds (
    setting_id uuid NOT NULL,
    threshold_id uuid NOT NULL,
    type public.type_setting_thresholds NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT settings_created_at_not_null1 NOT NULL,
    setting_id uuid DEFAULT uuidv7() CONSTRAINT settings_id_v7_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT settings_updated_at_not_null1 NOT NULL,
    active boolean DEFAULT true CONSTRAINT settings_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT settings_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT settings_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT settings_id_new_not_null NOT NULL
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
-- Name: simulation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT simulations_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT simulations_updated_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() CONSTRAINT simulations_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT simulations_active_not_null NOT NULL,
    generated boolean DEFAULT false CONSTRAINT simulations_generated_not_null NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT simulations_mcp_not_null NOT NULL,
    group_id uuid NOT NULL
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
    simulation_id uuid NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: simulation_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation_descriptions (
    simulation_id uuid NOT NULL,
    description_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
);


--
-- Name: simulation_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation_names (
    simulation_id uuid NOT NULL,
    name_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    show_images boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
    call_id uuid
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
    created_at timestamp with time zone DEFAULT now() CONSTRAINT simulations_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT simulations_updated_at_not_null1 NOT NULL,
    simulation_id uuid DEFAULT uuidv7() CONSTRAINT simulations_id_v7_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT simulations_active_not_null1 NOT NULL,
    generated boolean DEFAULT false CONSTRAINT simulations_generated_not_null1 NOT NULL,
    mcp boolean DEFAULT false CONSTRAINT simulations_mcp_not_null1 NOT NULL,
    call_id uuid,
    id uuid DEFAULT uuidv7() CONSTRAINT simulations_id_new_not_null NOT NULL
);


--
-- Name: slugs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slugs (
    id uuid DEFAULT uuidv7() NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    message_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
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
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
-- Name: texts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.texts (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    content text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thresholds (
    id uuid DEFAULT uuidv7() NOT NULL,
    value integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.times (
    id uuid DEFAULT uuidv7() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    time_taken integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: tool; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool (
    id uuid DEFAULT uuidv7() CONSTRAINT tools_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT tools_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT tools_updated_at_not_null NOT NULL,
    name text CONSTRAINT tools_name_not_null NOT NULL,
    description text CONSTRAINT tools_description_not_null NOT NULL,
    active boolean DEFAULT true CONSTRAINT tools_active_not_null NOT NULL
);


--
-- Name: tool_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_domains (
    tool_id uuid NOT NULL,
    domain_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tool_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_schemas (
    tool_id uuid NOT NULL,
    schema_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
);


--
-- Name: tool_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_templates (
    tool_id uuid NOT NULL,
    template_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    mcp boolean DEFAULT false NOT NULL
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
    description text NOT NULL,
    generated boolean DEFAULT false NOT NULL,
    call_id uuid NOT NULL,
    mcp boolean DEFAULT false NOT NULL,
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
-- Name: agent agent_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent
    ADD CONSTRAINT agent_group_id_unique UNIQUE (group_id);


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
-- Name: agent agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent
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
-- Name: artifact_resources artifact_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_resources
    ADD CONSTRAINT artifact_resources_pkey PRIMARY KEY (artifact, resource);


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
-- Name: audio_uploads audio_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_uploads
    ADD CONSTRAINT audio_uploads_pkey PRIMARY KEY (audio_id, upload_id);


--
-- Name: audios audios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audios
    ADD CONSTRAINT audios_pkey PRIMARY KEY (id);


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
-- Name: auth auth_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth
    ADD CONSTRAINT auth_group_id_unique UNIQUE (group_id);


--
-- Name: auth_items auth_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_items
    ADD CONSTRAINT auth_items_pkey PRIMARY KEY (auth_id, item_id);


--
-- Name: auth_names auth_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_names
    ADD CONSTRAINT auth_names_pkey PRIMARY KEY (auth_id, name_id);


--
-- Name: auth_protocols auth_protocols_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_protocols
    ADD CONSTRAINT auth_protocols_pkey PRIMARY KEY (auth_id, protocol_id);


--
-- Name: auth_slugs auth_slugs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_slugs
    ADD CONSTRAINT auth_slugs_pkey PRIMARY KEY (auth_id, slug_id);


--
-- Name: auth auths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth
    ADD CONSTRAINT auths_pkey PRIMARY KEY (id);


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
-- Name: chat chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat
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
-- Name: cohort cohort_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort
    ADD CONSTRAINT cohort_group_id_unique UNIQUE (group_id);


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
-- Name: cohort cohorts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort
    ADD CONSTRAINT cohorts_pkey PRIMARY KEY (id);


--
-- Name: colors colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_pkey PRIMARY KEY (id);


--
-- Name: contents contents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_pkey PRIMARY KEY (id);


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
-- Name: department department_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_group_id_unique UNIQUE (group_id);


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
-- Name: department departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
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
-- Name: document document_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_group_id_unique UNIQUE (group_id);


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
-- Name: document documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
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
-- Name: draft_agents draft_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_agents
    ADD CONSTRAINT draft_agents_pkey PRIMARY KEY (draft_id, agents_id);


--
-- Name: draft_analyses draft_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_analyses
    ADD CONSTRAINT draft_analyses_pkey PRIMARY KEY (draft_id, analyses_id);


--
-- Name: draft_auth draft_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_auth
    ADD CONSTRAINT draft_auth_pkey PRIMARY KEY (draft_id, auth_id);


--
-- Name: draft_cohorts draft_cohorts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_cohorts
    ADD CONSTRAINT draft_cohorts_pkey PRIMARY KEY (draft_id, cohorts_id);


--
-- Name: draft_colors draft_colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_colors
    ADD CONSTRAINT draft_colors_pkey PRIMARY KEY (draft_id, colors_id);


--
-- Name: draft_content draft_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_content
    ADD CONSTRAINT draft_content_pkey PRIMARY KEY (draft_id, content_id);


--
-- Name: draft_conversations draft_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_conversations
    ADD CONSTRAINT draft_conversations_pkey PRIMARY KEY (draft_id, conversations_id);


--
-- Name: draft_debug_info draft_debug_info_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_debug_info
    ADD CONSTRAINT draft_debug_info_pkey PRIMARY KEY (draft_id, debug_info_id);


--
-- Name: draft_departments draft_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_departments
    ADD CONSTRAINT draft_departments_pkey PRIMARY KEY (draft_id, departments_id);


--
-- Name: draft_descriptions draft_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_descriptions
    ADD CONSTRAINT draft_descriptions_pkey PRIMARY KEY (draft_id, descriptions_id);


--
-- Name: draft_documents draft_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_documents
    ADD CONSTRAINT draft_documents_pkey PRIMARY KEY (draft_id, documents_id);


--
-- Name: draft_endpoints draft_endpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_endpoints
    ADD CONSTRAINT draft_endpoints_pkey PRIMARY KEY (draft_id, endpoints_id);


--
-- Name: draft_evals draft_evals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_evals
    ADD CONSTRAINT draft_evals_pkey PRIMARY KEY (draft_id, evals_id);


--
-- Name: draft_examples draft_examples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_examples
    ADD CONSTRAINT draft_examples_pkey PRIMARY KEY (draft_id, examples_id);


--
-- Name: draft_feedbacks draft_feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_feedbacks
    ADD CONSTRAINT draft_feedbacks_pkey PRIMARY KEY (draft_id, feedbacks_id);


--
-- Name: draft_fields draft_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_fields
    ADD CONSTRAINT draft_fields_pkey PRIMARY KEY (draft_id, fields_id);


--
-- Name: draft_flags draft_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_flags
    ADD CONSTRAINT draft_flags_pkey PRIMARY KEY (draft_id, flags_id);


--
-- Name: draft_hints draft_hints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_hints
    ADD CONSTRAINT draft_hints_pkey PRIMARY KEY (draft_id, hints_id);


--
-- Name: draft_html draft_html_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_html
    ADD CONSTRAINT draft_html_pkey PRIMARY KEY (draft_id, html_id);


--
-- Name: draft_icons draft_icons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_icons
    ADD CONSTRAINT draft_icons_pkey PRIMARY KEY (draft_id, icons_id);


--
-- Name: draft_images draft_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_images
    ADD CONSTRAINT draft_images_pkey PRIMARY KEY (draft_id, images_id);


--
-- Name: draft_improvements draft_improvements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_improvements
    ADD CONSTRAINT draft_improvements_pkey PRIMARY KEY (draft_id, improvements_id);


--
-- Name: draft_instructions draft_instructions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_instructions
    ADD CONSTRAINT draft_instructions_pkey PRIMARY KEY (draft_id, instructions_id);


--
-- Name: draft_items draft_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_items
    ADD CONSTRAINT draft_items_pkey PRIMARY KEY (draft_id, items_id);


--
-- Name: draft_keys draft_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_keys
    ADD CONSTRAINT draft_keys_pkey PRIMARY KEY (draft_id, keys_id);


--
-- Name: draft_models draft_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_models
    ADD CONSTRAINT draft_models_pkey PRIMARY KEY (draft_id, models_id);


--
-- Name: draft_names draft_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_names
    ADD CONSTRAINT draft_names_pkey PRIMARY KEY (draft_id, names_id);


--
-- Name: draft_objectives draft_objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_objectives
    ADD CONSTRAINT draft_objectives_pkey PRIMARY KEY (draft_id, objectives_id);


--
-- Name: draft_options draft_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_options
    ADD CONSTRAINT draft_options_pkey PRIMARY KEY (draft_id, options_id);


--
-- Name: draft_parameters draft_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_parameters
    ADD CONSTRAINT draft_parameters_pkey PRIMARY KEY (draft_id, parameters_id);


--
-- Name: draft_personas draft_personas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_personas
    ADD CONSTRAINT draft_personas_pkey PRIMARY KEY (draft_id, personas_id);


--
-- Name: draft_points draft_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_points
    ADD CONSTRAINT draft_points_pkey PRIMARY KEY (draft_id, points_id);


--
-- Name: draft_problem_statements draft_problem_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_problem_statements
    ADD CONSTRAINT draft_problem_statements_pkey PRIMARY KEY (draft_id, problem_statements_id);


--
-- Name: draft_profiles draft_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_profiles
    ADD CONSTRAINT draft_profiles_pkey PRIMARY KEY (draft_id, profiles_id);


--
-- Name: draft_prompts draft_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_prompts
    ADD CONSTRAINT draft_prompts_pkey PRIMARY KEY (draft_id, prompts_id);


--
-- Name: draft_protocols draft_protocols_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_protocols
    ADD CONSTRAINT draft_protocols_pkey PRIMARY KEY (draft_id, protocols_id);


--
-- Name: draft_providers draft_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_providers
    ADD CONSTRAINT draft_providers_pkey PRIMARY KEY (draft_id, providers_id, version);


--
-- Name: draft_questions draft_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_questions
    ADD CONSTRAINT draft_questions_pkey PRIMARY KEY (draft_id, questions_id);


--
-- Name: draft_responses draft_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_responses
    ADD CONSTRAINT draft_responses_pkey PRIMARY KEY (draft_id, responses_id);


--
-- Name: draft_rubrics draft_rubrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_rubrics
    ADD CONSTRAINT draft_rubrics_pkey PRIMARY KEY (draft_id, rubrics_id);


--
-- Name: draft_scenarios draft_scenarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_scenarios
    ADD CONSTRAINT draft_scenarios_pkey PRIMARY KEY (draft_id, scenarios_id);


--
-- Name: draft_schema_field_items draft_schema_field_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_schema_field_items
    ADD CONSTRAINT draft_schema_field_items_pkey PRIMARY KEY (draft_id, schema_field_items_id);


--
-- Name: draft_schema_fields draft_schema_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_schema_fields
    ADD CONSTRAINT draft_schema_fields_pkey PRIMARY KEY (draft_id, schema_fields_id);


--
-- Name: draft_schemas draft_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_schemas
    ADD CONSTRAINT draft_schemas_pkey PRIMARY KEY (draft_id, schemas_id);


--
-- Name: draft_settings draft_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_settings
    ADD CONSTRAINT draft_settings_pkey PRIMARY KEY (draft_id, settings_id);


--
-- Name: draft_simulations draft_simulations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_simulations
    ADD CONSTRAINT draft_simulations_pkey PRIMARY KEY (draft_id, simulations_id);


--
-- Name: draft_slugs draft_slugs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_slugs
    ADD CONSTRAINT draft_slugs_pkey PRIMARY KEY (draft_id, slugs_id);


--
-- Name: draft_standard_groups draft_standard_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_standard_groups
    ADD CONSTRAINT draft_standard_groups_pkey PRIMARY KEY (draft_id, standard_groups_id);


--
-- Name: draft_strengths draft_strengths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_strengths
    ADD CONSTRAINT draft_strengths_pkey PRIMARY KEY (draft_id, strengths_id);


--
-- Name: draft_template_array_items draft_template_array_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_template_array_items
    ADD CONSTRAINT draft_template_array_items_pkey PRIMARY KEY (draft_id, template_array_items_id);


--
-- Name: draft_template_values draft_template_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_template_values
    ADD CONSTRAINT draft_template_values_pkey PRIMARY KEY (draft_id, template_values_id);


--
-- Name: draft_templates draft_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_templates
    ADD CONSTRAINT draft_templates_pkey PRIMARY KEY (draft_id, templates_id);


--
-- Name: draft_thresholds draft_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_thresholds
    ADD CONSTRAINT draft_thresholds_pkey PRIMARY KEY (draft_id, thresholds_id);


--
-- Name: draft_times draft_times_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_times
    ADD CONSTRAINT draft_times_pkey PRIMARY KEY (draft_id, times_id);


--
-- Name: draft_videos draft_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_videos
    ADD CONSTRAINT draft_videos_pkey PRIMARY KEY (draft_id, videos_id);


--
-- Name: drafts drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_pkey PRIMARY KEY (id);


--
-- Name: endpoints endpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endpoints
    ADD CONSTRAINT endpoints_pkey PRIMARY KEY (id);


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
-- Name: eval eval_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval
    ADD CONSTRAINT eval_group_id_unique UNIQUE (group_id);


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
-- Name: eval evals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval
    ADD CONSTRAINT evals_pkey PRIMARY KEY (id);


--
-- Name: examples examples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examples
    ADD CONSTRAINT examples_pkey PRIMARY KEY (id);


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
-- Name: field field_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field
    ADD CONSTRAINT field_group_id_unique UNIQUE (group_id);


--
-- Name: field_names field_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_names
    ADD CONSTRAINT field_names_pkey PRIMARY KEY (field_id, name_id);


--
-- Name: field fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field
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
-- Name: grade grades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade
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
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


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
-- Name: key key_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key
    ADD CONSTRAINT key_group_id_unique UNIQUE (group_id);


--
-- Name: key_names key_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_names
    ADD CONSTRAINT key_names_pkey PRIMARY KEY (key_id, name_id);


--
-- Name: key keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key
    ADD CONSTRAINT keys_pkey PRIMARY KEY (id);


--
-- Name: message_audios message_audios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_audios
    ADD CONSTRAINT message_audios_pkey PRIMARY KEY (message_id, audio_id);


--
-- Name: message_calls message_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_calls
    ADD CONSTRAINT message_calls_pkey PRIMARY KEY (message_id, call_id);


--
-- Name: message_contents message_contents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_contents
    ADD CONSTRAINT message_contents_pkey PRIMARY KEY (message_id, content_id);


--
-- Name: message_documents message_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_documents
    ADD CONSTRAINT message_documents_pkey PRIMARY KEY (message_id, document_id);


--
-- Name: message_hints message_hints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_hints
    ADD CONSTRAINT message_hints_pkey PRIMARY KEY (message_id, hint_id);


--
-- Name: message_images message_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_images
    ADD CONSTRAINT message_images_pkey PRIMARY KEY (message_id, image_id);


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
-- Name: message_texts message_texts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_texts
    ADD CONSTRAINT message_texts_pkey PRIMARY KEY (message_id, text_id);


--
-- Name: message_tree message_tree_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_tree
    ADD CONSTRAINT message_tree_pkey PRIMARY KEY (parent_id, child_id);


--
-- Name: message_videos message_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_videos
    ADD CONSTRAINT message_videos_pkey PRIMARY KEY (message_id, video_id);


--
-- Name: message messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
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
-- Name: model_endpoints model_endpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_endpoints
    ADD CONSTRAINT model_endpoints_pkey PRIMARY KEY (model_id, endpoint_id);


--
-- Name: model_flags model_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_flags
    ADD CONSTRAINT model_flags_pkey PRIMARY KEY (model_id, flag_id, type);


--
-- Name: model model_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT model_group_id_unique UNIQUE (group_id);


--
-- Name: model_keys model_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_keys
    ADD CONSTRAINT model_keys_pkey PRIMARY KEY (model_id, key_id);


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
    ADD CONSTRAINT model_providers_pkey PRIMARY KEY (model_id, providers_id);


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
-- Name: model models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT models_pkey PRIMARY KEY (id);


--
-- Name: models models_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.models
    ADD CONSTRAINT models_pkey1 PRIMARY KEY (id);


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
-- Name: parameter parameter_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter
    ADD CONSTRAINT parameter_group_id_unique UNIQUE (group_id);


--
-- Name: parameter_names parameter_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_names
    ADD CONSTRAINT parameter_names_pkey PRIMARY KEY (parameter_id, name_id);


--
-- Name: parameter parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter
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
-- Name: persona persona_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona
    ADD CONSTRAINT persona_group_id_unique UNIQUE (group_id);


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
-- Name: persona personas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona
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
-- Name: problems problems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_pkey PRIMARY KEY (id);


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
-- Name: profile profile_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile
    ADD CONSTRAINT profile_group_id_unique UNIQUE (group_id);


--
-- Name: profile_names profile_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_names
    ADD CONSTRAINT profile_names_pkey PRIMARY KEY (profile_id, name_id, type);


--
-- Name: profile profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile
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
-- Name: protocols protocols_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocols
    ADD CONSTRAINT protocols_pkey PRIMARY KEY (id);


--
-- Name: protocols protocols_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocols
    ADD CONSTRAINT protocols_value_key UNIQUE (value);


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
-- Name: provider provider_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider
    ADD CONSTRAINT provider_pkey PRIMARY KEY (id);


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
-- Name: resource_modalities resource_modalities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_modalities
    ADD CONSTRAINT resource_modalities_pkey PRIMARY KEY (resource, modality);


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
-- Name: rubric rubric_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric
    ADD CONSTRAINT rubric_group_id_unique UNIQUE (group_id);


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
-- Name: rubric rubrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric
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
-- Name: run runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run
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
-- Name: scenario scenario_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_group_id_unique UNIQUE (group_id);


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
-- Name: scenario scenarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenarios_pkey PRIMARY KEY (id);


--
-- Name: schema_field_items schema_field_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_field_items
    ADD CONSTRAINT schema_field_items_pkey PRIMARY KEY (id);


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
-- Name: setting setting_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting
    ADD CONSTRAINT setting_group_id_unique UNIQUE (group_id);


--
-- Name: setting_names setting_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_names
    ADD CONSTRAINT setting_names_pkey PRIMARY KEY (setting_id, name_id);


--
-- Name: setting_provider_keys setting_provider_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_provider_keys
    ADD CONSTRAINT setting_provider_keys_pkey PRIMARY KEY (settings_id, providers_id, key_id);


--
-- Name: setting_providers setting_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_providers
    ADD CONSTRAINT setting_providers_pkey PRIMARY KEY (settings_id, providers_id);


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
-- Name: setting settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting
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
-- Name: simulation simulation_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation
    ADD CONSTRAINT simulation_group_id_unique UNIQUE (group_id);


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
-- Name: simulation simulations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation
    ADD CONSTRAINT simulations_pkey PRIMARY KEY (id);


--
-- Name: slugs slugs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slugs
    ADD CONSTRAINT slugs_pkey PRIMARY KEY (id);


--
-- Name: slugs slugs_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slugs
    ADD CONSTRAINT slugs_value_key UNIQUE (value);


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
    ADD CONSTRAINT template_array_items_pkey PRIMARY KEY (id);


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
-- Name: texts texts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.texts
    ADD CONSTRAINT texts_pkey PRIMARY KEY (id);


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
-- Name: tool_domains tool_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_domains
    ADD CONSTRAINT tool_domains_pkey PRIMARY KEY (tool_id, domain_id);


--
-- Name: tool_schemas tool_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_schemas
    ADD CONSTRAINT tool_schemas_pkey PRIMARY KEY (tool_id, schema_id);


--
-- Name: tool_templates tool_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_templates
    ADD CONSTRAINT tool_templates_pkey PRIMARY KEY (tool_id, template_id);


--
-- Name: tool tools_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool
    ADD CONSTRAINT tools_name_key UNIQUE (name);


--
-- Name: tool tools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool
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
-- Name: agent_department_prompts_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_department_prompts_call_id_idx ON public.agent_department_prompts USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: agent_departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_departments_call_id_idx ON public.agent_departments USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: agent_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_departments_department_id_v7_idx ON public.agent_departments USING btree (department_id);


--
-- Name: agent_descriptions_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_descriptions_agent_id_idx ON public.agent_descriptions USING btree (agent_id);


--
-- Name: agent_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_descriptions_call_id_idx ON public.agent_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: agent_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_flags_call_id_idx ON public.agent_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: agent_flags_flag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_flags_flag_id_idx ON public.agent_flags USING btree (flag_id);


--
-- Name: agent_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_flags_type_idx ON public.agent_flags USING btree (type);


--
-- Name: agent_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_group_id_idx ON public.agent USING btree (group_id);


--
-- Name: agent_instructions_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_instructions_agent_id_idx ON public.agent_instructions USING btree (agent_id);


--
-- Name: agent_instructions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_instructions_call_id_idx ON public.agent_instructions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: agent_instructions_instruction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_instructions_instruction_id_idx ON public.agent_instructions USING btree (instruction_id);


--
-- Name: agent_models_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_models_agent_id_idx ON public.agent_models USING btree (agent_id);


--
-- Name: agent_models_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_models_call_id_idx ON public.agent_models USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: agent_models_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_models_model_id_idx ON public.agent_models USING btree (model_id);


--
-- Name: agent_names_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_names_agent_id_idx ON public.agent_names USING btree (agent_id);


--
-- Name: agent_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_names_call_id_idx ON public.agent_names USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: agent_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_names_name_id_idx ON public.agent_names USING btree (name_id);


--
-- Name: agent_prompts_agent_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_prompts_agent_id_v7_idx ON public.agent_prompts USING btree (agent_id);


--
-- Name: agent_prompts_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_prompts_call_id_idx ON public.agent_prompts USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: agents_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agents_call_id_idx ON public.agents USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: analyses_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analyses_call_id_idx ON public.analyses USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: analyses_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analyses_created_at_idx ON public.analyses USING btree (created_at);


--
-- Name: app_metrics_ts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_metrics_ts_idx ON public.app_metrics USING btree (ts);


--
-- Name: artifact_resources_artifact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX artifact_resources_artifact_idx ON public.artifact_resources USING btree (artifact);


--
-- Name: artifact_resources_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX artifact_resources_resource_idx ON public.artifact_resources USING btree (resource);


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
-- Name: audio_uploads_audio_id_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audio_uploads_audio_id_active_idx ON public.audio_uploads USING btree (audio_id, active);


--
-- Name: audio_uploads_audio_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audio_uploads_audio_id_idx ON public.audio_uploads USING btree (audio_id);


--
-- Name: audio_uploads_upload_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audio_uploads_upload_id_idx ON public.audio_uploads USING btree (upload_id);


--
-- Name: audios_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audios_active_idx ON public.audios USING btree (active);


--
-- Name: audios_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audios_call_id_idx ON public.audios USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: audios_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audios_created_at_idx ON public.audios USING btree (created_at);


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
-- Name: auth_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_group_id_idx ON public.auth USING btree (group_id);


--
-- Name: auth_items_auth_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_items_auth_id_idx ON public.auth_items USING btree (auth_id);


--
-- Name: auth_items_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_items_item_id_idx ON public.auth_items USING btree (item_id);


--
-- Name: auth_names_auth_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_names_auth_id_idx ON public.auth_names USING btree (auth_id);


--
-- Name: auth_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_names_name_id_idx ON public.auth_names USING btree (name_id);


--
-- Name: auth_protocols_auth_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_protocols_auth_id_idx ON public.auth_protocols USING btree (auth_id);


--
-- Name: auth_protocols_protocol_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_protocols_protocol_id_idx ON public.auth_protocols USING btree (protocol_id);


--
-- Name: auth_slugs_auth_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_slugs_auth_id_idx ON public.auth_slugs USING btree (auth_id);


--
-- Name: auth_slugs_slug_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_slugs_slug_id_idx ON public.auth_slugs USING btree (slug_id);


--
-- Name: auths_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auths_call_id_idx ON public.auths USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: calls_arguments_raw_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calls_arguments_raw_idx ON public.calls USING btree (arguments_raw) WHERE ((arguments_raw <> ''::text) AND (length(arguments_raw) < 2000));


--
-- Name: calls_external_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX calls_external_call_id_idx ON public.calls USING btree (external_call_id);


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

CREATE INDEX chats_id_created_idx ON public.chat USING btree (id, created_at);


--
-- Name: chats_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chats_scenario_id_v7_idx ON public.chat USING btree (scenario_id);


--
-- Name: cohort_departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_departments_call_id_idx ON public.cohort_departments USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: cohort_departments_cohort_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_departments_cohort_id_v7_idx ON public.cohort_departments USING btree (cohort_id);


--
-- Name: cohort_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_departments_department_id_v7_idx ON public.cohort_departments USING btree (department_id);


--
-- Name: cohort_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_descriptions_call_id_idx ON public.cohort_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: cohort_descriptions_cohort_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_descriptions_cohort_id_idx ON public.cohort_descriptions USING btree (cohort_id);


--
-- Name: cohort_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_descriptions_description_id_idx ON public.cohort_descriptions USING btree (description_id);


--
-- Name: cohort_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_flags_call_id_idx ON public.cohort_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: cohort_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_group_id_idx ON public.cohort USING btree (group_id);


--
-- Name: cohort_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_names_call_id_idx ON public.cohort_names USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: cohort_names_cohort_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_names_cohort_id_idx ON public.cohort_names USING btree (cohort_id);


--
-- Name: cohort_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_names_name_id_idx ON public.cohort_names USING btree (name_id);


--
-- Name: cohort_profiles_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_profiles_call_id_idx ON public.cohort_profiles USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: cohort_profiles_cohort_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_profiles_cohort_id_v7_idx ON public.cohort_profiles USING btree (cohort_id);


--
-- Name: cohort_profiles_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_profiles_profile_id_v7_idx ON public.cohort_profiles USING btree (profile_id);


--
-- Name: cohort_simulations_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_simulations_call_id_idx ON public.cohort_simulations USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: cohort_simulations_cohort_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_simulations_cohort_id_v7_idx ON public.cohort_simulations USING btree (cohort_id);


--
-- Name: cohort_simulations_simulation_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohort_simulations_simulation_id_v7_idx ON public.cohort_simulations USING btree (simulation_id);


--
-- Name: cohorts_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cohorts_call_id_idx ON public.cohorts USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: colors_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX colors_call_id_idx ON public.colors USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: colors_hex_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX colors_hex_code_idx ON public.colors USING btree (hex_code);


--
-- Name: contents_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contents_call_id_idx ON public.contents USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: contents_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contents_created_at_idx ON public.contents USING btree (created_at);


--
-- Name: conversations_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_call_id_idx ON public.conversations USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: conversations_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_created_at_idx ON public.conversations USING btree (created_at);


--
-- Name: debug_info_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX debug_info_call_id_idx ON public.debug_info USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: department_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_group_id_idx ON public.department USING btree (group_id);


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
-- Name: departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX departments_call_id_idx ON public.departments USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX descriptions_call_id_idx ON public.descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: document_agent_domains_agent_domain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_agent_domains_agent_domain_id_idx ON public.document_agent_domains USING btree (agent_domain_id);


--
-- Name: document_agent_domains_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_agent_domains_document_id_idx ON public.document_agent_domains USING btree (document_id);


--
-- Name: document_departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_departments_call_id_idx ON public.document_departments USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: document_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_departments_department_id_v7_idx ON public.document_departments USING btree (department_id);


--
-- Name: document_departments_document_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_departments_document_id_v7_idx ON public.document_departments USING btree (document_id);


--
-- Name: document_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_descriptions_call_id_idx ON public.document_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: document_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_descriptions_description_id_idx ON public.document_descriptions USING btree (description_id);


--
-- Name: document_descriptions_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_descriptions_document_id_idx ON public.document_descriptions USING btree (document_id);


--
-- Name: document_fields_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_fields_call_id_idx ON public.document_fields USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: document_fields_document_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_fields_document_id_v7_idx ON public.document_fields USING btree (document_id);


--
-- Name: document_fields_field_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_fields_field_id_v7_idx ON public.document_fields USING btree (field_id);


--
-- Name: document_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_flags_call_id_idx ON public.document_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: document_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_group_id_idx ON public.document USING btree (group_id);


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
-- Name: document_html_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_html_call_id_idx ON public.document_html USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: document_html_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_html_document_id_idx ON public.document_html USING btree (document_id);


--
-- Name: document_html_html_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_html_html_id_idx ON public.document_html USING btree (html_id);


--
-- Name: document_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_names_call_id_idx ON public.document_names USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: document_schemas_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_schemas_call_id_idx ON public.document_schemas USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: document_schemas_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_schemas_document_id_idx ON public.document_schemas USING btree (document_id);


--
-- Name: document_schemas_schema_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_schemas_schema_id_idx ON public.document_schemas USING btree (schema_id);


--
-- Name: document_templates_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_templates_call_id_idx ON public.document_templates USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: documents_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_call_id_idx ON public.documents USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: domain_artifacts_artifact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_artifacts_artifact_idx ON public.domain_artifacts USING btree (artifact);


--
-- Name: domain_artifacts_domain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_artifacts_domain_id_idx ON public.domain_artifacts USING btree (domain_id);


--
-- Name: draft_providers_draft_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX draft_providers_draft_id_idx ON public.draft_providers USING btree (draft_id);


--
-- Name: draft_providers_providers_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX draft_providers_providers_id_idx ON public.draft_providers USING btree (providers_id);


--
-- Name: endpoints_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX endpoints_active_idx ON public.endpoints USING btree (active);


--
-- Name: endpoints_base_url_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX endpoints_base_url_unique ON public.endpoints USING btree (base_url) WHERE (active = true);


--
-- Name: endpoints_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX endpoints_call_id_idx ON public.endpoints USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: endpoints_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX endpoints_created_at_idx ON public.endpoints USING btree (created_at);


--
-- Name: eval_agents_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_agents_agent_id_idx ON public.eval_agents USING btree (agent_id);


--
-- Name: eval_agents_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_agents_call_id_idx ON public.eval_agents USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: eval_departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_departments_call_id_idx ON public.eval_departments USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: eval_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_departments_department_id_v7_idx ON public.eval_departments USING btree (department_id);


--
-- Name: eval_departments_eval_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_departments_eval_id_v7_idx ON public.eval_departments USING btree (eval_id);


--
-- Name: eval_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_descriptions_call_id_idx ON public.eval_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: eval_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_descriptions_description_id_idx ON public.eval_descriptions USING btree (description_id);


--
-- Name: eval_descriptions_eval_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_descriptions_eval_id_idx ON public.eval_descriptions USING btree (eval_id);


--
-- Name: eval_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_flags_call_id_idx ON public.eval_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: eval_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_group_id_idx ON public.eval USING btree (group_id);


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
-- Name: eval_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eval_names_call_id_idx ON public.eval_names USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: evals_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evals_call_id_idx ON public.evals USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: examples_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX examples_call_id_idx ON public.examples USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: examples_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX examples_created_at_idx ON public.examples USING btree (created_at);


--
-- Name: feedback_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_created_at_idx ON public.problems USING btree (created_at);


--
-- Name: feedbacks_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedbacks_call_id_idx ON public.feedbacks USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: field_departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_departments_call_id_idx ON public.field_departments USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: field_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_departments_department_id_v7_idx ON public.field_departments USING btree (department_id);


--
-- Name: field_departments_field_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_departments_field_id_v7_idx ON public.field_departments USING btree (field_id);


--
-- Name: field_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_descriptions_call_id_idx ON public.field_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: field_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_descriptions_description_id_idx ON public.field_descriptions USING btree (description_id);


--
-- Name: field_descriptions_field_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_descriptions_field_id_idx ON public.field_descriptions USING btree (field_id);


--
-- Name: field_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_flags_call_id_idx ON public.field_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: field_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_group_id_idx ON public.field USING btree (group_id);


--
-- Name: field_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_names_call_id_idx ON public.field_names USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: field_names_field_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_names_field_id_idx ON public.field_names USING btree (field_id);


--
-- Name: field_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_names_name_id_idx ON public.field_names USING btree (name_id);


--
-- Name: fields_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fields_call_id_idx ON public.fields USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flags_call_id_idx ON public.flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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

CREATE INDEX grades_rubric_grade_agent_id_idx ON public.grade USING btree (rubric_grade_agent_id);


--
-- Name: grades_run_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grades_run_created_idx ON public.grade USING btree (run_id, created_at DESC);


--
-- Name: grades_run_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grades_run_id_v7_idx ON public.grade USING btree (run_id);


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
-- Name: hints_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hints_call_id_idx ON public.hints USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: hints_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hints_created_at_idx ON public.hints USING btree (created_at);


--
-- Name: html_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX html_active_idx ON public.html USING btree (active);


--
-- Name: html_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX html_call_id_idx ON public.html USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: icons_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX icons_call_id_idx ON public.icons USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: icons_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX icons_value_idx ON public.icons USING btree (value);


--
-- Name: idx_agent_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_departments_generated ON public.agent_departments USING btree (generated);


--
-- Name: idx_agent_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_departments_mcp ON public.agent_departments USING btree (mcp);


--
-- Name: idx_agent_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_descriptions_generated ON public.agent_descriptions USING btree (generated);


--
-- Name: idx_agent_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_descriptions_mcp ON public.agent_descriptions USING btree (mcp);


--
-- Name: idx_agent_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_flags_generated ON public.agent_flags USING btree (generated);


--
-- Name: idx_agent_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_flags_mcp ON public.agent_flags USING btree (mcp);


--
-- Name: idx_agent_instructions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_instructions_generated ON public.agent_instructions USING btree (generated);


--
-- Name: idx_agent_instructions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_instructions_mcp ON public.agent_instructions USING btree (mcp);


--
-- Name: idx_agent_models_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_models_generated ON public.agent_models USING btree (generated);


--
-- Name: idx_agent_models_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_models_mcp ON public.agent_models USING btree (mcp);


--
-- Name: idx_agent_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_names_generated ON public.agent_names USING btree (generated);


--
-- Name: idx_agent_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_names_mcp ON public.agent_names USING btree (mcp);


--
-- Name: idx_agent_prompts_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_prompts_generated ON public.agent_prompts USING btree (generated);


--
-- Name: idx_agent_prompts_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_prompts_mcp ON public.agent_prompts USING btree (mcp);


--
-- Name: idx_agents_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_mcp ON public.agent USING btree (mcp);


--
-- Name: idx_analyses_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analyses_mcp ON public.analyses USING btree (mcp);


--
-- Name: idx_audios_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audios_mcp ON public.audios USING btree (mcp);


--
-- Name: idx_auth_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_mcp ON public.auth USING btree (mcp);


--
-- Name: idx_cohort_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_departments_generated ON public.cohort_departments USING btree (generated);


--
-- Name: idx_cohort_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_departments_mcp ON public.cohort_departments USING btree (mcp);


--
-- Name: idx_cohort_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_descriptions_generated ON public.cohort_descriptions USING btree (generated);


--
-- Name: idx_cohort_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_descriptions_mcp ON public.cohort_descriptions USING btree (mcp);


--
-- Name: idx_cohort_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_flags_generated ON public.cohort_flags USING btree (generated);


--
-- Name: idx_cohort_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_flags_mcp ON public.cohort_flags USING btree (mcp);


--
-- Name: idx_cohort_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_names_generated ON public.cohort_names USING btree (generated);


--
-- Name: idx_cohort_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_names_mcp ON public.cohort_names USING btree (mcp);


--
-- Name: idx_cohort_profiles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_profiles_active ON public.cohort_profiles USING btree (active) WHERE (active = true);


--
-- Name: idx_cohort_profiles_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_profiles_generated ON public.cohort_profiles USING btree (generated);


--
-- Name: idx_cohort_profiles_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_profiles_mcp ON public.cohort_profiles USING btree (mcp);


--
-- Name: idx_cohort_simulations_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_simulations_active ON public.cohort_simulations USING btree (active) WHERE (active = true);


--
-- Name: idx_cohort_simulations_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_simulations_generated ON public.cohort_simulations USING btree (generated);


--
-- Name: idx_cohort_simulations_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_simulations_mcp ON public.cohort_simulations USING btree (mcp);


--
-- Name: idx_cohorts_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohorts_mcp ON public.cohort USING btree (mcp);


--
-- Name: idx_colors_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colors_mcp ON public.colors USING btree (mcp);


--
-- Name: idx_contents_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contents_generated ON public.contents USING btree (generated);


--
-- Name: idx_contents_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contents_mcp ON public.contents USING btree (mcp);


--
-- Name: idx_conversations_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_mcp ON public.conversations USING btree (mcp);


--
-- Name: idx_debug_info_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_debug_info_mcp ON public.debug_info USING btree (mcp);


--
-- Name: idx_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_mcp ON public.department USING btree (mcp);


--
-- Name: idx_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_descriptions_mcp ON public.descriptions USING btree (mcp);


--
-- Name: idx_document_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_departments_generated ON public.document_departments USING btree (generated);


--
-- Name: idx_document_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_departments_mcp ON public.document_departments USING btree (mcp);


--
-- Name: idx_document_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_descriptions_generated ON public.document_descriptions USING btree (generated);


--
-- Name: idx_document_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_descriptions_mcp ON public.document_descriptions USING btree (mcp);


--
-- Name: idx_document_fields_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_fields_generated ON public.document_fields USING btree (generated);


--
-- Name: idx_document_fields_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_fields_mcp ON public.document_fields USING btree (mcp);


--
-- Name: idx_document_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_flags_generated ON public.document_flags USING btree (generated);


--
-- Name: idx_document_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_flags_mcp ON public.document_flags USING btree (mcp);


--
-- Name: idx_document_html_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_html_generated ON public.document_html USING btree (generated);


--
-- Name: idx_document_html_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_html_mcp ON public.document_html USING btree (mcp);


--
-- Name: idx_document_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_names_generated ON public.document_names USING btree (generated);


--
-- Name: idx_document_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_names_mcp ON public.document_names USING btree (mcp);


--
-- Name: idx_document_schemas_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_schemas_generated ON public.document_schemas USING btree (generated);


--
-- Name: idx_document_schemas_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_schemas_mcp ON public.document_schemas USING btree (mcp);


--
-- Name: idx_document_templates_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_templates_generated ON public.document_templates USING btree (generated);


--
-- Name: idx_document_templates_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_templates_mcp ON public.document_templates USING btree (mcp);


--
-- Name: idx_documents_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_mcp ON public.document USING btree (mcp);


--
-- Name: idx_draft_agents_agents_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_agents_agents_id ON public.draft_agents USING btree (agents_id);


--
-- Name: idx_draft_agents_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_agents_draft_id ON public.draft_agents USING btree (draft_id);


--
-- Name: idx_draft_agents_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_agents_generated ON public.draft_agents USING btree (generated);


--
-- Name: idx_draft_agents_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_agents_mcp ON public.draft_agents USING btree (mcp);


--
-- Name: idx_draft_agents_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_agents_version ON public.draft_agents USING btree (version);


--
-- Name: idx_draft_analyses_analyses_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_analyses_analyses_id ON public.draft_analyses USING btree (analyses_id);


--
-- Name: idx_draft_analyses_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_analyses_draft_id ON public.draft_analyses USING btree (draft_id);


--
-- Name: idx_draft_analyses_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_analyses_generated ON public.draft_analyses USING btree (generated);


--
-- Name: idx_draft_analyses_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_analyses_mcp ON public.draft_analyses USING btree (mcp);


--
-- Name: idx_draft_analyses_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_analyses_version ON public.draft_analyses USING btree (version);


--
-- Name: idx_draft_auth_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_auth_auth_id ON public.draft_auth USING btree (auth_id);


--
-- Name: idx_draft_auth_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_auth_draft_id ON public.draft_auth USING btree (draft_id);


--
-- Name: idx_draft_auth_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_auth_generated ON public.draft_auth USING btree (generated);


--
-- Name: idx_draft_auth_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_auth_mcp ON public.draft_auth USING btree (mcp);


--
-- Name: idx_draft_auth_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_auth_version ON public.draft_auth USING btree (version);


--
-- Name: idx_draft_cohorts_cohorts_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_cohorts_cohorts_id ON public.draft_cohorts USING btree (cohorts_id);


--
-- Name: idx_draft_cohorts_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_cohorts_draft_id ON public.draft_cohorts USING btree (draft_id);


--
-- Name: idx_draft_cohorts_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_cohorts_generated ON public.draft_cohorts USING btree (generated);


--
-- Name: idx_draft_cohorts_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_cohorts_mcp ON public.draft_cohorts USING btree (mcp);


--
-- Name: idx_draft_cohorts_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_cohorts_version ON public.draft_cohorts USING btree (version);


--
-- Name: idx_draft_colors_colors_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_colors_colors_id ON public.draft_colors USING btree (colors_id);


--
-- Name: idx_draft_colors_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_colors_draft_id ON public.draft_colors USING btree (draft_id);


--
-- Name: idx_draft_colors_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_colors_generated ON public.draft_colors USING btree (generated);


--
-- Name: idx_draft_colors_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_colors_mcp ON public.draft_colors USING btree (mcp);


--
-- Name: idx_draft_colors_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_colors_version ON public.draft_colors USING btree (version);


--
-- Name: idx_draft_content_content_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_content_content_id ON public.draft_content USING btree (content_id);


--
-- Name: idx_draft_content_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_content_draft_id ON public.draft_content USING btree (draft_id);


--
-- Name: idx_draft_content_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_content_generated ON public.draft_content USING btree (generated);


--
-- Name: idx_draft_content_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_content_mcp ON public.draft_content USING btree (mcp);


--
-- Name: idx_draft_content_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_content_version ON public.draft_content USING btree (version);


--
-- Name: idx_draft_conversations_conversations_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_conversations_conversations_id ON public.draft_conversations USING btree (conversations_id);


--
-- Name: idx_draft_conversations_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_conversations_draft_id ON public.draft_conversations USING btree (draft_id);


--
-- Name: idx_draft_conversations_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_conversations_generated ON public.draft_conversations USING btree (generated);


--
-- Name: idx_draft_conversations_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_conversations_mcp ON public.draft_conversations USING btree (mcp);


--
-- Name: idx_draft_conversations_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_conversations_version ON public.draft_conversations USING btree (version);


--
-- Name: idx_draft_debug_info_debug_info_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_debug_info_debug_info_id ON public.draft_debug_info USING btree (debug_info_id);


--
-- Name: idx_draft_debug_info_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_debug_info_draft_id ON public.draft_debug_info USING btree (draft_id);


--
-- Name: idx_draft_debug_info_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_debug_info_generated ON public.draft_debug_info USING btree (generated);


--
-- Name: idx_draft_debug_info_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_debug_info_mcp ON public.draft_debug_info USING btree (mcp);


--
-- Name: idx_draft_debug_info_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_debug_info_version ON public.draft_debug_info USING btree (version);


--
-- Name: idx_draft_departments_departments_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_departments_departments_id ON public.draft_departments USING btree (departments_id);


--
-- Name: idx_draft_departments_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_departments_draft_id ON public.draft_departments USING btree (draft_id);


--
-- Name: idx_draft_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_departments_generated ON public.draft_departments USING btree (generated);


--
-- Name: idx_draft_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_departments_mcp ON public.draft_departments USING btree (mcp);


--
-- Name: idx_draft_departments_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_departments_version ON public.draft_departments USING btree (version);


--
-- Name: idx_draft_descriptions_descriptions_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_descriptions_descriptions_id ON public.draft_descriptions USING btree (descriptions_id);


--
-- Name: idx_draft_descriptions_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_descriptions_draft_id ON public.draft_descriptions USING btree (draft_id);


--
-- Name: idx_draft_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_descriptions_generated ON public.draft_descriptions USING btree (generated);


--
-- Name: idx_draft_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_descriptions_mcp ON public.draft_descriptions USING btree (mcp);


--
-- Name: idx_draft_descriptions_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_descriptions_version ON public.draft_descriptions USING btree (version);


--
-- Name: idx_draft_documents_documents_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_documents_documents_id ON public.draft_documents USING btree (documents_id);


--
-- Name: idx_draft_documents_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_documents_draft_id ON public.draft_documents USING btree (draft_id);


--
-- Name: idx_draft_documents_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_documents_generated ON public.draft_documents USING btree (generated);


--
-- Name: idx_draft_documents_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_documents_mcp ON public.draft_documents USING btree (mcp);


--
-- Name: idx_draft_documents_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_documents_version ON public.draft_documents USING btree (version);


--
-- Name: idx_draft_endpoints_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_endpoints_draft_id ON public.draft_endpoints USING btree (draft_id);


--
-- Name: idx_draft_endpoints_endpoints_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_endpoints_endpoints_id ON public.draft_endpoints USING btree (endpoints_id);


--
-- Name: idx_draft_endpoints_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_endpoints_generated ON public.draft_endpoints USING btree (generated);


--
-- Name: idx_draft_endpoints_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_endpoints_mcp ON public.draft_endpoints USING btree (mcp);


--
-- Name: idx_draft_endpoints_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_endpoints_version ON public.draft_endpoints USING btree (version);


--
-- Name: idx_draft_evals_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_evals_draft_id ON public.draft_evals USING btree (draft_id);


--
-- Name: idx_draft_evals_evals_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_evals_evals_id ON public.draft_evals USING btree (evals_id);


--
-- Name: idx_draft_evals_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_evals_generated ON public.draft_evals USING btree (generated);


--
-- Name: idx_draft_evals_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_evals_mcp ON public.draft_evals USING btree (mcp);


--
-- Name: idx_draft_evals_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_evals_version ON public.draft_evals USING btree (version);


--
-- Name: idx_draft_examples_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_examples_draft_id ON public.draft_examples USING btree (draft_id);


--
-- Name: idx_draft_examples_examples_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_examples_examples_id ON public.draft_examples USING btree (examples_id);


--
-- Name: idx_draft_examples_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_examples_generated ON public.draft_examples USING btree (generated);


--
-- Name: idx_draft_examples_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_examples_mcp ON public.draft_examples USING btree (mcp);


--
-- Name: idx_draft_examples_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_examples_version ON public.draft_examples USING btree (version);


--
-- Name: idx_draft_feedbacks_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_feedbacks_draft_id ON public.draft_feedbacks USING btree (draft_id);


--
-- Name: idx_draft_feedbacks_feedbacks_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_feedbacks_feedbacks_id ON public.draft_feedbacks USING btree (feedbacks_id);


--
-- Name: idx_draft_feedbacks_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_feedbacks_generated ON public.draft_feedbacks USING btree (generated);


--
-- Name: idx_draft_feedbacks_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_feedbacks_mcp ON public.draft_feedbacks USING btree (mcp);


--
-- Name: idx_draft_feedbacks_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_feedbacks_version ON public.draft_feedbacks USING btree (version);


--
-- Name: idx_draft_fields_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_fields_draft_id ON public.draft_fields USING btree (draft_id);


--
-- Name: idx_draft_fields_fields_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_fields_fields_id ON public.draft_fields USING btree (fields_id);


--
-- Name: idx_draft_fields_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_fields_generated ON public.draft_fields USING btree (generated);


--
-- Name: idx_draft_fields_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_fields_mcp ON public.draft_fields USING btree (mcp);


--
-- Name: idx_draft_fields_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_fields_version ON public.draft_fields USING btree (version);


--
-- Name: idx_draft_flags_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_flags_draft_id ON public.draft_flags USING btree (draft_id);


--
-- Name: idx_draft_flags_flags_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_flags_flags_id ON public.draft_flags USING btree (flags_id);


--
-- Name: idx_draft_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_flags_generated ON public.draft_flags USING btree (generated);


--
-- Name: idx_draft_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_flags_mcp ON public.draft_flags USING btree (mcp);


--
-- Name: idx_draft_flags_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_flags_version ON public.draft_flags USING btree (version);


--
-- Name: idx_draft_hints_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_hints_draft_id ON public.draft_hints USING btree (draft_id);


--
-- Name: idx_draft_hints_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_hints_generated ON public.draft_hints USING btree (generated);


--
-- Name: idx_draft_hints_hints_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_hints_hints_id ON public.draft_hints USING btree (hints_id);


--
-- Name: idx_draft_hints_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_hints_mcp ON public.draft_hints USING btree (mcp);


--
-- Name: idx_draft_hints_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_hints_version ON public.draft_hints USING btree (version);


--
-- Name: idx_draft_html_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_html_draft_id ON public.draft_html USING btree (draft_id);


--
-- Name: idx_draft_html_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_html_generated ON public.draft_html USING btree (generated);


--
-- Name: idx_draft_html_html_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_html_html_id ON public.draft_html USING btree (html_id);


--
-- Name: idx_draft_html_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_html_mcp ON public.draft_html USING btree (mcp);


--
-- Name: idx_draft_html_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_html_version ON public.draft_html USING btree (version);


--
-- Name: idx_draft_icons_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_icons_draft_id ON public.draft_icons USING btree (draft_id);


--
-- Name: idx_draft_icons_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_icons_generated ON public.draft_icons USING btree (generated);


--
-- Name: idx_draft_icons_icons_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_icons_icons_id ON public.draft_icons USING btree (icons_id);


--
-- Name: idx_draft_icons_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_icons_mcp ON public.draft_icons USING btree (mcp);


--
-- Name: idx_draft_icons_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_icons_version ON public.draft_icons USING btree (version);


--
-- Name: idx_draft_images_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_images_draft_id ON public.draft_images USING btree (draft_id);


--
-- Name: idx_draft_images_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_images_generated ON public.draft_images USING btree (generated);


--
-- Name: idx_draft_images_images_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_images_images_id ON public.draft_images USING btree (images_id);


--
-- Name: idx_draft_images_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_images_mcp ON public.draft_images USING btree (mcp);


--
-- Name: idx_draft_images_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_images_version ON public.draft_images USING btree (version);


--
-- Name: idx_draft_improvements_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_improvements_draft_id ON public.draft_improvements USING btree (draft_id);


--
-- Name: idx_draft_improvements_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_improvements_generated ON public.draft_improvements USING btree (generated);


--
-- Name: idx_draft_improvements_improvements_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_improvements_improvements_id ON public.draft_improvements USING btree (improvements_id);


--
-- Name: idx_draft_improvements_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_improvements_mcp ON public.draft_improvements USING btree (mcp);


--
-- Name: idx_draft_improvements_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_improvements_version ON public.draft_improvements USING btree (version);


--
-- Name: idx_draft_instructions_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_instructions_draft_id ON public.draft_instructions USING btree (draft_id);


--
-- Name: idx_draft_instructions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_instructions_generated ON public.draft_instructions USING btree (generated);


--
-- Name: idx_draft_instructions_instructions_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_instructions_instructions_id ON public.draft_instructions USING btree (instructions_id);


--
-- Name: idx_draft_instructions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_instructions_mcp ON public.draft_instructions USING btree (mcp);


--
-- Name: idx_draft_instructions_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_instructions_version ON public.draft_instructions USING btree (version);


--
-- Name: idx_draft_items_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_items_draft_id ON public.draft_items USING btree (draft_id);


--
-- Name: idx_draft_items_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_items_generated ON public.draft_items USING btree (generated);


--
-- Name: idx_draft_items_items_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_items_items_id ON public.draft_items USING btree (items_id);


--
-- Name: idx_draft_items_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_items_mcp ON public.draft_items USING btree (mcp);


--
-- Name: idx_draft_items_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_items_version ON public.draft_items USING btree (version);


--
-- Name: idx_draft_keys_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_keys_draft_id ON public.draft_keys USING btree (draft_id);


--
-- Name: idx_draft_keys_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_keys_generated ON public.draft_keys USING btree (generated);


--
-- Name: idx_draft_keys_keys_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_keys_keys_id ON public.draft_keys USING btree (keys_id);


--
-- Name: idx_draft_keys_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_keys_mcp ON public.draft_keys USING btree (mcp);


--
-- Name: idx_draft_keys_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_keys_version ON public.draft_keys USING btree (version);


--
-- Name: idx_draft_models_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_models_draft_id ON public.draft_models USING btree (draft_id);


--
-- Name: idx_draft_models_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_models_generated ON public.draft_models USING btree (generated);


--
-- Name: idx_draft_models_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_models_mcp ON public.draft_models USING btree (mcp);


--
-- Name: idx_draft_models_models_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_models_models_id ON public.draft_models USING btree (models_id);


--
-- Name: idx_draft_models_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_models_version ON public.draft_models USING btree (version);


--
-- Name: idx_draft_names_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_names_draft_id ON public.draft_names USING btree (draft_id);


--
-- Name: idx_draft_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_names_generated ON public.draft_names USING btree (generated);


--
-- Name: idx_draft_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_names_mcp ON public.draft_names USING btree (mcp);


--
-- Name: idx_draft_names_names_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_names_names_id ON public.draft_names USING btree (names_id);


--
-- Name: idx_draft_names_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_names_version ON public.draft_names USING btree (version);


--
-- Name: idx_draft_objectives_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_objectives_draft_id ON public.draft_objectives USING btree (draft_id);


--
-- Name: idx_draft_objectives_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_objectives_generated ON public.draft_objectives USING btree (generated);


--
-- Name: idx_draft_objectives_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_objectives_mcp ON public.draft_objectives USING btree (mcp);


--
-- Name: idx_draft_objectives_objectives_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_objectives_objectives_id ON public.draft_objectives USING btree (objectives_id);


--
-- Name: idx_draft_objectives_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_objectives_version ON public.draft_objectives USING btree (version);


--
-- Name: idx_draft_options_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_options_draft_id ON public.draft_options USING btree (draft_id);


--
-- Name: idx_draft_options_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_options_generated ON public.draft_options USING btree (generated);


--
-- Name: idx_draft_options_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_options_mcp ON public.draft_options USING btree (mcp);


--
-- Name: idx_draft_options_options_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_options_options_id ON public.draft_options USING btree (options_id);


--
-- Name: idx_draft_options_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_options_version ON public.draft_options USING btree (version);


--
-- Name: idx_draft_parameters_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_parameters_draft_id ON public.draft_parameters USING btree (draft_id);


--
-- Name: idx_draft_parameters_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_parameters_generated ON public.draft_parameters USING btree (generated);


--
-- Name: idx_draft_parameters_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_parameters_mcp ON public.draft_parameters USING btree (mcp);


--
-- Name: idx_draft_parameters_parameters_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_parameters_parameters_id ON public.draft_parameters USING btree (parameters_id);


--
-- Name: idx_draft_parameters_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_parameters_version ON public.draft_parameters USING btree (version);


--
-- Name: idx_draft_personas_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_personas_draft_id ON public.draft_personas USING btree (draft_id);


--
-- Name: idx_draft_personas_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_personas_generated ON public.draft_personas USING btree (generated);


--
-- Name: idx_draft_personas_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_personas_mcp ON public.draft_personas USING btree (mcp);


--
-- Name: idx_draft_personas_personas_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_personas_personas_id ON public.draft_personas USING btree (personas_id);


--
-- Name: idx_draft_personas_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_personas_version ON public.draft_personas USING btree (version);


--
-- Name: idx_draft_points_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_points_draft_id ON public.draft_points USING btree (draft_id);


--
-- Name: idx_draft_points_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_points_generated ON public.draft_points USING btree (generated);


--
-- Name: idx_draft_points_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_points_mcp ON public.draft_points USING btree (mcp);


--
-- Name: idx_draft_points_points_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_points_points_id ON public.draft_points USING btree (points_id);


--
-- Name: idx_draft_points_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_points_version ON public.draft_points USING btree (version);


--
-- Name: idx_draft_problem_statements_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_problem_statements_draft_id ON public.draft_problem_statements USING btree (draft_id);


--
-- Name: idx_draft_problem_statements_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_problem_statements_generated ON public.draft_problem_statements USING btree (generated);


--
-- Name: idx_draft_problem_statements_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_problem_statements_mcp ON public.draft_problem_statements USING btree (mcp);


--
-- Name: idx_draft_problem_statements_problem_statements_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_problem_statements_problem_statements_id ON public.draft_problem_statements USING btree (problem_statements_id);


--
-- Name: idx_draft_problem_statements_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_problem_statements_version ON public.draft_problem_statements USING btree (version);


--
-- Name: idx_draft_profiles_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_profiles_draft_id ON public.draft_profiles USING btree (draft_id);


--
-- Name: idx_draft_profiles_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_profiles_generated ON public.draft_profiles USING btree (generated);


--
-- Name: idx_draft_profiles_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_profiles_mcp ON public.draft_profiles USING btree (mcp);


--
-- Name: idx_draft_profiles_profiles_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_profiles_profiles_id ON public.draft_profiles USING btree (profiles_id);


--
-- Name: idx_draft_profiles_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_profiles_version ON public.draft_profiles USING btree (version);


--
-- Name: idx_draft_prompts_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_prompts_draft_id ON public.draft_prompts USING btree (draft_id);


--
-- Name: idx_draft_prompts_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_prompts_generated ON public.draft_prompts USING btree (generated);


--
-- Name: idx_draft_prompts_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_prompts_mcp ON public.draft_prompts USING btree (mcp);


--
-- Name: idx_draft_prompts_prompts_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_prompts_prompts_id ON public.draft_prompts USING btree (prompts_id);


--
-- Name: idx_draft_prompts_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_prompts_version ON public.draft_prompts USING btree (version);


--
-- Name: idx_draft_protocols_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_protocols_draft_id ON public.draft_protocols USING btree (draft_id);


--
-- Name: idx_draft_protocols_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_protocols_generated ON public.draft_protocols USING btree (generated);


--
-- Name: idx_draft_protocols_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_protocols_mcp ON public.draft_protocols USING btree (mcp);


--
-- Name: idx_draft_protocols_protocols_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_protocols_protocols_id ON public.draft_protocols USING btree (protocols_id);


--
-- Name: idx_draft_protocols_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_protocols_version ON public.draft_protocols USING btree (version);


--
-- Name: idx_draft_questions_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_questions_draft_id ON public.draft_questions USING btree (draft_id);


--
-- Name: idx_draft_questions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_questions_generated ON public.draft_questions USING btree (generated);


--
-- Name: idx_draft_questions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_questions_mcp ON public.draft_questions USING btree (mcp);


--
-- Name: idx_draft_questions_questions_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_questions_questions_id ON public.draft_questions USING btree (questions_id);


--
-- Name: idx_draft_questions_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_questions_version ON public.draft_questions USING btree (version);


--
-- Name: idx_draft_responses_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_responses_draft_id ON public.draft_responses USING btree (draft_id);


--
-- Name: idx_draft_responses_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_responses_generated ON public.draft_responses USING btree (generated);


--
-- Name: idx_draft_responses_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_responses_mcp ON public.draft_responses USING btree (mcp);


--
-- Name: idx_draft_responses_responses_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_responses_responses_id ON public.draft_responses USING btree (responses_id);


--
-- Name: idx_draft_responses_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_responses_version ON public.draft_responses USING btree (version);


--
-- Name: idx_draft_rubrics_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_rubrics_draft_id ON public.draft_rubrics USING btree (draft_id);


--
-- Name: idx_draft_rubrics_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_rubrics_generated ON public.draft_rubrics USING btree (generated);


--
-- Name: idx_draft_rubrics_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_rubrics_mcp ON public.draft_rubrics USING btree (mcp);


--
-- Name: idx_draft_rubrics_rubrics_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_rubrics_rubrics_id ON public.draft_rubrics USING btree (rubrics_id);


--
-- Name: idx_draft_rubrics_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_rubrics_version ON public.draft_rubrics USING btree (version);


--
-- Name: idx_draft_scenarios_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_scenarios_draft_id ON public.draft_scenarios USING btree (draft_id);


--
-- Name: idx_draft_scenarios_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_scenarios_generated ON public.draft_scenarios USING btree (generated);


--
-- Name: idx_draft_scenarios_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_scenarios_mcp ON public.draft_scenarios USING btree (mcp);


--
-- Name: idx_draft_scenarios_scenarios_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_scenarios_scenarios_id ON public.draft_scenarios USING btree (scenarios_id);


--
-- Name: idx_draft_scenarios_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_scenarios_version ON public.draft_scenarios USING btree (version);


--
-- Name: idx_draft_schema_field_items_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schema_field_items_draft_id ON public.draft_schema_field_items USING btree (draft_id);


--
-- Name: idx_draft_schema_field_items_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schema_field_items_generated ON public.draft_schema_field_items USING btree (generated);


--
-- Name: idx_draft_schema_field_items_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schema_field_items_mcp ON public.draft_schema_field_items USING btree (mcp);


--
-- Name: idx_draft_schema_field_items_schema_field_items_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schema_field_items_schema_field_items_id ON public.draft_schema_field_items USING btree (schema_field_items_id);


--
-- Name: idx_draft_schema_field_items_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schema_field_items_version ON public.draft_schema_field_items USING btree (version);


--
-- Name: idx_draft_schema_fields_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schema_fields_draft_id ON public.draft_schema_fields USING btree (draft_id);


--
-- Name: idx_draft_schema_fields_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schema_fields_generated ON public.draft_schema_fields USING btree (generated);


--
-- Name: idx_draft_schema_fields_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schema_fields_mcp ON public.draft_schema_fields USING btree (mcp);


--
-- Name: idx_draft_schema_fields_schema_fields_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schema_fields_schema_fields_id ON public.draft_schema_fields USING btree (schema_fields_id);


--
-- Name: idx_draft_schema_fields_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schema_fields_version ON public.draft_schema_fields USING btree (version);


--
-- Name: idx_draft_schemas_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schemas_draft_id ON public.draft_schemas USING btree (draft_id);


--
-- Name: idx_draft_schemas_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schemas_generated ON public.draft_schemas USING btree (generated);


--
-- Name: idx_draft_schemas_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schemas_mcp ON public.draft_schemas USING btree (mcp);


--
-- Name: idx_draft_schemas_schemas_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schemas_schemas_id ON public.draft_schemas USING btree (schemas_id);


--
-- Name: idx_draft_schemas_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_schemas_version ON public.draft_schemas USING btree (version);


--
-- Name: idx_draft_settings_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_settings_draft_id ON public.draft_settings USING btree (draft_id);


--
-- Name: idx_draft_settings_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_settings_generated ON public.draft_settings USING btree (generated);


--
-- Name: idx_draft_settings_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_settings_mcp ON public.draft_settings USING btree (mcp);


--
-- Name: idx_draft_settings_settings_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_settings_settings_id ON public.draft_settings USING btree (settings_id);


--
-- Name: idx_draft_settings_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_settings_version ON public.draft_settings USING btree (version);


--
-- Name: idx_draft_simulations_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_simulations_draft_id ON public.draft_simulations USING btree (draft_id);


--
-- Name: idx_draft_simulations_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_simulations_generated ON public.draft_simulations USING btree (generated);


--
-- Name: idx_draft_simulations_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_simulations_mcp ON public.draft_simulations USING btree (mcp);


--
-- Name: idx_draft_simulations_simulations_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_simulations_simulations_id ON public.draft_simulations USING btree (simulations_id);


--
-- Name: idx_draft_simulations_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_simulations_version ON public.draft_simulations USING btree (version);


--
-- Name: idx_draft_slugs_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_slugs_draft_id ON public.draft_slugs USING btree (draft_id);


--
-- Name: idx_draft_slugs_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_slugs_generated ON public.draft_slugs USING btree (generated);


--
-- Name: idx_draft_slugs_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_slugs_mcp ON public.draft_slugs USING btree (mcp);


--
-- Name: idx_draft_slugs_slugs_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_slugs_slugs_id ON public.draft_slugs USING btree (slugs_id);


--
-- Name: idx_draft_slugs_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_slugs_version ON public.draft_slugs USING btree (version);


--
-- Name: idx_draft_standard_groups_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_standard_groups_draft_id ON public.draft_standard_groups USING btree (draft_id);


--
-- Name: idx_draft_standard_groups_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_standard_groups_generated ON public.draft_standard_groups USING btree (generated);


--
-- Name: idx_draft_standard_groups_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_standard_groups_mcp ON public.draft_standard_groups USING btree (mcp);


--
-- Name: idx_draft_standard_groups_standard_groups_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_standard_groups_standard_groups_id ON public.draft_standard_groups USING btree (standard_groups_id);


--
-- Name: idx_draft_standard_groups_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_standard_groups_version ON public.draft_standard_groups USING btree (version);


--
-- Name: idx_draft_strengths_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_strengths_draft_id ON public.draft_strengths USING btree (draft_id);


--
-- Name: idx_draft_strengths_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_strengths_generated ON public.draft_strengths USING btree (generated);


--
-- Name: idx_draft_strengths_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_strengths_mcp ON public.draft_strengths USING btree (mcp);


--
-- Name: idx_draft_strengths_strengths_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_strengths_strengths_id ON public.draft_strengths USING btree (strengths_id);


--
-- Name: idx_draft_strengths_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_strengths_version ON public.draft_strengths USING btree (version);


--
-- Name: idx_draft_template_array_items_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_template_array_items_draft_id ON public.draft_template_array_items USING btree (draft_id);


--
-- Name: idx_draft_template_array_items_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_template_array_items_generated ON public.draft_template_array_items USING btree (generated);


--
-- Name: idx_draft_template_array_items_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_template_array_items_mcp ON public.draft_template_array_items USING btree (mcp);


--
-- Name: idx_draft_template_array_items_template_array_items_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_template_array_items_template_array_items_id ON public.draft_template_array_items USING btree (template_array_items_id);


--
-- Name: idx_draft_template_array_items_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_template_array_items_version ON public.draft_template_array_items USING btree (version);


--
-- Name: idx_draft_template_values_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_template_values_draft_id ON public.draft_template_values USING btree (draft_id);


--
-- Name: idx_draft_template_values_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_template_values_generated ON public.draft_template_values USING btree (generated);


--
-- Name: idx_draft_template_values_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_template_values_mcp ON public.draft_template_values USING btree (mcp);


--
-- Name: idx_draft_template_values_template_values_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_template_values_template_values_id ON public.draft_template_values USING btree (template_values_id);


--
-- Name: idx_draft_template_values_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_template_values_version ON public.draft_template_values USING btree (version);


--
-- Name: idx_draft_templates_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_templates_draft_id ON public.draft_templates USING btree (draft_id);


--
-- Name: idx_draft_templates_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_templates_generated ON public.draft_templates USING btree (generated);


--
-- Name: idx_draft_templates_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_templates_mcp ON public.draft_templates USING btree (mcp);


--
-- Name: idx_draft_templates_templates_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_templates_templates_id ON public.draft_templates USING btree (templates_id);


--
-- Name: idx_draft_templates_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_templates_version ON public.draft_templates USING btree (version);


--
-- Name: idx_draft_thresholds_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_thresholds_draft_id ON public.draft_thresholds USING btree (draft_id);


--
-- Name: idx_draft_thresholds_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_thresholds_generated ON public.draft_thresholds USING btree (generated);


--
-- Name: idx_draft_thresholds_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_thresholds_mcp ON public.draft_thresholds USING btree (mcp);


--
-- Name: idx_draft_thresholds_thresholds_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_thresholds_thresholds_id ON public.draft_thresholds USING btree (thresholds_id);


--
-- Name: idx_draft_thresholds_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_thresholds_version ON public.draft_thresholds USING btree (version);


--
-- Name: idx_draft_times_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_times_draft_id ON public.draft_times USING btree (draft_id);


--
-- Name: idx_draft_times_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_times_generated ON public.draft_times USING btree (generated);


--
-- Name: idx_draft_times_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_times_mcp ON public.draft_times USING btree (mcp);


--
-- Name: idx_draft_times_times_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_times_times_id ON public.draft_times USING btree (times_id);


--
-- Name: idx_draft_times_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_times_version ON public.draft_times USING btree (version);


--
-- Name: idx_draft_videos_draft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_videos_draft_id ON public.draft_videos USING btree (draft_id);


--
-- Name: idx_draft_videos_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_videos_generated ON public.draft_videos USING btree (generated);


--
-- Name: idx_draft_videos_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_videos_mcp ON public.draft_videos USING btree (mcp);


--
-- Name: idx_draft_videos_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_videos_version ON public.draft_videos USING btree (version);


--
-- Name: idx_draft_videos_videos_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_videos_videos_id ON public.draft_videos USING btree (videos_id);


--
-- Name: idx_drafts_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drafts_group_id ON public.drafts USING btree (group_id);


--
-- Name: idx_drafts_profile_artifact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drafts_profile_artifact ON public.drafts USING btree (profile_id, artifact);


--
-- Name: idx_endpoints_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_endpoints_mcp ON public.endpoints USING btree (mcp);


--
-- Name: idx_eval_agents_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_agents_generated ON public.eval_agents USING btree (generated);


--
-- Name: idx_eval_agents_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_agents_mcp ON public.eval_agents USING btree (mcp);


--
-- Name: idx_eval_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_departments_generated ON public.eval_departments USING btree (generated);


--
-- Name: idx_eval_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_departments_mcp ON public.eval_departments USING btree (mcp);


--
-- Name: idx_eval_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_descriptions_generated ON public.eval_descriptions USING btree (generated);


--
-- Name: idx_eval_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_descriptions_mcp ON public.eval_descriptions USING btree (mcp);


--
-- Name: idx_eval_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_flags_generated ON public.eval_flags USING btree (generated);


--
-- Name: idx_eval_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_flags_mcp ON public.eval_flags USING btree (mcp);


--
-- Name: idx_eval_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_names_generated ON public.eval_names USING btree (generated);


--
-- Name: idx_eval_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_names_mcp ON public.eval_names USING btree (mcp);


--
-- Name: idx_evals_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evals_mcp ON public.eval USING btree (mcp);


--
-- Name: idx_examples_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_examples_mcp ON public.examples USING btree (mcp);


--
-- Name: idx_feedbacks_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_mcp ON public.feedbacks USING btree (mcp);


--
-- Name: idx_field_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_departments_generated ON public.field_departments USING btree (generated);


--
-- Name: idx_field_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_departments_mcp ON public.field_departments USING btree (mcp);


--
-- Name: idx_field_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_descriptions_generated ON public.field_descriptions USING btree (generated);


--
-- Name: idx_field_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_descriptions_mcp ON public.field_descriptions USING btree (mcp);


--
-- Name: idx_field_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_flags_generated ON public.field_flags USING btree (generated);


--
-- Name: idx_field_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_flags_mcp ON public.field_flags USING btree (mcp);


--
-- Name: idx_field_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_names_generated ON public.field_names USING btree (generated);


--
-- Name: idx_field_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_names_mcp ON public.field_names USING btree (mcp);


--
-- Name: idx_fields_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fields_mcp ON public.field USING btree (mcp);


--
-- Name: idx_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flags_mcp ON public.flags USING btree (mcp);


--
-- Name: idx_grade_analyses_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grade_analyses_generated ON public.grade_analyses USING btree (generated);


--
-- Name: idx_grade_analyses_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grade_analyses_mcp ON public.grade_analyses USING btree (mcp);


--
-- Name: idx_grade_feedbacks_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grade_feedbacks_generated ON public.grade_feedbacks USING btree (generated);


--
-- Name: idx_grade_feedbacks_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grade_feedbacks_mcp ON public.grade_feedbacks USING btree (mcp);


--
-- Name: idx_grade_improvements_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grade_improvements_generated ON public.grade_improvements USING btree (generated);


--
-- Name: idx_grade_improvements_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grade_improvements_mcp ON public.grade_improvements USING btree (mcp);


--
-- Name: idx_grade_strengths_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grade_strengths_generated ON public.grade_strengths USING btree (generated);


--
-- Name: idx_grade_strengths_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grade_strengths_mcp ON public.grade_strengths USING btree (mcp);


--
-- Name: idx_grade_times_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grade_times_generated ON public.grade_times USING btree (generated);


--
-- Name: idx_grade_times_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grade_times_mcp ON public.grade_times USING btree (mcp);


--
-- Name: idx_hints_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hints_mcp ON public.hints USING btree (mcp);


--
-- Name: idx_html_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_html_mcp ON public.html USING btree (mcp);


--
-- Name: idx_icons_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icons_mcp ON public.icons USING btree (mcp);


--
-- Name: idx_images_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_images_mcp ON public.images USING btree (mcp);


--
-- Name: idx_improvements_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_improvements_mcp ON public.improvements USING btree (mcp);


--
-- Name: idx_instructions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instructions_mcp ON public.instructions USING btree (mcp);


--
-- Name: idx_items_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_mcp ON public.items USING btree (mcp);


--
-- Name: idx_key_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_key_descriptions_generated ON public.key_descriptions USING btree (generated);


--
-- Name: idx_key_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_key_descriptions_mcp ON public.key_descriptions USING btree (mcp);


--
-- Name: idx_key_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_key_flags_generated ON public.key_flags USING btree (generated);


--
-- Name: idx_key_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_key_flags_mcp ON public.key_flags USING btree (mcp);


--
-- Name: idx_key_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_key_names_generated ON public.key_names USING btree (generated);


--
-- Name: idx_key_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_key_names_mcp ON public.key_names USING btree (mcp);


--
-- Name: idx_keys_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_keys_mcp ON public.key USING btree (mcp);


--
-- Name: idx_message_audios_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_audios_generated ON public.message_audios USING btree (generated);


--
-- Name: idx_message_audios_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_audios_mcp ON public.message_audios USING btree (mcp);


--
-- Name: idx_message_contents_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_contents_generated ON public.message_contents USING btree (generated);


--
-- Name: idx_message_contents_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_contents_mcp ON public.message_contents USING btree (mcp);


--
-- Name: idx_message_documents_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_documents_generated ON public.message_documents USING btree (generated);


--
-- Name: idx_message_documents_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_documents_mcp ON public.message_documents USING btree (mcp);


--
-- Name: idx_message_hints_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_hints_generated ON public.message_hints USING btree (generated);


--
-- Name: idx_message_hints_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_hints_mcp ON public.message_hints USING btree (mcp);


--
-- Name: idx_message_images_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_images_generated ON public.message_images USING btree (generated);


--
-- Name: idx_message_images_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_images_mcp ON public.message_images USING btree (mcp);


--
-- Name: idx_message_personas_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_personas_generated ON public.message_personas USING btree (generated);


--
-- Name: idx_message_personas_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_personas_mcp ON public.message_personas USING btree (mcp);


--
-- Name: idx_message_texts_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_texts_generated ON public.message_texts USING btree (generated);


--
-- Name: idx_message_texts_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_texts_mcp ON public.message_texts USING btree (mcp);


--
-- Name: idx_message_videos_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_videos_generated ON public.message_videos USING btree (generated);


--
-- Name: idx_message_videos_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_videos_mcp ON public.message_videos USING btree (mcp);


--
-- Name: idx_model_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_departments_generated ON public.model_departments USING btree (generated);


--
-- Name: idx_model_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_departments_mcp ON public.model_departments USING btree (mcp);


--
-- Name: idx_model_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_descriptions_generated ON public.model_descriptions USING btree (generated);


--
-- Name: idx_model_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_descriptions_mcp ON public.model_descriptions USING btree (mcp);


--
-- Name: idx_model_endpoints_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_endpoints_generated ON public.model_endpoints USING btree (generated);


--
-- Name: idx_model_endpoints_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_endpoints_mcp ON public.model_endpoints USING btree (mcp);


--
-- Name: idx_model_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_flags_generated ON public.model_flags USING btree (generated);


--
-- Name: idx_model_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_flags_mcp ON public.model_flags USING btree (mcp);


--
-- Name: idx_model_keys_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_keys_generated ON public.model_keys USING btree (generated);


--
-- Name: idx_model_keys_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_keys_mcp ON public.model_keys USING btree (mcp);


--
-- Name: idx_model_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_names_generated ON public.model_names USING btree (generated);


--
-- Name: idx_model_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_names_mcp ON public.model_names USING btree (mcp);


--
-- Name: idx_models_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_models_mcp ON public.model USING btree (mcp);


--
-- Name: idx_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_names_mcp ON public.names USING btree (mcp);


--
-- Name: idx_objectives_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_objectives_mcp ON public.objectives USING btree (mcp);


--
-- Name: idx_options_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_options_mcp ON public.options USING btree (mcp);


--
-- Name: idx_parameter_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parameter_departments_generated ON public.parameter_departments USING btree (generated);


--
-- Name: idx_parameter_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parameter_departments_mcp ON public.parameter_departments USING btree (mcp);


--
-- Name: idx_parameter_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parameter_descriptions_generated ON public.parameter_descriptions USING btree (generated);


--
-- Name: idx_parameter_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parameter_descriptions_mcp ON public.parameter_descriptions USING btree (mcp);


--
-- Name: idx_parameter_fields_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parameter_fields_generated ON public.parameter_fields USING btree (generated);


--
-- Name: idx_parameter_fields_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parameter_fields_mcp ON public.parameter_fields USING btree (mcp);


--
-- Name: idx_parameter_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parameter_flags_generated ON public.parameter_flags USING btree (generated);


--
-- Name: idx_parameter_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parameter_flags_mcp ON public.parameter_flags USING btree (mcp);


--
-- Name: idx_parameter_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parameter_names_generated ON public.parameter_names USING btree (generated);


--
-- Name: idx_parameter_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parameter_names_mcp ON public.parameter_names USING btree (mcp);


--
-- Name: idx_parameters_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parameters_mcp ON public.parameter USING btree (mcp);


--
-- Name: idx_persona_colors_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_colors_generated ON public.persona_colors USING btree (generated);


--
-- Name: idx_persona_colors_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_colors_mcp ON public.persona_colors USING btree (mcp);


--
-- Name: idx_persona_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_departments_generated ON public.persona_departments USING btree (generated);


--
-- Name: idx_persona_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_departments_mcp ON public.persona_departments USING btree (mcp);


--
-- Name: idx_persona_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_descriptions_generated ON public.persona_descriptions USING btree (generated);


--
-- Name: idx_persona_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_descriptions_mcp ON public.persona_descriptions USING btree (mcp);


--
-- Name: idx_persona_examples_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_examples_generated ON public.persona_examples USING btree (generated);


--
-- Name: idx_persona_examples_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_examples_mcp ON public.persona_examples USING btree (mcp);


--
-- Name: idx_persona_fields_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_fields_generated ON public.persona_fields USING btree (generated);


--
-- Name: idx_persona_fields_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_fields_mcp ON public.persona_fields USING btree (mcp);


--
-- Name: idx_persona_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_flags_generated ON public.persona_flags USING btree (generated);


--
-- Name: idx_persona_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_flags_mcp ON public.persona_flags USING btree (mcp);


--
-- Name: idx_persona_icons_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_icons_generated ON public.persona_icons USING btree (generated);


--
-- Name: idx_persona_icons_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_icons_mcp ON public.persona_icons USING btree (mcp);


--
-- Name: idx_persona_instructions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_instructions_generated ON public.persona_instructions USING btree (generated);


--
-- Name: idx_persona_instructions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_instructions_mcp ON public.persona_instructions USING btree (mcp);


--
-- Name: idx_persona_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_names_generated ON public.persona_names USING btree (generated);


--
-- Name: idx_persona_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persona_names_mcp ON public.persona_names USING btree (mcp);


--
-- Name: idx_personas_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personas_mcp ON public.persona USING btree (mcp);


--
-- Name: idx_points_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_points_mcp ON public.points USING btree (mcp);


--
-- Name: idx_problem_statements_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_problem_statements_mcp ON public.problem_statements USING btree (mcp);


--
-- Name: idx_profile_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_departments_generated ON public.profile_departments USING btree (generated);


--
-- Name: idx_profile_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_departments_mcp ON public.profile_departments USING btree (mcp);


--
-- Name: idx_profile_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_flags_generated ON public.profile_flags USING btree (generated);


--
-- Name: idx_profile_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_flags_mcp ON public.profile_flags USING btree (mcp);


--
-- Name: idx_profile_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_names_generated ON public.profile_names USING btree (generated);


--
-- Name: idx_profile_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_names_mcp ON public.profile_names USING btree (mcp);


--
-- Name: idx_profiles_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_mcp ON public.profile USING btree (mcp);


--
-- Name: idx_prompts_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prompts_mcp ON public.prompts USING btree (mcp);


--
-- Name: idx_protocols_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocols_mcp ON public.protocols USING btree (mcp);


--
-- Name: idx_provider_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_mcp ON public.provider USING btree (mcp);


--
-- Name: idx_questions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_mcp ON public.questions USING btree (mcp);


--
-- Name: idx_responses_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_responses_mcp ON public.responses USING btree (mcp);


--
-- Name: idx_rubric_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubric_departments_generated ON public.rubric_departments USING btree (generated);


--
-- Name: idx_rubric_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubric_departments_mcp ON public.rubric_departments USING btree (mcp);


--
-- Name: idx_rubric_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubric_descriptions_generated ON public.rubric_descriptions USING btree (generated);


--
-- Name: idx_rubric_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubric_descriptions_mcp ON public.rubric_descriptions USING btree (mcp);


--
-- Name: idx_rubric_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubric_flags_generated ON public.rubric_flags USING btree (generated);


--
-- Name: idx_rubric_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubric_flags_mcp ON public.rubric_flags USING btree (mcp);


--
-- Name: idx_rubric_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubric_names_generated ON public.rubric_names USING btree (generated);


--
-- Name: idx_rubric_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubric_names_mcp ON public.rubric_names USING btree (mcp);


--
-- Name: idx_rubric_points_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubric_points_generated ON public.rubric_points USING btree (generated);


--
-- Name: idx_rubric_points_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubric_points_mcp ON public.rubric_points USING btree (mcp);


--
-- Name: idx_rubric_standard_groups_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubric_standard_groups_generated ON public.rubric_standard_groups USING btree (generated);


--
-- Name: idx_rubric_standard_groups_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubric_standard_groups_mcp ON public.rubric_standard_groups USING btree (mcp);


--
-- Name: idx_rubrics_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rubrics_mcp ON public.rubric USING btree (mcp);


--
-- Name: idx_runs_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runs_generated ON public.run USING btree (generated);


--
-- Name: idx_runs_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runs_mcp ON public.run USING btree (mcp);


--
-- Name: idx_scenario_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_departments_generated ON public.scenario_departments USING btree (generated);


--
-- Name: idx_scenario_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_departments_mcp ON public.scenario_departments USING btree (mcp);


--
-- Name: idx_scenario_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_descriptions_generated ON public.scenario_descriptions USING btree (generated);


--
-- Name: idx_scenario_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_descriptions_mcp ON public.scenario_descriptions USING btree (mcp);


--
-- Name: idx_scenario_documents_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_documents_generated ON public.scenario_documents USING btree (generated);


--
-- Name: idx_scenario_documents_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_documents_mcp ON public.scenario_documents USING btree (mcp);


--
-- Name: idx_scenario_fields_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_fields_generated ON public.scenario_fields USING btree (generated);


--
-- Name: idx_scenario_fields_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_fields_mcp ON public.scenario_fields USING btree (mcp);


--
-- Name: idx_scenario_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_flags_generated ON public.scenario_flags USING btree (generated);


--
-- Name: idx_scenario_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_flags_mcp ON public.scenario_flags USING btree (mcp);


--
-- Name: idx_scenario_images_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_images_generated ON public.scenario_images USING btree (generated);


--
-- Name: idx_scenario_images_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_images_mcp ON public.scenario_images USING btree (mcp);


--
-- Name: idx_scenario_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_names_generated ON public.scenario_names USING btree (generated);


--
-- Name: idx_scenario_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_names_mcp ON public.scenario_names USING btree (mcp);


--
-- Name: idx_scenario_objectives_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_objectives_generated ON public.scenario_objectives USING btree (generated);


--
-- Name: idx_scenario_objectives_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_objectives_mcp ON public.scenario_objectives USING btree (mcp);


--
-- Name: idx_scenario_options_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_options_generated ON public.scenario_options USING btree (generated);


--
-- Name: idx_scenario_options_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_options_mcp ON public.scenario_options USING btree (mcp);


--
-- Name: idx_scenario_parameters_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_parameters_generated ON public.scenario_parameters USING btree (generated);


--
-- Name: idx_scenario_parameters_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_parameters_mcp ON public.scenario_parameters USING btree (mcp);


--
-- Name: idx_scenario_personas_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_personas_generated ON public.scenario_personas USING btree (generated);


--
-- Name: idx_scenario_personas_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_personas_mcp ON public.scenario_personas USING btree (mcp);


--
-- Name: idx_scenario_problem_statements_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_problem_statements_generated ON public.scenario_problem_statements USING btree (generated);


--
-- Name: idx_scenario_problem_statements_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_problem_statements_mcp ON public.scenario_problem_statements USING btree (mcp);


--
-- Name: idx_scenario_questions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_questions_generated ON public.scenario_questions USING btree (generated);


--
-- Name: idx_scenario_questions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_questions_mcp ON public.scenario_questions USING btree (mcp);


--
-- Name: idx_scenario_templates_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_templates_generated ON public.scenario_templates USING btree (generated);


--
-- Name: idx_scenario_templates_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_templates_mcp ON public.scenario_templates USING btree (mcp);


--
-- Name: idx_scenario_videos_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_videos_generated ON public.scenario_videos USING btree (generated);


--
-- Name: idx_scenario_videos_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_videos_mcp ON public.scenario_videos USING btree (mcp);


--
-- Name: idx_scenarios_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenarios_mcp ON public.scenario USING btree (mcp);


--
-- Name: idx_schema_field_items_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schema_field_items_mcp ON public.schema_field_items USING btree (mcp);


--
-- Name: idx_schema_fields_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schema_fields_mcp ON public.schema_fields USING btree (mcp);


--
-- Name: idx_schemas_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schemas_mcp ON public.schemas USING btree (mcp);


--
-- Name: idx_setting_auths_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_auths_generated ON public.setting_auths USING btree (generated);


--
-- Name: idx_setting_auths_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_auths_mcp ON public.setting_auths USING btree (mcp);


--
-- Name: idx_setting_colors_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_colors_generated ON public.setting_colors USING btree (generated);


--
-- Name: idx_setting_colors_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_colors_mcp ON public.setting_colors USING btree (mcp);


--
-- Name: idx_setting_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_descriptions_generated ON public.setting_descriptions USING btree (generated);


--
-- Name: idx_setting_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_descriptions_mcp ON public.setting_descriptions USING btree (mcp);


--
-- Name: idx_setting_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_flags_generated ON public.setting_flags USING btree (generated);


--
-- Name: idx_setting_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_flags_mcp ON public.setting_flags USING btree (mcp);


--
-- Name: idx_setting_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_names_generated ON public.setting_names USING btree (generated);


--
-- Name: idx_setting_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_names_mcp ON public.setting_names USING btree (mcp);


--
-- Name: idx_setting_thresholds_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_thresholds_generated ON public.setting_thresholds USING btree (generated);


--
-- Name: idx_setting_thresholds_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_setting_thresholds_mcp ON public.setting_thresholds USING btree (mcp);


--
-- Name: idx_settings_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settings_mcp ON public.setting USING btree (mcp);


--
-- Name: idx_simulation_departments_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_departments_generated ON public.simulation_departments USING btree (generated);


--
-- Name: idx_simulation_departments_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_departments_mcp ON public.simulation_departments USING btree (mcp);


--
-- Name: idx_simulation_descriptions_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_descriptions_generated ON public.simulation_descriptions USING btree (generated);


--
-- Name: idx_simulation_descriptions_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_descriptions_mcp ON public.simulation_descriptions USING btree (mcp);


--
-- Name: idx_simulation_flags_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_flags_generated ON public.simulation_flags USING btree (generated);


--
-- Name: idx_simulation_flags_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_flags_mcp ON public.simulation_flags USING btree (mcp);


--
-- Name: idx_simulation_names_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_names_generated ON public.simulation_names USING btree (generated);


--
-- Name: idx_simulation_names_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_names_mcp ON public.simulation_names USING btree (mcp);


--
-- Name: idx_simulation_scenarios_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_scenarios_active ON public.simulation_scenarios USING btree (active) WHERE (active = true);


--
-- Name: idx_simulation_scenarios_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_scenarios_generated ON public.simulation_scenarios USING btree (generated);


--
-- Name: idx_simulation_scenarios_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_scenarios_mcp ON public.simulation_scenarios USING btree (mcp);


--
-- Name: idx_simulations_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulations_mcp ON public.simulation USING btree (mcp);


--
-- Name: idx_slugs_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slugs_mcp ON public.slugs USING btree (mcp);


--
-- Name: idx_standard_groups_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_standard_groups_mcp ON public.standard_groups USING btree (mcp);


--
-- Name: idx_strengths_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_strengths_mcp ON public.strengths USING btree (mcp);


--
-- Name: idx_template_array_items_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_array_items_mcp ON public.template_array_items USING btree (mcp);


--
-- Name: idx_template_values_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_values_mcp ON public.template_values USING btree (mcp);


--
-- Name: idx_templates_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_mcp ON public.templates USING btree (mcp);


--
-- Name: idx_texts_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_texts_mcp ON public.texts USING btree (mcp);


--
-- Name: idx_thresholds_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thresholds_mcp ON public.thresholds USING btree (mcp);


--
-- Name: idx_times_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_times_mcp ON public.times USING btree (mcp);


--
-- Name: idx_tool_schemas_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_schemas_generated ON public.tool_schemas USING btree (generated);


--
-- Name: idx_tool_schemas_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_schemas_mcp ON public.tool_schemas USING btree (mcp);


--
-- Name: idx_tool_templates_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_templates_generated ON public.tool_templates USING btree (generated);


--
-- Name: idx_tool_templates_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_templates_mcp ON public.tool_templates USING btree (mcp);


--
-- Name: idx_videos_mcp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_videos_mcp ON public.videos USING btree (mcp);


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
-- Name: images_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_call_id_idx ON public.images USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: images_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_created_at_idx ON public.images USING btree (created_at);


--
-- Name: images_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_name_idx ON public.images USING btree (name);


--
-- Name: improvements_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX improvements_call_id_idx ON public.improvements USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: improvements_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX improvements_created_at_idx ON public.improvements USING btree (created_at);


--
-- Name: improvements_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX improvements_message_id_idx ON public.improvements USING btree (message_id);


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
-- Name: instructions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX instructions_call_id_idx ON public.instructions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: items_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX items_active_idx ON public.items USING btree (active);


--
-- Name: items_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX items_call_id_idx ON public.items USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: items_encrypted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX items_encrypted_idx ON public.items USING btree (encrypted);


--
-- Name: items_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX items_name_idx ON public.items USING btree (name);


--
-- Name: key_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_descriptions_call_id_idx ON public.key_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: key_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_descriptions_description_id_idx ON public.key_descriptions USING btree (description_id);


--
-- Name: key_descriptions_key_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_descriptions_key_id_idx ON public.key_descriptions USING btree (key_id);


--
-- Name: key_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_flags_call_id_idx ON public.key_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: key_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_group_id_idx ON public.key USING btree (group_id);


--
-- Name: key_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_names_call_id_idx ON public.key_names USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: key_names_key_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_names_key_id_idx ON public.key_names USING btree (key_id);


--
-- Name: key_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX key_names_name_id_idx ON public.key_names USING btree (name_id);


--
-- Name: keys_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX keys_call_id_idx ON public.keys USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: message_audios_audio_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_audios_audio_id_idx ON public.message_audios USING btree (audio_id);


--
-- Name: message_audios_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_audios_message_id_idx ON public.message_audios USING btree (message_id);


--
-- Name: message_calls_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_calls_call_id_idx ON public.message_calls USING btree (call_id);


--
-- Name: message_calls_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_calls_message_id_idx ON public.message_calls USING btree (message_id);


--
-- Name: message_contents_content_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_contents_content_id_idx ON public.message_contents USING btree (content_id);


--
-- Name: message_contents_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_contents_message_id_idx ON public.message_contents USING btree (message_id);


--
-- Name: message_contents_message_id_idx_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_contents_message_id_idx_idx ON public.message_contents USING btree (message_id, idx);


--
-- Name: message_documents_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_documents_document_id_idx ON public.message_documents USING btree (document_id);


--
-- Name: message_documents_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_documents_message_id_idx ON public.message_documents USING btree (message_id);


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
-- Name: message_images_image_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_images_image_id_idx ON public.message_images USING btree (image_id);


--
-- Name: message_images_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_images_message_id_idx ON public.message_images USING btree (message_id);


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
-- Name: message_texts_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_texts_message_id_idx ON public.message_texts USING btree (message_id);


--
-- Name: message_texts_text_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_texts_text_id_idx ON public.message_texts USING btree (text_id);


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
-- Name: message_videos_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_videos_message_id_idx ON public.message_videos USING btree (message_id);


--
-- Name: message_videos_video_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_videos_video_id_idx ON public.message_videos USING btree (video_id);


--
-- Name: model_departments_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_departments_active_idx ON public.model_departments USING btree (active);


--
-- Name: model_departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_departments_call_id_idx ON public.model_departments USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: model_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_departments_department_id_v7_idx ON public.model_departments USING btree (department_id);


--
-- Name: model_departments_model_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_departments_model_id_v7_idx ON public.model_departments USING btree (model_id);


--
-- Name: model_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_descriptions_call_id_idx ON public.model_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: model_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_descriptions_description_id_idx ON public.model_descriptions USING btree (description_id);


--
-- Name: model_descriptions_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_descriptions_model_id_idx ON public.model_descriptions USING btree (model_id);


--
-- Name: model_endpoints_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_endpoints_call_id_idx ON public.model_endpoints USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: model_endpoints_endpoint_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_endpoints_endpoint_id_idx ON public.model_endpoints USING btree (endpoint_id);


--
-- Name: model_endpoints_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_endpoints_model_id_idx ON public.model_endpoints USING btree (model_id);


--
-- Name: model_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_flags_call_id_idx ON public.model_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: model_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_group_id_idx ON public.model USING btree (group_id);


--
-- Name: model_keys_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_keys_call_id_idx ON public.model_keys USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: model_keys_key_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_keys_key_id_idx ON public.model_keys USING btree (key_id);


--
-- Name: model_keys_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_keys_model_id_idx ON public.model_keys USING btree (model_id);


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
-- Name: model_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_names_call_id_idx ON public.model_names USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: model_providers_providers_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_providers_providers_id_idx ON public.model_providers USING btree (providers_id);


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

CREATE INDEX model_runs_created_at_idx ON public.run USING btree (created_at);


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
-- Name: models_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX models_call_id_idx ON public.models USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX names_call_id_idx ON public.names USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: objectives_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX objectives_call_id_idx ON public.objectives USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: objectives_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX objectives_created_at_idx ON public.objectives USING btree (created_at);


--
-- Name: options_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX options_active_idx ON public.options USING btree (active);


--
-- Name: options_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX options_call_id_idx ON public.options USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: parameter_departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_departments_call_id_idx ON public.parameter_departments USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: parameter_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_departments_department_id_v7_idx ON public.parameter_departments USING btree (department_id);


--
-- Name: parameter_departments_parameter_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_departments_parameter_id_v7_idx ON public.parameter_departments USING btree (parameter_id);


--
-- Name: parameter_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_descriptions_call_id_idx ON public.parameter_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: parameter_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_descriptions_description_id_idx ON public.parameter_descriptions USING btree (description_id);


--
-- Name: parameter_descriptions_parameter_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_descriptions_parameter_id_idx ON public.parameter_descriptions USING btree (parameter_id);


--
-- Name: parameter_fields_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_fields_call_id_idx ON public.parameter_fields USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: parameter_fields_field_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_fields_field_id_idx ON public.parameter_fields USING btree (field_id);


--
-- Name: parameter_fields_parameter_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_fields_parameter_id_idx ON public.parameter_fields USING btree (parameter_id);


--
-- Name: parameter_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_flags_call_id_idx ON public.parameter_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: parameter_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_group_id_idx ON public.parameter USING btree (group_id);


--
-- Name: parameter_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_names_call_id_idx ON public.parameter_names USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: parameter_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_names_name_id_idx ON public.parameter_names USING btree (name_id);


--
-- Name: parameter_names_parameter_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_names_parameter_id_idx ON public.parameter_names USING btree (parameter_id);


--
-- Name: parameters_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameters_call_id_idx ON public.parameters USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: persona_colors_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_colors_call_id_idx ON public.persona_colors USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: persona_departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_departments_call_id_idx ON public.persona_departments USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: persona_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_departments_department_id_v7_idx ON public.persona_departments USING btree (department_id);


--
-- Name: persona_departments_persona_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_departments_persona_id_v7_idx ON public.persona_departments USING btree (persona_id);


--
-- Name: persona_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_descriptions_call_id_idx ON public.persona_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: persona_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_descriptions_description_id_idx ON public.persona_descriptions USING btree (description_id);


--
-- Name: persona_descriptions_persona_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_descriptions_persona_id_idx ON public.persona_descriptions USING btree (persona_id);


--
-- Name: persona_examples_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_examples_active_idx ON public.persona_examples USING btree (active);


--
-- Name: persona_examples_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_examples_call_id_idx ON public.persona_examples USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: persona_examples_example_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_examples_example_id_v7_idx ON public.persona_examples USING btree (example_id);


--
-- Name: persona_examples_persona_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_examples_persona_id_v7_idx ON public.persona_examples USING btree (persona_id);


--
-- Name: persona_fields_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_fields_call_id_idx ON public.persona_fields USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: persona_fields_field_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_fields_field_id_v7_idx ON public.persona_fields USING btree (field_id);


--
-- Name: persona_fields_persona_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_fields_persona_id_v7_idx ON public.persona_fields USING btree (persona_id);


--
-- Name: persona_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_flags_call_id_idx ON public.persona_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: persona_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_group_id_idx ON public.persona USING btree (group_id);


--
-- Name: persona_icons_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_icons_call_id_idx ON public.persona_icons USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: persona_icons_icon_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_icons_icon_id_idx ON public.persona_icons USING btree (icon_id);


--
-- Name: persona_icons_persona_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_icons_persona_id_idx ON public.persona_icons USING btree (persona_id);


--
-- Name: persona_instructions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_instructions_call_id_idx ON public.persona_instructions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: persona_instructions_instruction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_instructions_instruction_id_idx ON public.persona_instructions USING btree (instruction_id);


--
-- Name: persona_instructions_persona_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_instructions_persona_id_idx ON public.persona_instructions USING btree (persona_id);


--
-- Name: persona_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_names_call_id_idx ON public.persona_names USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: persona_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_names_name_id_idx ON public.persona_names USING btree (name_id);


--
-- Name: persona_names_persona_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persona_names_persona_id_idx ON public.persona_names USING btree (persona_id);


--
-- Name: personas_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personas_call_id_idx ON public.personas USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: personas_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personas_id_idx ON public.persona USING btree (id);


--
-- Name: points_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX points_call_id_idx ON public.points USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: problem_statements_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problem_statements_call_id_idx ON public.problem_statements USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: problem_statements_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problem_statements_created_at_idx ON public.problem_statements USING btree (created_at);


--
-- Name: problem_statements_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problem_statements_name_idx ON public.problem_statements USING btree (name);


--
-- Name: problems_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problems_profile_id_v7_idx ON public.problems USING btree (profile_id);


--
-- Name: problems_resolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problems_resolved_idx ON public.problems USING btree (resolved);


--
-- Name: problems_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problems_type_idx ON public.problems USING btree (type);


--
-- Name: profile_activity_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_activity_created_at_idx ON public.profile_activity USING btree (created_at);


--
-- Name: profile_activity_profile_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_activity_profile_id_v7_idx ON public.profile_activity USING btree (profile_id);


--
-- Name: profile_departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_departments_call_id_idx ON public.profile_departments USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: profile_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_flags_call_id_idx ON public.profile_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: profile_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_group_id_idx ON public.profile USING btree (group_id);


--
-- Name: profile_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_names_call_id_idx ON public.profile_names USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: profiles_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_call_id_idx ON public.profiles USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: prompts_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prompts_call_id_idx ON public.prompts USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: prompts_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prompts_created_at_idx ON public.prompts USING btree (created_at);


--
-- Name: protocols_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX protocols_call_id_idx ON public.protocols USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: protocols_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX protocols_value_idx ON public.protocols USING btree (value);


--
-- Name: provider_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_descriptions_call_id_idx ON public.provider_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: provider_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_descriptions_description_id_idx ON public.provider_descriptions USING btree (description_id);


--
-- Name: provider_descriptions_provider_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_descriptions_provider_id_idx ON public.provider_descriptions USING btree (provider_id);


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
-- Name: provider_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_group_id_idx ON public.provider USING btree (group_id);


--
-- Name: provider_group_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX provider_group_id_unique ON public.provider USING btree (group_id);


--
-- Name: provider_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_id_idx ON public.provider USING btree (id);


--
-- Name: provider_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_names_call_id_idx ON public.provider_names USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: provider_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_names_name_id_idx ON public.provider_names USING btree (name_id);


--
-- Name: provider_names_provider_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_names_provider_id_idx ON public.provider_names USING btree (provider_id);


--
-- Name: providers_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX providers_call_id_idx ON public.providers USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: providers_provider_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX providers_provider_id_idx ON public.providers USING btree (provider_id);


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
-- Name: questions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX questions_call_id_idx ON public.questions USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: resource_modalities_modality_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX resource_modalities_modality_idx ON public.resource_modalities USING btree (modality);


--
-- Name: resource_modalities_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX resource_modalities_resource_idx ON public.resource_modalities USING btree (resource);


--
-- Name: resource_schemas_schema_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX resource_schemas_schema_id_idx ON public.resource_schemas USING btree (schema_id);


--
-- Name: resource_tools_tool_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX resource_tools_tool_id_idx ON public.resource_tools USING btree (tool_id);


--
-- Name: responses_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX responses_call_id_idx ON public.responses USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: rubric_artifacts_artifact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_artifacts_artifact_idx ON public.rubric_artifacts USING btree (artifact);


--
-- Name: rubric_artifacts_rubric_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_artifacts_rubric_id_idx ON public.rubric_artifacts USING btree (rubric_id);


--
-- Name: rubric_departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_departments_call_id_idx ON public.rubric_departments USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: rubric_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_departments_department_id_v7_idx ON public.rubric_departments USING btree (department_id);


--
-- Name: rubric_departments_rubric_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_departments_rubric_id_v7_idx ON public.rubric_departments USING btree (rubric_id);


--
-- Name: rubric_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_descriptions_call_id_idx ON public.rubric_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: rubric_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_flags_call_id_idx ON public.rubric_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: rubric_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_group_id_idx ON public.rubric USING btree (group_id);


--
-- Name: rubric_groups_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_groups_group_id_v7_idx ON public.rubric_groups USING btree (group_id);


--
-- Name: rubric_groups_rubric_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_groups_rubric_id_v7_idx ON public.rubric_groups USING btree (rubric_id);


--
-- Name: rubric_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_names_call_id_idx ON public.rubric_names USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: rubric_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_names_name_id_idx ON public.rubric_names USING btree (name_id);


--
-- Name: rubric_names_rubric_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_names_rubric_id_idx ON public.rubric_names USING btree (rubric_id);


--
-- Name: rubric_points_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_points_call_id_idx ON public.rubric_points USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: rubric_standard_groups_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubric_standard_groups_call_id_idx ON public.rubric_standard_groups USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: rubrics_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubrics_call_id_idx ON public.rubrics USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: rubrics_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubrics_id_idx ON public.rubric USING btree (id);


--
-- Name: rubrics_rubric_domain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rubrics_rubric_domain_id_idx ON public.rubric USING btree (rubric_domain_id);


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

CREATE INDEX runs_agent_id_v7_idx ON public.run USING btree (agent_id);


--
-- Name: runs_key_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX runs_key_id_v7_idx ON public.run USING btree (key_id);


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
-- Name: scenario_departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_departments_call_id_idx ON public.scenario_departments USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: scenario_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_departments_department_id_v7_idx ON public.scenario_departments USING btree (department_id);


--
-- Name: scenario_departments_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_departments_scenario_id_v7_idx ON public.scenario_departments USING btree (scenario_id);


--
-- Name: scenario_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_descriptions_call_id_idx ON public.scenario_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: scenario_documents_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_documents_call_id_idx ON public.scenario_documents USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: scenario_fields_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_fields_call_id_idx ON public.scenario_fields USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: scenario_fields_field_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_fields_field_id_v7_idx ON public.scenario_fields USING btree (field_id);


--
-- Name: scenario_fields_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_fields_scenario_id_v7_idx ON public.scenario_fields USING btree (scenario_id);


--
-- Name: scenario_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_flags_call_id_idx ON public.scenario_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: scenario_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_group_id_idx ON public.scenario USING btree (group_id);


--
-- Name: scenario_groups_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_groups_group_id_v7_idx ON public.scenario_groups USING btree (group_id);


--
-- Name: scenario_groups_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_groups_scenario_id_v7_idx ON public.scenario_groups USING btree (scenario_id);


--
-- Name: scenario_images_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_images_call_id_idx ON public.scenario_images USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: scenario_images_image_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_images_image_id_v7_idx ON public.scenario_images USING btree (image_id);


--
-- Name: scenario_images_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_images_scenario_id_v7_idx ON public.scenario_images USING btree (scenario_id);


--
-- Name: scenario_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_names_call_id_idx ON public.scenario_names USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: scenario_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_names_name_id_idx ON public.scenario_names USING btree (name_id);


--
-- Name: scenario_names_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_names_scenario_id_idx ON public.scenario_names USING btree (scenario_id);


--
-- Name: scenario_objectives_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_objectives_call_id_idx ON public.scenario_objectives USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: scenario_objectives_objective_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_objectives_objective_id_v7_idx ON public.scenario_objectives USING btree (objective_id);


--
-- Name: scenario_objectives_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_objectives_scenario_id_v7_idx ON public.scenario_objectives USING btree (scenario_id);


--
-- Name: scenario_options_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_options_call_id_idx ON public.scenario_options USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: scenario_parameters_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_parameters_call_id_idx ON public.scenario_parameters USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: scenario_personas_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_personas_call_id_idx ON public.scenario_personas USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: scenario_problem_statements_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_problem_statements_call_id_idx ON public.scenario_problem_statements USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: scenario_problem_statements_problem_statement_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_problem_statements_problem_statement_id_v7_idx ON public.scenario_problem_statements USING btree (problem_statement_id);


--
-- Name: scenario_problem_statements_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_problem_statements_scenario_id_v7_idx ON public.scenario_problem_statements USING btree (scenario_id);


--
-- Name: scenario_questions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_questions_call_id_idx ON public.scenario_questions USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: scenario_templates_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_templates_call_id_idx ON public.scenario_templates USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: scenario_videos_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_videos_call_id_idx ON public.scenario_videos USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: scenario_videos_scenario_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_videos_scenario_id_v7_idx ON public.scenario_videos USING btree (scenario_id);


--
-- Name: scenario_videos_video_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenario_videos_video_id_v7_idx ON public.scenario_videos USING btree (video_id);


--
-- Name: scenarios_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scenarios_call_id_idx ON public.scenarios USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: schema_field_items_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schema_field_items_call_id_idx ON public.schema_field_items USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: schema_field_items_item_schema_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schema_field_items_item_schema_id_idx ON public.schema_field_items USING btree (item_schema_id);


--
-- Name: schema_field_items_schema_field_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schema_field_items_schema_field_id_idx ON public.schema_field_items USING btree (schema_field_id);


--
-- Name: schema_fields_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schema_fields_call_id_idx ON public.schema_fields USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: schemas_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schemas_call_id_idx ON public.schemas USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: setting_auths_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auths_call_id_idx ON public.setting_auths USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: setting_auths_settings_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_auths_settings_id_v7_idx ON public.setting_auths USING btree (settings_id);


--
-- Name: setting_colors_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_colors_call_id_idx ON public.setting_colors USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: setting_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_descriptions_call_id_idx ON public.setting_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: setting_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_descriptions_description_id_idx ON public.setting_descriptions USING btree (description_id);


--
-- Name: setting_descriptions_setting_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_descriptions_setting_id_idx ON public.setting_descriptions USING btree (setting_id);


--
-- Name: setting_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_flags_call_id_idx ON public.setting_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: setting_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_group_id_idx ON public.setting USING btree (group_id);


--
-- Name: setting_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_names_call_id_idx ON public.setting_names USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: setting_provider_keys_settings_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_provider_keys_settings_id_v7_idx ON public.setting_provider_keys USING btree (settings_id);


--
-- Name: setting_providers_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_providers_active_idx ON public.setting_providers USING btree (active);


--
-- Name: setting_providers_settings_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_providers_settings_id_v7_idx ON public.setting_providers USING btree (settings_id);


--
-- Name: setting_thresholds_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_thresholds_call_id_idx ON public.setting_thresholds USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: settings_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_call_id_idx ON public.settings USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: settings_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settings_created_at_idx ON public.setting USING btree (created_at);


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

CREATE INDEX settings_updated_at_idx ON public.setting USING btree (updated_at);


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
-- Name: simulation_departments_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_departments_call_id_idx ON public.simulation_departments USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: simulation_departments_department_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_departments_department_id_v7_idx ON public.simulation_departments USING btree (department_id);


--
-- Name: simulation_departments_simulation_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_departments_simulation_id_v7_idx ON public.simulation_departments USING btree (simulation_id);


--
-- Name: simulation_descriptions_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_descriptions_call_id_idx ON public.simulation_descriptions USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: simulation_descriptions_description_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_descriptions_description_id_idx ON public.simulation_descriptions USING btree (description_id);


--
-- Name: simulation_descriptions_simulation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_descriptions_simulation_id_idx ON public.simulation_descriptions USING btree (simulation_id);


--
-- Name: simulation_flags_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_flags_call_id_idx ON public.simulation_flags USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: simulation_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_group_id_idx ON public.simulation USING btree (group_id);


--
-- Name: simulation_names_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_names_call_id_idx ON public.simulation_names USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: simulation_names_name_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_names_name_id_idx ON public.simulation_names USING btree (name_id);


--
-- Name: simulation_names_simulation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_names_simulation_id_idx ON public.simulation_names USING btree (simulation_id);


--
-- Name: simulation_scenarios_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulation_scenarios_call_id_idx ON public.simulation_scenarios USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: simulations_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX simulations_call_id_idx ON public.simulations USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: slugs_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX slugs_call_id_idx ON public.slugs USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: slugs_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX slugs_value_idx ON public.slugs USING btree (value);


--
-- Name: standard_groups_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standard_groups_call_id_idx ON public.standard_groups USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: standards_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standards_group_idx ON public.standards USING btree (standard_group_id);


--
-- Name: standards_standard_group_id_v7_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standards_standard_group_id_v7_idx ON public.standards USING btree (standard_group_id);


--
-- Name: strengths_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX strengths_call_id_idx ON public.strengths USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: strengths_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX strengths_created_at_idx ON public.strengths USING btree (created_at);


--
-- Name: strengths_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX strengths_message_id_idx ON public.strengths USING btree (message_id);


--
-- Name: template_array_items_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX template_array_items_call_id_idx ON public.template_array_items USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: template_values_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX template_values_call_id_idx ON public.template_values USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: texts_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX texts_active_idx ON public.texts USING btree (active);


--
-- Name: texts_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX texts_call_id_idx ON public.texts USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: texts_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX texts_created_at_idx ON public.texts USING btree (created_at);


--
-- Name: thresholds_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX thresholds_call_id_idx ON public.thresholds USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: thresholds_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX thresholds_value_idx ON public.thresholds USING btree (value);


--
-- Name: times_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX times_active_idx ON public.times USING btree (active);


--
-- Name: times_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX times_call_id_idx ON public.times USING btree (call_id) WHERE (call_id IS NOT NULL);


--
-- Name: times_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX times_created_at_idx ON public.times USING btree (created_at);


--
-- Name: times_time_taken_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX times_time_taken_idx ON public.times USING btree (time_taken);


--
-- Name: tool_calls_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_calls_created_at_idx ON public.calls USING btree (created_at);


--
-- Name: tool_calls_tool_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_calls_tool_id_idx ON public.calls USING btree (tool_id);


--
-- Name: tool_domains_domain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_domains_domain_id_idx ON public.tool_domains USING btree (domain_id);


--
-- Name: tool_domains_tool_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_domains_tool_id_idx ON public.tool_domains USING btree (tool_id);


--
-- Name: tool_schemas_schema_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_schemas_schema_id_idx ON public.tool_schemas USING btree (schema_id);


--
-- Name: tool_schemas_tool_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_schemas_tool_id_idx ON public.tool_schemas USING btree (tool_id);


--
-- Name: tool_templates_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_templates_template_id_idx ON public.tool_templates USING btree (template_id);


--
-- Name: tool_templates_tool_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_templates_tool_id_idx ON public.tool_templates USING btree (tool_id);


--
-- Name: tools_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tools_active_idx ON public.tool USING btree (active);


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
-- Name: videos_call_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX videos_call_id_idx ON public.videos USING btree (call_id) WHERE (call_id IS NOT NULL);


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
-- Name: agent trg_audit_agents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_agents AFTER INSERT OR DELETE OR UPDATE ON public.agent FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: cohort trg_audit_cohorts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_cohorts AFTER INSERT OR DELETE OR UPDATE ON public.cohort FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: debug_info trg_audit_debug_info; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_debug_info AFTER INSERT OR DELETE OR UPDATE ON public.debug_info FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: department trg_audit_departments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_departments AFTER INSERT OR DELETE OR UPDATE ON public.department FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: document trg_audit_documents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_documents AFTER INSERT OR DELETE OR UPDATE ON public.document FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: field trg_audit_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_fields AFTER INSERT OR DELETE OR UPDATE ON public.field FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: run trg_audit_model_runs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_model_runs AFTER INSERT OR DELETE OR UPDATE ON public.run FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: model trg_audit_models; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_models AFTER INSERT OR DELETE OR UPDATE ON public.model FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: parameter trg_audit_parameters; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_parameters AFTER INSERT OR DELETE OR UPDATE ON public.parameter FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: persona trg_audit_personas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_personas AFTER INSERT OR DELETE OR UPDATE ON public.persona FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: profile trg_audit_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_profiles AFTER INSERT OR DELETE OR UPDATE ON public.profile FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: rubric trg_audit_rubrics; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_rubrics AFTER INSERT OR DELETE OR UPDATE ON public.rubric FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: scenario trg_audit_scenarios; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_scenarios AFTER INSERT OR DELETE OR UPDATE ON public.scenario FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: simulation_attempts trg_audit_simulation_attempts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_simulation_attempts AFTER INSERT OR DELETE OR UPDATE ON public.simulation_attempts FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: chat trg_audit_simulation_chats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_simulation_chats AFTER INSERT OR DELETE OR UPDATE ON public.chat FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


--
-- Name: simulation trg_audit_simulations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_simulations AFTER INSERT OR DELETE OR UPDATE ON public.simulation FOR EACH ROW EXECUTE FUNCTION audit.log_row_change('id');


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
    ADD CONSTRAINT activity_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id);


--
-- Name: agent_department_prompts agent_department_prompts_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_department_prompts
    ADD CONSTRAINT agent_department_prompts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id);


--
-- Name: agent_department_prompts agent_department_prompts_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_department_prompts
    ADD CONSTRAINT agent_department_prompts_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: agent_department_prompts agent_department_prompts_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_department_prompts
    ADD CONSTRAINT agent_department_prompts_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: agent_department_prompts agent_department_prompts_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_department_prompts
    ADD CONSTRAINT agent_department_prompts_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id);


--
-- Name: agent_departments agent_departments_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_departments
    ADD CONSTRAINT agent_departments_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id);


--
-- Name: agent_departments agent_departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_departments
    ADD CONSTRAINT agent_departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: agent_descriptions agent_descriptions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_descriptions
    ADD CONSTRAINT agent_descriptions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id) ON DELETE CASCADE;


--
-- Name: agent_descriptions agent_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_descriptions
    ADD CONSTRAINT agent_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: agent_descriptions agent_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_descriptions
    ADD CONSTRAINT agent_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: agent_instructions agent_developer_instructions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_instructions
    ADD CONSTRAINT agent_developer_instructions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id) ON DELETE CASCADE;


--
-- Name: agent_domains agent_domains_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_domains
    ADD CONSTRAINT agent_domains_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id) ON DELETE CASCADE;


--
-- Name: agent_domains agent_domains_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_domains
    ADD CONSTRAINT agent_domains_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: agent_flags agent_flags_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_flags
    ADD CONSTRAINT agent_flags_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id) ON DELETE CASCADE;


--
-- Name: agent_flags agent_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_flags
    ADD CONSTRAINT agent_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: agent_flags agent_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_flags
    ADD CONSTRAINT agent_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: agent agent_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent
    ADD CONSTRAINT agent_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: agent_instructions agent_instructions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_instructions
    ADD CONSTRAINT agent_instructions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: agent_instructions agent_instructions_instruction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_instructions
    ADD CONSTRAINT agent_instructions_instruction_id_fkey FOREIGN KEY (instruction_id) REFERENCES public.instructions(id) ON DELETE CASCADE;


--
-- Name: agent_models agent_models_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_models
    ADD CONSTRAINT agent_models_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id) ON DELETE CASCADE;


--
-- Name: agent_models agent_models_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_models
    ADD CONSTRAINT agent_models_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: agent_names agent_names_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_names
    ADD CONSTRAINT agent_names_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id) ON DELETE CASCADE;


--
-- Name: agent_names agent_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_names
    ADD CONSTRAINT agent_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: agent_names agent_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_names
    ADD CONSTRAINT agent_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: agent_prompts agent_prompts_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_prompts
    ADD CONSTRAINT agent_prompts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id);


--
-- Name: agent_prompts agent_prompts_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_prompts
    ADD CONSTRAINT agent_prompts_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: agent_prompts agent_prompts_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_prompts
    ADD CONSTRAINT agent_prompts_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id);


--
-- Name: agent_reasoning_levels agent_reasoning_levels_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_reasoning_levels
    ADD CONSTRAINT agent_reasoning_levels_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id);


--
-- Name: agent_reasoning_levels agent_reasoning_levels_model_reasoning_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_reasoning_levels
    ADD CONSTRAINT agent_reasoning_levels_model_reasoning_level_id_fkey FOREIGN KEY (model_reasoning_level_id) REFERENCES public.model_reasoning_levels(id);


--
-- Name: agent_temperature_levels agent_temperature_levels_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_temperature_levels
    ADD CONSTRAINT agent_temperature_levels_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id);


--
-- Name: agent_temperature_levels agent_temperature_levels_model_temperature_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_temperature_levels
    ADD CONSTRAINT agent_temperature_levels_model_temperature_level_id_fkey FOREIGN KEY (model_temperature_level_id) REFERENCES public.model_temperature_levels(id);


--
-- Name: agent_tools agent_tools_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tools
    ADD CONSTRAINT agent_tools_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id) ON DELETE CASCADE;


--
-- Name: agent_tools agent_tools_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tools
    ADD CONSTRAINT agent_tools_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tool(id) ON DELETE CASCADE;


--
-- Name: agent_voices agent_voices_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_voices
    ADD CONSTRAINT agent_voices_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id);


--
-- Name: agent_voices agent_voices_model_voice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_voices
    ADD CONSTRAINT agent_voices_model_voice_id_fkey FOREIGN KEY (model_voice_id) REFERENCES public.model_voices(id);


--
-- Name: agents agents_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id);


--
-- Name: agents agents_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: analyses analyses_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analyses
    ADD CONSTRAINT analyses_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: attempt_chats attempt_chats_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_chats
    ADD CONSTRAINT attempt_chats_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.simulation_attempts(id);


--
-- Name: attempt_chats attempt_chats_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_chats
    ADD CONSTRAINT attempt_chats_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat(id);


--
-- Name: attempt_profiles attempt_profiles_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_profiles
    ADD CONSTRAINT attempt_profiles_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.simulation_attempts(id);


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
-- Name: audio_uploads audio_uploads_audio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_uploads
    ADD CONSTRAINT audio_uploads_audio_id_fkey FOREIGN KEY (audio_id) REFERENCES public.audios(id) ON DELETE CASCADE;


--
-- Name: audio_uploads audio_uploads_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_uploads
    ADD CONSTRAINT audio_uploads_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id) ON DELETE CASCADE;


--
-- Name: audios audios_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audios
    ADD CONSTRAINT audios_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


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
-- Name: auth auth_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth
    ADD CONSTRAINT auth_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: auth_items auth_items_new_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_items
    ADD CONSTRAINT auth_items_new_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id) ON DELETE CASCADE;


--
-- Name: auth_items auth_items_new_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_items
    ADD CONSTRAINT auth_items_new_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


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
-- Name: auth_protocols auth_protocols_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_protocols
    ADD CONSTRAINT auth_protocols_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id) ON DELETE CASCADE;


--
-- Name: auth_protocols auth_protocols_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_protocols
    ADD CONSTRAINT auth_protocols_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.protocols(id) ON DELETE CASCADE;


--
-- Name: auth_slugs auth_slugs_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_slugs
    ADD CONSTRAINT auth_slugs_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id) ON DELETE CASCADE;


--
-- Name: auth_slugs auth_slugs_slug_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_slugs
    ADD CONSTRAINT auth_slugs_slug_id_fkey FOREIGN KEY (slug_id) REFERENCES public.slugs(id) ON DELETE CASCADE;


--
-- Name: auths auths_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auths
    ADD CONSTRAINT auths_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id);


--
-- Name: auths auths_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auths
    ADD CONSTRAINT auths_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: calls calls_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id);


--
-- Name: calls calls_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tool(id);


--
-- Name: chat_conversations chat_conversations_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat(id) ON DELETE CASCADE;


--
-- Name: chat_conversations chat_conversations_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: chat_groups chat_groups_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_groups
    ADD CONSTRAINT chat_groups_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat(id);


--
-- Name: chat_groups chat_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_groups
    ADD CONSTRAINT chat_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: chat_responses chat_responses_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_responses
    ADD CONSTRAINT chat_responses_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat(id) ON DELETE CASCADE;


--
-- Name: chat_responses chat_responses_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_responses
    ADD CONSTRAINT chat_responses_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.responses(id) ON DELETE CASCADE;


--
-- Name: chat chats_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat
    ADD CONSTRAINT chats_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: cohort_departments cohort_departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_departments
    ADD CONSTRAINT cohort_departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: cohort_departments cohort_departments_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_departments
    ADD CONSTRAINT cohort_departments_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohort(id);


--
-- Name: cohort_descriptions cohort_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_descriptions
    ADD CONSTRAINT cohort_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: cohort_descriptions cohort_descriptions_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_descriptions
    ADD CONSTRAINT cohort_descriptions_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohort(id) ON DELETE CASCADE;


--
-- Name: cohort_descriptions cohort_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_descriptions
    ADD CONSTRAINT cohort_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: cohort_flags cohort_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_flags
    ADD CONSTRAINT cohort_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: cohort_flags cohort_flags_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_flags
    ADD CONSTRAINT cohort_flags_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohort(id) ON DELETE CASCADE;


--
-- Name: cohort_flags cohort_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_flags
    ADD CONSTRAINT cohort_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: cohort cohort_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort
    ADD CONSTRAINT cohort_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: cohort_names cohort_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_names
    ADD CONSTRAINT cohort_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: cohort_names cohort_names_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_names
    ADD CONSTRAINT cohort_names_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohort(id) ON DELETE CASCADE;


--
-- Name: cohort_names cohort_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_names
    ADD CONSTRAINT cohort_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: cohort_profiles cohort_profiles_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_profiles
    ADD CONSTRAINT cohort_profiles_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: cohort_profiles cohort_profiles_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_profiles
    ADD CONSTRAINT cohort_profiles_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohort(id);


--
-- Name: cohort_simulations cohort_simulations_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_simulations
    ADD CONSTRAINT cohort_simulations_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: cohort_simulations cohort_simulations_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_simulations
    ADD CONSTRAINT cohort_simulations_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohort(id);


--
-- Name: cohorts cohorts_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohorts
    ADD CONSTRAINT cohorts_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: cohorts cohorts_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohorts
    ADD CONSTRAINT cohorts_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohort(id);


--
-- Name: colors colors_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: contents content_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT content_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: conversations conversations_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: debug_info debug_info_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debug_info
    ADD CONSTRAINT debug_info_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: department_descriptions department_descriptions_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_descriptions
    ADD CONSTRAINT department_descriptions_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id) ON DELETE CASCADE;


--
-- Name: department_descriptions department_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_descriptions
    ADD CONSTRAINT department_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: department_flags department_flags_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_flags
    ADD CONSTRAINT department_flags_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id) ON DELETE CASCADE;


--
-- Name: department_flags department_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_flags
    ADD CONSTRAINT department_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: department department_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: department_names department_names_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_names
    ADD CONSTRAINT department_names_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id) ON DELETE CASCADE;


--
-- Name: department_names department_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_names
    ADD CONSTRAINT department_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: department_settings department_settings_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_settings
    ADD CONSTRAINT department_settings_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: department_settings department_settings_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_settings
    ADD CONSTRAINT department_settings_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.setting(id);


--
-- Name: departments departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: departments departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: descriptions descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descriptions
    ADD CONSTRAINT descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


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
    ADD CONSTRAINT document_agent_domains_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: document_departments document_departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_departments
    ADD CONSTRAINT document_departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: document_departments document_departments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_departments
    ADD CONSTRAINT document_departments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id);


--
-- Name: document_descriptions document_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_descriptions
    ADD CONSTRAINT document_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: document_descriptions document_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_descriptions
    ADD CONSTRAINT document_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: document_descriptions document_descriptions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_descriptions
    ADD CONSTRAINT document_descriptions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: document_fields document_fields_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_fields
    ADD CONSTRAINT document_fields_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: document_fields document_fields_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_fields
    ADD CONSTRAINT document_fields_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id);


--
-- Name: document_flags document_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_flags
    ADD CONSTRAINT document_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: document_flags document_flags_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_flags
    ADD CONSTRAINT document_flags_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: document_flags document_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_flags
    ADD CONSTRAINT document_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: document document_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: document_groups document_groups_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_groups
    ADD CONSTRAINT document_groups_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id);


--
-- Name: document_groups document_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_groups
    ADD CONSTRAINT document_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: document_html document_html_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_html
    ADD CONSTRAINT document_html_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: document_html document_html_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_html
    ADD CONSTRAINT document_html_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: document_html document_html_html_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_html
    ADD CONSTRAINT document_html_html_id_fkey FOREIGN KEY (html_id) REFERENCES public.html(id) ON DELETE CASCADE;


--
-- Name: document_names document_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_names
    ADD CONSTRAINT document_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: document_names document_names_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_names
    ADD CONSTRAINT document_names_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: document_names document_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_names
    ADD CONSTRAINT document_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: document_schemas document_schemas_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_schemas
    ADD CONSTRAINT document_schemas_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: document_schemas document_schemas_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_schemas
    ADD CONSTRAINT document_schemas_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: document_schemas document_schemas_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_schemas
    ADD CONSTRAINT document_schemas_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.schemas(id) ON DELETE CASCADE;


--
-- Name: document_templates document_templates_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: document_templates document_templates_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id);


--
-- Name: document_templates document_templates_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id);


--
-- Name: document_tree document_tree_child_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tree
    ADD CONSTRAINT document_tree_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.document(id);


--
-- Name: document_tree document_tree_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tree
    ADD CONSTRAINT document_tree_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.document(id);


--
-- Name: document_uploads document_uploads_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_uploads
    ADD CONSTRAINT document_uploads_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id);


--
-- Name: document_uploads document_uploads_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_uploads
    ADD CONSTRAINT document_uploads_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads(id);


--
-- Name: documents documents_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: documents documents_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id);


--
-- Name: domain_artifacts domain_artifacts_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_artifacts
    ADD CONSTRAINT domain_artifacts_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: draft_agents draft_agents_agents_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_agents
    ADD CONSTRAINT draft_agents_agents_id_fkey FOREIGN KEY (agents_id) REFERENCES public.agent(id) ON DELETE CASCADE;


--
-- Name: draft_agents draft_agents_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_agents
    ADD CONSTRAINT draft_agents_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_analyses draft_analyses_analyses_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_analyses
    ADD CONSTRAINT draft_analyses_analyses_id_fkey FOREIGN KEY (analyses_id) REFERENCES public.analyses(id) ON DELETE CASCADE;


--
-- Name: draft_analyses draft_analyses_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_analyses
    ADD CONSTRAINT draft_analyses_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_auth draft_auth_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_auth
    ADD CONSTRAINT draft_auth_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id) ON DELETE CASCADE;


--
-- Name: draft_auth draft_auth_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_auth
    ADD CONSTRAINT draft_auth_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_cohorts draft_cohorts_cohorts_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_cohorts
    ADD CONSTRAINT draft_cohorts_cohorts_id_fkey FOREIGN KEY (cohorts_id) REFERENCES public.cohort(id) ON DELETE CASCADE;


--
-- Name: draft_cohorts draft_cohorts_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_cohorts
    ADD CONSTRAINT draft_cohorts_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_colors draft_colors_colors_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_colors
    ADD CONSTRAINT draft_colors_colors_id_fkey FOREIGN KEY (colors_id) REFERENCES public.colors(id) ON DELETE CASCADE;


--
-- Name: draft_colors draft_colors_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_colors
    ADD CONSTRAINT draft_colors_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_content draft_content_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_content
    ADD CONSTRAINT draft_content_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.contents(id) ON DELETE CASCADE;


--
-- Name: draft_content draft_content_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_content
    ADD CONSTRAINT draft_content_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_conversations draft_conversations_conversations_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_conversations
    ADD CONSTRAINT draft_conversations_conversations_id_fkey FOREIGN KEY (conversations_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: draft_conversations draft_conversations_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_conversations
    ADD CONSTRAINT draft_conversations_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_debug_info draft_debug_info_debug_info_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_debug_info
    ADD CONSTRAINT draft_debug_info_debug_info_id_fkey FOREIGN KEY (debug_info_id) REFERENCES public.debug_info(id) ON DELETE CASCADE;


--
-- Name: draft_debug_info draft_debug_info_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_debug_info
    ADD CONSTRAINT draft_debug_info_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_departments draft_departments_departments_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_departments
    ADD CONSTRAINT draft_departments_departments_id_fkey FOREIGN KEY (departments_id) REFERENCES public.department(id) ON DELETE CASCADE;


--
-- Name: draft_departments draft_departments_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_departments
    ADD CONSTRAINT draft_departments_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_descriptions draft_descriptions_descriptions_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_descriptions
    ADD CONSTRAINT draft_descriptions_descriptions_id_fkey FOREIGN KEY (descriptions_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: draft_descriptions draft_descriptions_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_descriptions
    ADD CONSTRAINT draft_descriptions_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_documents draft_documents_documents_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_documents
    ADD CONSTRAINT draft_documents_documents_id_fkey FOREIGN KEY (documents_id) REFERENCES public.document(id) ON DELETE CASCADE;


--
-- Name: draft_documents draft_documents_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_documents
    ADD CONSTRAINT draft_documents_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_endpoints draft_endpoints_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_endpoints
    ADD CONSTRAINT draft_endpoints_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_endpoints draft_endpoints_endpoints_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_endpoints
    ADD CONSTRAINT draft_endpoints_endpoints_id_fkey FOREIGN KEY (endpoints_id) REFERENCES public.endpoints(id) ON DELETE CASCADE;


--
-- Name: draft_evals draft_evals_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_evals
    ADD CONSTRAINT draft_evals_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_evals draft_evals_evals_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_evals
    ADD CONSTRAINT draft_evals_evals_id_fkey FOREIGN KEY (evals_id) REFERENCES public.eval(id) ON DELETE CASCADE;


--
-- Name: draft_examples draft_examples_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_examples
    ADD CONSTRAINT draft_examples_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_examples draft_examples_examples_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_examples
    ADD CONSTRAINT draft_examples_examples_id_fkey FOREIGN KEY (examples_id) REFERENCES public.examples(id) ON DELETE CASCADE;


--
-- Name: draft_feedbacks draft_feedbacks_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_feedbacks
    ADD CONSTRAINT draft_feedbacks_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_feedbacks draft_feedbacks_feedbacks_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_feedbacks
    ADD CONSTRAINT draft_feedbacks_feedbacks_id_fkey FOREIGN KEY (feedbacks_id) REFERENCES public.feedbacks(id) ON DELETE CASCADE;


--
-- Name: draft_fields draft_fields_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_fields
    ADD CONSTRAINT draft_fields_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_fields draft_fields_fields_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_fields
    ADD CONSTRAINT draft_fields_fields_id_fkey FOREIGN KEY (fields_id) REFERENCES public.field(id) ON DELETE CASCADE;


--
-- Name: draft_flags draft_flags_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_flags
    ADD CONSTRAINT draft_flags_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_flags draft_flags_flags_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_flags
    ADD CONSTRAINT draft_flags_flags_id_fkey FOREIGN KEY (flags_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: draft_hints draft_hints_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_hints
    ADD CONSTRAINT draft_hints_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_hints draft_hints_hints_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_hints
    ADD CONSTRAINT draft_hints_hints_id_fkey FOREIGN KEY (hints_id) REFERENCES public.hints(id) ON DELETE CASCADE;


--
-- Name: draft_html draft_html_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_html
    ADD CONSTRAINT draft_html_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_html draft_html_html_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_html
    ADD CONSTRAINT draft_html_html_id_fkey FOREIGN KEY (html_id) REFERENCES public.html(id) ON DELETE CASCADE;


--
-- Name: draft_icons draft_icons_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_icons
    ADD CONSTRAINT draft_icons_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_icons draft_icons_icons_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_icons
    ADD CONSTRAINT draft_icons_icons_id_fkey FOREIGN KEY (icons_id) REFERENCES public.icons(id) ON DELETE CASCADE;


--
-- Name: draft_images draft_images_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_images
    ADD CONSTRAINT draft_images_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_images draft_images_images_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_images
    ADD CONSTRAINT draft_images_images_id_fkey FOREIGN KEY (images_id) REFERENCES public.images(id) ON DELETE CASCADE;


--
-- Name: draft_improvements draft_improvements_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_improvements
    ADD CONSTRAINT draft_improvements_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_improvements draft_improvements_improvements_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_improvements
    ADD CONSTRAINT draft_improvements_improvements_id_fkey FOREIGN KEY (improvements_id) REFERENCES public.improvements(id) ON DELETE CASCADE;


--
-- Name: draft_instructions draft_instructions_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_instructions
    ADD CONSTRAINT draft_instructions_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_instructions draft_instructions_instructions_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_instructions
    ADD CONSTRAINT draft_instructions_instructions_id_fkey FOREIGN KEY (instructions_id) REFERENCES public.instructions(id) ON DELETE CASCADE;


--
-- Name: draft_items draft_items_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_items
    ADD CONSTRAINT draft_items_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_items draft_items_items_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_items
    ADD CONSTRAINT draft_items_items_id_fkey FOREIGN KEY (items_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: draft_keys draft_keys_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_keys
    ADD CONSTRAINT draft_keys_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_keys draft_keys_keys_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_keys
    ADD CONSTRAINT draft_keys_keys_id_fkey FOREIGN KEY (keys_id) REFERENCES public.key(id) ON DELETE CASCADE;


--
-- Name: draft_models draft_models_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_models
    ADD CONSTRAINT draft_models_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_models draft_models_models_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_models
    ADD CONSTRAINT draft_models_models_id_fkey FOREIGN KEY (models_id) REFERENCES public.model(id) ON DELETE CASCADE;


--
-- Name: draft_names draft_names_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_names
    ADD CONSTRAINT draft_names_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_names draft_names_names_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_names
    ADD CONSTRAINT draft_names_names_id_fkey FOREIGN KEY (names_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: draft_objectives draft_objectives_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_objectives
    ADD CONSTRAINT draft_objectives_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_objectives draft_objectives_objectives_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_objectives
    ADD CONSTRAINT draft_objectives_objectives_id_fkey FOREIGN KEY (objectives_id) REFERENCES public.objectives(id) ON DELETE CASCADE;


--
-- Name: draft_options draft_options_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_options
    ADD CONSTRAINT draft_options_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_options draft_options_options_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_options
    ADD CONSTRAINT draft_options_options_id_fkey FOREIGN KEY (options_id) REFERENCES public.options(id) ON DELETE CASCADE;


--
-- Name: draft_parameters draft_parameters_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_parameters
    ADD CONSTRAINT draft_parameters_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_parameters draft_parameters_parameters_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_parameters
    ADD CONSTRAINT draft_parameters_parameters_id_fkey FOREIGN KEY (parameters_id) REFERENCES public.parameter(id) ON DELETE CASCADE;


--
-- Name: draft_personas draft_personas_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_personas
    ADD CONSTRAINT draft_personas_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_personas draft_personas_personas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_personas
    ADD CONSTRAINT draft_personas_personas_id_fkey FOREIGN KEY (personas_id) REFERENCES public.persona(id) ON DELETE CASCADE;


--
-- Name: draft_points draft_points_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_points
    ADD CONSTRAINT draft_points_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_points draft_points_points_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_points
    ADD CONSTRAINT draft_points_points_id_fkey FOREIGN KEY (points_id) REFERENCES public.points(id) ON DELETE CASCADE;


--
-- Name: draft_problem_statements draft_problem_statements_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_problem_statements
    ADD CONSTRAINT draft_problem_statements_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_problem_statements draft_problem_statements_problem_statements_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_problem_statements
    ADD CONSTRAINT draft_problem_statements_problem_statements_id_fkey FOREIGN KEY (problem_statements_id) REFERENCES public.problem_statements(id) ON DELETE CASCADE;


--
-- Name: draft_profiles draft_profiles_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_profiles
    ADD CONSTRAINT draft_profiles_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_profiles draft_profiles_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_profiles
    ADD CONSTRAINT draft_profiles_profiles_id_fkey FOREIGN KEY (profiles_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: draft_prompts draft_prompts_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_prompts
    ADD CONSTRAINT draft_prompts_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_prompts draft_prompts_prompts_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_prompts
    ADD CONSTRAINT draft_prompts_prompts_id_fkey FOREIGN KEY (prompts_id) REFERENCES public.prompts(id) ON DELETE CASCADE;


--
-- Name: draft_protocols draft_protocols_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_protocols
    ADD CONSTRAINT draft_protocols_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_protocols draft_protocols_protocols_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_protocols
    ADD CONSTRAINT draft_protocols_protocols_id_fkey FOREIGN KEY (protocols_id) REFERENCES public.protocols(id) ON DELETE CASCADE;


--
-- Name: draft_providers draft_providers_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_providers
    ADD CONSTRAINT draft_providers_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_providers draft_providers_providers_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_providers
    ADD CONSTRAINT draft_providers_providers_id_fkey FOREIGN KEY (providers_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: draft_questions draft_questions_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_questions
    ADD CONSTRAINT draft_questions_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_questions draft_questions_questions_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_questions
    ADD CONSTRAINT draft_questions_questions_id_fkey FOREIGN KEY (questions_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: draft_responses draft_responses_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_responses
    ADD CONSTRAINT draft_responses_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_responses draft_responses_responses_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_responses
    ADD CONSTRAINT draft_responses_responses_id_fkey FOREIGN KEY (responses_id) REFERENCES public.responses(id) ON DELETE CASCADE;


--
-- Name: draft_rubrics draft_rubrics_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_rubrics
    ADD CONSTRAINT draft_rubrics_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_rubrics draft_rubrics_rubrics_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_rubrics
    ADD CONSTRAINT draft_rubrics_rubrics_id_fkey FOREIGN KEY (rubrics_id) REFERENCES public.rubric(id) ON DELETE CASCADE;


--
-- Name: draft_scenarios draft_scenarios_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_scenarios
    ADD CONSTRAINT draft_scenarios_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_scenarios draft_scenarios_scenarios_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_scenarios
    ADD CONSTRAINT draft_scenarios_scenarios_id_fkey FOREIGN KEY (scenarios_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: draft_schema_field_items draft_schema_field_items_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_schema_field_items
    ADD CONSTRAINT draft_schema_field_items_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_schema_field_items draft_schema_field_items_schema_field_items_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_schema_field_items
    ADD CONSTRAINT draft_schema_field_items_schema_field_items_id_fkey FOREIGN KEY (schema_field_items_id) REFERENCES public.schema_field_items(id) ON DELETE CASCADE;


--
-- Name: draft_schema_fields draft_schema_fields_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_schema_fields
    ADD CONSTRAINT draft_schema_fields_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_schema_fields draft_schema_fields_schema_fields_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_schema_fields
    ADD CONSTRAINT draft_schema_fields_schema_fields_id_fkey FOREIGN KEY (schema_fields_id) REFERENCES public.schema_fields(id) ON DELETE CASCADE;


--
-- Name: draft_schemas draft_schemas_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_schemas
    ADD CONSTRAINT draft_schemas_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_schemas draft_schemas_schemas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_schemas
    ADD CONSTRAINT draft_schemas_schemas_id_fkey FOREIGN KEY (schemas_id) REFERENCES public.schemas(id) ON DELETE CASCADE;


--
-- Name: draft_settings draft_settings_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_settings
    ADD CONSTRAINT draft_settings_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_settings draft_settings_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_settings
    ADD CONSTRAINT draft_settings_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.setting(id) ON DELETE CASCADE;


--
-- Name: draft_simulations draft_simulations_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_simulations
    ADD CONSTRAINT draft_simulations_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_simulations draft_simulations_simulations_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_simulations
    ADD CONSTRAINT draft_simulations_simulations_id_fkey FOREIGN KEY (simulations_id) REFERENCES public.simulation(id) ON DELETE CASCADE;


--
-- Name: draft_slugs draft_slugs_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_slugs
    ADD CONSTRAINT draft_slugs_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_slugs draft_slugs_slugs_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_slugs
    ADD CONSTRAINT draft_slugs_slugs_id_fkey FOREIGN KEY (slugs_id) REFERENCES public.slugs(id) ON DELETE CASCADE;


--
-- Name: draft_standard_groups draft_standard_groups_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_standard_groups
    ADD CONSTRAINT draft_standard_groups_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_standard_groups draft_standard_groups_standard_groups_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_standard_groups
    ADD CONSTRAINT draft_standard_groups_standard_groups_id_fkey FOREIGN KEY (standard_groups_id) REFERENCES public.standard_groups(id) ON DELETE CASCADE;


--
-- Name: draft_strengths draft_strengths_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_strengths
    ADD CONSTRAINT draft_strengths_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_strengths draft_strengths_strengths_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_strengths
    ADD CONSTRAINT draft_strengths_strengths_id_fkey FOREIGN KEY (strengths_id) REFERENCES public.strengths(id) ON DELETE CASCADE;


--
-- Name: draft_template_array_items draft_template_array_items_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_template_array_items
    ADD CONSTRAINT draft_template_array_items_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_template_array_items draft_template_array_items_template_array_items_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_template_array_items
    ADD CONSTRAINT draft_template_array_items_template_array_items_id_fkey FOREIGN KEY (template_array_items_id) REFERENCES public.template_array_items(id) ON DELETE CASCADE;


--
-- Name: draft_template_values draft_template_values_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_template_values
    ADD CONSTRAINT draft_template_values_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_template_values draft_template_values_template_values_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_template_values
    ADD CONSTRAINT draft_template_values_template_values_id_fkey FOREIGN KEY (template_values_id) REFERENCES public.template_values(id) ON DELETE CASCADE;


--
-- Name: draft_templates draft_templates_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_templates
    ADD CONSTRAINT draft_templates_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_templates draft_templates_templates_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_templates
    ADD CONSTRAINT draft_templates_templates_id_fkey FOREIGN KEY (templates_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: draft_thresholds draft_thresholds_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_thresholds
    ADD CONSTRAINT draft_thresholds_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_thresholds draft_thresholds_thresholds_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_thresholds
    ADD CONSTRAINT draft_thresholds_thresholds_id_fkey FOREIGN KEY (thresholds_id) REFERENCES public.thresholds(id) ON DELETE CASCADE;


--
-- Name: draft_times draft_times_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_times
    ADD CONSTRAINT draft_times_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_times draft_times_times_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_times
    ADD CONSTRAINT draft_times_times_id_fkey FOREIGN KEY (times_id) REFERENCES public.times(id) ON DELETE CASCADE;


--
-- Name: draft_videos draft_videos_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_videos
    ADD CONSTRAINT draft_videos_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: draft_videos draft_videos_videos_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_videos
    ADD CONSTRAINT draft_videos_videos_id_fkey FOREIGN KEY (videos_id) REFERENCES public.videos(id) ON DELETE CASCADE;


--
-- Name: drafts drafts_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: drafts drafts_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id);


--
-- Name: endpoints endpoints_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endpoints
    ADD CONSTRAINT endpoints_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: eval_agents eval_agents_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_agents
    ADD CONSTRAINT eval_agents_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: eval_agents eval_agents_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_agents
    ADD CONSTRAINT eval_agents_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.eval(id) ON DELETE CASCADE;


--
-- Name: eval_attempts eval_attempts_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_attempts
    ADD CONSTRAINT eval_attempts_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.eval(id);


--
-- Name: eval_departments eval_departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_departments
    ADD CONSTRAINT eval_departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: eval_departments eval_departments_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_departments
    ADD CONSTRAINT eval_departments_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.eval(id);


--
-- Name: eval_descriptions eval_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_descriptions
    ADD CONSTRAINT eval_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: eval_descriptions eval_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_descriptions
    ADD CONSTRAINT eval_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: eval_descriptions eval_descriptions_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_descriptions
    ADD CONSTRAINT eval_descriptions_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.eval(id) ON DELETE CASCADE;


--
-- Name: eval_flags eval_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_flags
    ADD CONSTRAINT eval_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: eval_flags eval_flags_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_flags
    ADD CONSTRAINT eval_flags_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.eval(id) ON DELETE CASCADE;


--
-- Name: eval_flags eval_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_flags
    ADD CONSTRAINT eval_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: eval eval_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval
    ADD CONSTRAINT eval_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: eval_groups eval_groups_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_groups
    ADD CONSTRAINT eval_groups_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.eval(id) ON DELETE CASCADE;


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
-- Name: eval_names eval_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_names
    ADD CONSTRAINT eval_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: eval_names eval_names_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_names
    ADD CONSTRAINT eval_names_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.eval(id) ON DELETE CASCADE;


--
-- Name: eval_names eval_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_names
    ADD CONSTRAINT eval_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: eval_runs eval_runs_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs
    ADD CONSTRAINT eval_runs_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.eval(id);


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
    ADD CONSTRAINT eval_runs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.run(id);


--
-- Name: evals evals_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evals
    ADD CONSTRAINT evals_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: evals evals_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evals
    ADD CONSTRAINT evals_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.eval(id);


--
-- Name: examples examples_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examples
    ADD CONSTRAINT examples_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: feedbacks feedbacks_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: feedbacks feedbacks_standard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_standard_id_fkey FOREIGN KEY (standard_id) REFERENCES public.standards(id);


--
-- Name: field_conditional_parameters field_conditional_parameters_conditional_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_conditional_parameters
    ADD CONSTRAINT field_conditional_parameters_conditional_parameter_id_fkey FOREIGN KEY (conditional_parameter_id) REFERENCES public.parameter(id);


--
-- Name: field_conditional_parameters field_conditional_parameters_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_conditional_parameters
    ADD CONSTRAINT field_conditional_parameters_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.field(id);


--
-- Name: field_departments field_departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_departments
    ADD CONSTRAINT field_departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: field_departments field_departments_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_departments
    ADD CONSTRAINT field_departments_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.field(id);


--
-- Name: field_descriptions field_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_descriptions
    ADD CONSTRAINT field_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: field_descriptions field_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_descriptions
    ADD CONSTRAINT field_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: field_descriptions field_descriptions_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_descriptions
    ADD CONSTRAINT field_descriptions_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.field(id) ON DELETE CASCADE;


--
-- Name: field_flags field_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_flags
    ADD CONSTRAINT field_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: field_flags field_flags_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_flags
    ADD CONSTRAINT field_flags_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.field(id) ON DELETE CASCADE;


--
-- Name: field_flags field_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_flags
    ADD CONSTRAINT field_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: field field_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field
    ADD CONSTRAINT field_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: field_names field_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_names
    ADD CONSTRAINT field_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: field_names field_names_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_names
    ADD CONSTRAINT field_names_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.field(id) ON DELETE CASCADE;


--
-- Name: field_names field_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_names
    ADD CONSTRAINT field_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: fields fields_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fields
    ADD CONSTRAINT fields_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: fields fields_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fields
    ADD CONSTRAINT fields_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.field(id);


--
-- Name: flags flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flags
    ADD CONSTRAINT flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


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
    ADD CONSTRAINT grade_analyses_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grade(id) ON DELETE CASCADE;


--
-- Name: grade_feedbacks grade_feedbacks_feedback_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_feedbacks
    ADD CONSTRAINT grade_feedbacks_feedback_id_fkey FOREIGN KEY (feedback_id) REFERENCES public.feedbacks(id) ON DELETE CASCADE;


--
-- Name: grade_feedbacks grade_feedbacks_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_feedbacks
    ADD CONSTRAINT grade_feedbacks_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grade(id) ON DELETE CASCADE;


--
-- Name: grade_groups grade_groups_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_groups
    ADD CONSTRAINT grade_groups_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat(id);


--
-- Name: grade_groups grade_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_groups
    ADD CONSTRAINT grade_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: grade_improvements grade_improvements_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_improvements
    ADD CONSTRAINT grade_improvements_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grade(id) ON DELETE CASCADE;


--
-- Name: grade_improvements grade_improvements_improvement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_improvements
    ADD CONSTRAINT grade_improvements_improvement_id_fkey FOREIGN KEY (improvement_id) REFERENCES public.improvements(id) ON DELETE CASCADE;


--
-- Name: grade_strengths grade_strengths_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_strengths
    ADD CONSTRAINT grade_strengths_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grade(id) ON DELETE CASCADE;


--
-- Name: grade_strengths grade_strengths_strength_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_strengths
    ADD CONSTRAINT grade_strengths_strength_id_fkey FOREIGN KEY (strength_id) REFERENCES public.strengths(id) ON DELETE CASCADE;


--
-- Name: grade_times grade_times_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_times
    ADD CONSTRAINT grade_times_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grade(id) ON DELETE CASCADE;


--
-- Name: grade_times grade_times_time_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_times
    ADD CONSTRAINT grade_times_time_id_fkey FOREIGN KEY (time_id) REFERENCES public.times(id) ON DELETE RESTRICT;


--
-- Name: grade grades_rubric_grade_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade
    ADD CONSTRAINT grades_rubric_grade_agent_id_fkey FOREIGN KEY (rubric_grade_agent_id) REFERENCES public.rubric_grade_agents(id) ON DELETE SET NULL;


--
-- Name: grade grades_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade
    ADD CONSTRAINT grades_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.run(id);


--
-- Name: group_order group_order_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_order
    ADD CONSTRAINT group_order_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT group_runs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.run(id);


--
-- Name: group_stop group_stop_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_stop
    ADD CONSTRAINT group_stop_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_stop group_stop_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_stop
    ADD CONSTRAINT group_stop_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tool(id) ON DELETE CASCADE;


--
-- Name: hints hints_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hints
    ADD CONSTRAINT hints_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: html html_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.html
    ADD CONSTRAINT html_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


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
-- Name: icons icons_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icons
    ADD CONSTRAINT icons_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


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
-- Name: images images_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: improvements improvements_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.improvements
    ADD CONSTRAINT improvements_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: improvements improvements_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.improvements
    ADD CONSTRAINT improvements_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.message(id) ON DELETE CASCADE;


--
-- Name: instruction_schemas instruction_schemas_instruction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instruction_schemas
    ADD CONSTRAINT instruction_schemas_instruction_id_fkey FOREIGN KEY (instruction_id) REFERENCES public.instructions(id) ON DELETE CASCADE;


--
-- Name: instructions instructions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instructions
    ADD CONSTRAINT instructions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: items items_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: key_descriptions key_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_descriptions
    ADD CONSTRAINT key_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: key_descriptions key_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_descriptions
    ADD CONSTRAINT key_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: key_descriptions key_descriptions_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_descriptions
    ADD CONSTRAINT key_descriptions_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.key(id) ON DELETE CASCADE;


--
-- Name: key_flags key_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_flags
    ADD CONSTRAINT key_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: key_flags key_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_flags
    ADD CONSTRAINT key_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: key_flags key_flags_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_flags
    ADD CONSTRAINT key_flags_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.key(id) ON DELETE CASCADE;


--
-- Name: key key_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key
    ADD CONSTRAINT key_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: key_names key_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_names
    ADD CONSTRAINT key_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: key_names key_names_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_names
    ADD CONSTRAINT key_names_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.key(id) ON DELETE CASCADE;


--
-- Name: key_names key_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_names
    ADD CONSTRAINT key_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: keys keys_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keys
    ADD CONSTRAINT keys_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: keys keys_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keys
    ADD CONSTRAINT keys_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.key(id);


--
-- Name: message_audios message_audios_audio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_audios
    ADD CONSTRAINT message_audios_audio_id_fkey FOREIGN KEY (audio_id) REFERENCES public.audios(id) ON DELETE CASCADE;


--
-- Name: message_audios message_audios_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_audios
    ADD CONSTRAINT message_audios_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.message(id) ON DELETE CASCADE;


--
-- Name: message_calls message_calls_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_calls
    ADD CONSTRAINT message_calls_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id) ON DELETE CASCADE;


--
-- Name: message_calls message_calls_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_calls
    ADD CONSTRAINT message_calls_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.message(id) ON DELETE CASCADE;


--
-- Name: message_contents message_contents_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_contents
    ADD CONSTRAINT message_contents_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.contents(id) ON DELETE CASCADE;


--
-- Name: message_contents message_contents_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_contents
    ADD CONSTRAINT message_contents_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.message(id) ON DELETE CASCADE;


--
-- Name: message_documents message_documents_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_documents
    ADD CONSTRAINT message_documents_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.message(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT message_hints_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.message(id) ON DELETE CASCADE;


--
-- Name: message_images message_images_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_images
    ADD CONSTRAINT message_images_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id) ON DELETE CASCADE;


--
-- Name: message_images message_images_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_images
    ADD CONSTRAINT message_images_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.message(id) ON DELETE CASCADE;


--
-- Name: message_personas message_personas_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_personas
    ADD CONSTRAINT message_personas_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.message(id);


--
-- Name: message_runs message_runs_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_runs
    ADD CONSTRAINT message_runs_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.message(id);


--
-- Name: message_runs message_runs_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_runs
    ADD CONSTRAINT message_runs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.run(id);


--
-- Name: message_texts message_texts_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_texts
    ADD CONSTRAINT message_texts_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.message(id) ON DELETE CASCADE;


--
-- Name: message_texts message_texts_text_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_texts
    ADD CONSTRAINT message_texts_text_id_fkey FOREIGN KEY (text_id) REFERENCES public.texts(id) ON DELETE CASCADE;


--
-- Name: message_tree message_tree_child_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_tree
    ADD CONSTRAINT message_tree_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.message(id);


--
-- Name: message_tree message_tree_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_tree
    ADD CONSTRAINT message_tree_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.message(id);


--
-- Name: message_videos message_videos_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_videos
    ADD CONSTRAINT message_videos_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.message(id) ON DELETE CASCADE;


--
-- Name: message_videos message_videos_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_videos
    ADD CONSTRAINT message_videos_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;


--
-- Name: model_departments model_departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_departments
    ADD CONSTRAINT model_departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: model_departments model_departments_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_departments
    ADD CONSTRAINT model_departments_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id);


--
-- Name: model_descriptions model_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_descriptions
    ADD CONSTRAINT model_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: model_descriptions model_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_descriptions
    ADD CONSTRAINT model_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: model_descriptions model_descriptions_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_descriptions
    ADD CONSTRAINT model_descriptions_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON DELETE CASCADE;


--
-- Name: model_endpoints model_endpoints_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_endpoints
    ADD CONSTRAINT model_endpoints_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: model_endpoints model_endpoints_new_endpoint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_endpoints
    ADD CONSTRAINT model_endpoints_new_endpoint_id_fkey FOREIGN KEY (endpoint_id) REFERENCES public.endpoints(id) ON DELETE CASCADE;


--
-- Name: model_endpoints model_endpoints_new_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_endpoints
    ADD CONSTRAINT model_endpoints_new_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON DELETE CASCADE;


--
-- Name: model_flags model_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_flags
    ADD CONSTRAINT model_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: model_flags model_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_flags
    ADD CONSTRAINT model_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: model_flags model_flags_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_flags
    ADD CONSTRAINT model_flags_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON DELETE CASCADE;


--
-- Name: model model_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT model_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: model_keys model_keys_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_keys
    ADD CONSTRAINT model_keys_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: model_keys model_keys_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_keys
    ADD CONSTRAINT model_keys_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON DELETE CASCADE;


--
-- Name: model_modalities model_modalities_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_modalities
    ADD CONSTRAINT model_modalities_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id);


--
-- Name: model_names model_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_names
    ADD CONSTRAINT model_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: model_names model_names_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_names
    ADD CONSTRAINT model_names_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON DELETE CASCADE;


--
-- Name: model_names model_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_names
    ADD CONSTRAINT model_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: model_pricing model_pricing_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_pricing
    ADD CONSTRAINT model_pricing_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id);


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
-- Name: model_providers model_providers_providers_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_providers
    ADD CONSTRAINT model_providers_providers_id_fkey FOREIGN KEY (providers_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: model_qualities model_qualities_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_qualities
    ADD CONSTRAINT model_qualities_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id);


--
-- Name: model_reasoning_levels model_reasoning_levels_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_reasoning_levels
    ADD CONSTRAINT model_reasoning_levels_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id);


--
-- Name: model_temperature_levels model_temperature_levels_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_temperature_levels
    ADD CONSTRAINT model_temperature_levels_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id);


--
-- Name: model_voices model_voices_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_voices
    ADD CONSTRAINT model_voices_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id);


--
-- Name: models models_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.models
    ADD CONSTRAINT models_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: models models_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.models
    ADD CONSTRAINT models_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id);


--
-- Name: names names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.names
    ADD CONSTRAINT names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: objective_departments objective_departments_objective_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_departments
    ADD CONSTRAINT objective_departments_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES public.objectives(id);


--
-- Name: objectives objectives_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives
    ADD CONSTRAINT objectives_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: options options_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: parameter_departments parameter_departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_departments
    ADD CONSTRAINT parameter_departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: parameter_departments parameter_departments_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_departments
    ADD CONSTRAINT parameter_departments_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameter(id);


--
-- Name: parameter_descriptions parameter_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_descriptions
    ADD CONSTRAINT parameter_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: parameter_descriptions parameter_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_descriptions
    ADD CONSTRAINT parameter_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: parameter_descriptions parameter_descriptions_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_descriptions
    ADD CONSTRAINT parameter_descriptions_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameter(id) ON DELETE CASCADE;


--
-- Name: parameter_fields parameter_fields_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_fields
    ADD CONSTRAINT parameter_fields_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: parameter_fields parameter_fields_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_fields
    ADD CONSTRAINT parameter_fields_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameter(id) ON DELETE CASCADE;


--
-- Name: parameter_flags parameter_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_flags
    ADD CONSTRAINT parameter_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: parameter_flags parameter_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_flags
    ADD CONSTRAINT parameter_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: parameter_flags parameter_flags_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_flags
    ADD CONSTRAINT parameter_flags_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameter(id) ON DELETE CASCADE;


--
-- Name: parameter parameter_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter
    ADD CONSTRAINT parameter_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: parameter_names parameter_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_names
    ADD CONSTRAINT parameter_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: parameter_names parameter_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_names
    ADD CONSTRAINT parameter_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: parameter_names parameter_names_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter_names
    ADD CONSTRAINT parameter_names_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameter(id) ON DELETE CASCADE;


--
-- Name: parameters parameters_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameters
    ADD CONSTRAINT parameters_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: parameters parameters_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameters
    ADD CONSTRAINT parameters_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameter(id);


--
-- Name: persona_colors persona_colors_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_colors
    ADD CONSTRAINT persona_colors_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: persona_colors persona_colors_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_colors
    ADD CONSTRAINT persona_colors_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colors(id) ON DELETE CASCADE;


--
-- Name: persona_colors persona_colors_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_colors
    ADD CONSTRAINT persona_colors_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id) ON DELETE CASCADE;


--
-- Name: persona_departments persona_departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_departments
    ADD CONSTRAINT persona_departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: persona_departments persona_departments_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_departments
    ADD CONSTRAINT persona_departments_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id);


--
-- Name: persona_descriptions persona_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_descriptions
    ADD CONSTRAINT persona_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: persona_descriptions persona_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_descriptions
    ADD CONSTRAINT persona_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: persona_descriptions persona_descriptions_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_descriptions
    ADD CONSTRAINT persona_descriptions_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id) ON DELETE CASCADE;


--
-- Name: persona_examples persona_examples_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_examples
    ADD CONSTRAINT persona_examples_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: persona_examples persona_examples_example_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_examples
    ADD CONSTRAINT persona_examples_example_id_fkey FOREIGN KEY (example_id) REFERENCES public.examples(id);


--
-- Name: persona_examples persona_examples_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_examples
    ADD CONSTRAINT persona_examples_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id) ON DELETE CASCADE;


--
-- Name: persona_fields persona_fields_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_fields
    ADD CONSTRAINT persona_fields_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: persona_fields persona_fields_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_fields
    ADD CONSTRAINT persona_fields_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id);


--
-- Name: persona_flags persona_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_flags
    ADD CONSTRAINT persona_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: persona_flags persona_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_flags
    ADD CONSTRAINT persona_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: persona_flags persona_flags_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_flags
    ADD CONSTRAINT persona_flags_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id) ON DELETE CASCADE;


--
-- Name: persona persona_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona
    ADD CONSTRAINT persona_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: persona_icons persona_icons_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_icons
    ADD CONSTRAINT persona_icons_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: persona_icons persona_icons_icon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_icons
    ADD CONSTRAINT persona_icons_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES public.icons(id) ON DELETE CASCADE;


--
-- Name: persona_icons persona_icons_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_icons
    ADD CONSTRAINT persona_icons_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id) ON DELETE CASCADE;


--
-- Name: persona_instructions persona_instructions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_instructions
    ADD CONSTRAINT persona_instructions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: persona_instructions persona_instructions_instruction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_instructions
    ADD CONSTRAINT persona_instructions_instruction_id_fkey FOREIGN KEY (instruction_id) REFERENCES public.instructions(id) ON DELETE CASCADE;


--
-- Name: persona_instructions persona_instructions_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_instructions
    ADD CONSTRAINT persona_instructions_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id) ON DELETE CASCADE;


--
-- Name: persona_names persona_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_names
    ADD CONSTRAINT persona_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: persona_names persona_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_names
    ADD CONSTRAINT persona_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: persona_names persona_names_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_names
    ADD CONSTRAINT persona_names_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id) ON DELETE CASCADE;


--
-- Name: personas personas_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personas
    ADD CONSTRAINT personas_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: personas personas_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personas
    ADD CONSTRAINT personas_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.persona(id);


--
-- Name: points points_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points
    ADD CONSTRAINT points_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: problem_statement_departments problem_statement_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_statement_departments
    ADD CONSTRAINT problem_statement_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: problem_statement_departments problem_statement_departments_problem_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_statement_departments
    ADD CONSTRAINT problem_statement_departments_problem_statement_id_fkey FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statements(id);


--
-- Name: problem_statements problem_statements_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_statements
    ADD CONSTRAINT problem_statements_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: problems problems_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id);


--
-- Name: profile_activity profile_activity_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_activity
    ADD CONSTRAINT profile_activity_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id);


--
-- Name: profile_departments profile_departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_departments
    ADD CONSTRAINT profile_departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: profile_departments profile_departments_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_departments
    ADD CONSTRAINT profile_departments_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id);


--
-- Name: profile_emails profile_emails_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_emails
    ADD CONSTRAINT profile_emails_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id);


--
-- Name: profile_flags profile_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_flags
    ADD CONSTRAINT profile_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: profile_flags profile_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_flags
    ADD CONSTRAINT profile_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: profile_flags profile_flags_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_flags
    ADD CONSTRAINT profile_flags_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: profile profile_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile
    ADD CONSTRAINT profile_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: profile_names profile_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_names
    ADD CONSTRAINT profile_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: profile_names profile_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_names
    ADD CONSTRAINT profile_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: profile_names profile_names_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_names
    ADD CONSTRAINT profile_names_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: profile_request_limits profile_request_limits_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_request_limits
    ADD CONSTRAINT profile_request_limits_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id);


--
-- Name: profiles profiles_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: profiles profiles_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id);


--
-- Name: prompt_departments prompt_departments_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_departments
    ADD CONSTRAINT prompt_departments_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id);


--
-- Name: prompts prompts_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompts
    ADD CONSTRAINT prompts_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: protocols protocols_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocols
    ADD CONSTRAINT protocols_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: provider_descriptions provider_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_descriptions
    ADD CONSTRAINT provider_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: provider_descriptions provider_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_descriptions
    ADD CONSTRAINT provider_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: provider_descriptions provider_descriptions_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_descriptions
    ADD CONSTRAINT provider_descriptions_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.provider(id) ON DELETE CASCADE;


--
-- Name: provider_flags provider_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_flags
    ADD CONSTRAINT provider_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: provider_flags provider_flags_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_flags
    ADD CONSTRAINT provider_flags_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.provider(id) ON DELETE CASCADE;


--
-- Name: provider provider_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider
    ADD CONSTRAINT provider_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: provider_names provider_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_names
    ADD CONSTRAINT provider_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: provider_names provider_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_names
    ADD CONSTRAINT provider_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: provider_names provider_names_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_names
    ADD CONSTRAINT provider_names_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.provider(id) ON DELETE CASCADE;


--
-- Name: providers providers_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: providers providers_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.provider(id) ON DELETE CASCADE;


--
-- Name: question_departments question_departments_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_departments
    ADD CONSTRAINT question_departments_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: questions questions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


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
    ADD CONSTRAINT resource_tools_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tool(id) ON DELETE CASCADE;


--
-- Name: responses responses_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: rubric_artifacts rubric_artifacts_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_artifacts
    ADD CONSTRAINT rubric_artifacts_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric(id) ON DELETE CASCADE;


--
-- Name: rubric_departments rubric_departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_departments
    ADD CONSTRAINT rubric_departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: rubric_departments rubric_departments_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_departments
    ADD CONSTRAINT rubric_departments_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric(id);


--
-- Name: rubric_descriptions rubric_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_descriptions
    ADD CONSTRAINT rubric_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: rubric_descriptions rubric_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_descriptions
    ADD CONSTRAINT rubric_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: rubric_descriptions rubric_descriptions_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_descriptions
    ADD CONSTRAINT rubric_descriptions_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric(id) ON DELETE CASCADE;


--
-- Name: rubric_domains rubric_domains_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_domains
    ADD CONSTRAINT rubric_domains_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: rubric_domains rubric_domains_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_domains
    ADD CONSTRAINT rubric_domains_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric(id) ON DELETE CASCADE;


--
-- Name: rubric_flags rubric_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_flags
    ADD CONSTRAINT rubric_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: rubric_flags rubric_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_flags
    ADD CONSTRAINT rubric_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: rubric_flags rubric_flags_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_flags
    ADD CONSTRAINT rubric_flags_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric(id) ON DELETE CASCADE;


--
-- Name: rubric_grade_agents rubric_grade_agents_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents
    ADD CONSTRAINT rubric_grade_agents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id) ON DELETE CASCADE;


--
-- Name: rubric_grade_agents_audio rubric_grade_agents_audio_audio_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents_audio
    ADD CONSTRAINT rubric_grade_agents_audio_audio_agent_id_fkey FOREIGN KEY (audio_agent_id) REFERENCES public.agent(id) ON DELETE CASCADE;


--
-- Name: rubric_grade_agents rubric_grade_agents_grade_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents
    ADD CONSTRAINT rubric_grade_agents_grade_agent_id_fkey FOREIGN KEY (grade_agent_id) REFERENCES public.agent(id) ON DELETE CASCADE;


--
-- Name: rubric_grade_agents rubric_grade_agents_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents
    ADD CONSTRAINT rubric_grade_agents_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric(id) ON DELETE CASCADE;


--
-- Name: rubric_grade_agents_audio rubric_grade_agents_voice_rubric_grade_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_grade_agents_audio
    ADD CONSTRAINT rubric_grade_agents_voice_rubric_grade_agent_id_fkey FOREIGN KEY (rubric_grade_agent_id) REFERENCES public.rubric_grade_agents(id) ON DELETE CASCADE;


--
-- Name: rubric rubric_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric
    ADD CONSTRAINT rubric_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: rubric_groups rubric_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_groups
    ADD CONSTRAINT rubric_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: rubric_groups rubric_groups_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_groups
    ADD CONSTRAINT rubric_groups_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric(id);


--
-- Name: rubric_names rubric_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_names
    ADD CONSTRAINT rubric_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: rubric_names rubric_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_names
    ADD CONSTRAINT rubric_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: rubric_names rubric_names_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_names
    ADD CONSTRAINT rubric_names_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric(id) ON DELETE CASCADE;


--
-- Name: rubric_points rubric_points_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_points
    ADD CONSTRAINT rubric_points_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: rubric_points rubric_points_point_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_points
    ADD CONSTRAINT rubric_points_point_id_fkey FOREIGN KEY (point_id) REFERENCES public.points(id) ON DELETE CASCADE;


--
-- Name: rubric_points rubric_points_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_points
    ADD CONSTRAINT rubric_points_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric(id) ON DELETE CASCADE;


--
-- Name: rubric_standard_groups rubric_standard_groups_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_standard_groups
    ADD CONSTRAINT rubric_standard_groups_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: rubric_standard_groups rubric_standard_groups_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_standard_groups
    ADD CONSTRAINT rubric_standard_groups_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric(id) ON DELETE CASCADE;


--
-- Name: rubric_standard_groups rubric_standard_groups_standard_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_standard_groups
    ADD CONSTRAINT rubric_standard_groups_standard_group_id_fkey FOREIGN KEY (standard_group_id) REFERENCES public.standard_groups(id) ON DELETE CASCADE;


--
-- Name: rubrics rubrics_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubrics
    ADD CONSTRAINT rubrics_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: rubric rubrics_rubric_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric
    ADD CONSTRAINT rubrics_rubric_domain_id_fkey FOREIGN KEY (rubric_domain_id) REFERENCES public.domains(id) ON DELETE SET NULL;


--
-- Name: rubrics rubrics_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubrics
    ADD CONSTRAINT rubrics_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric(id);


--
-- Name: run_debug_info run_debug_info_debug_info_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_debug_info
    ADD CONSTRAINT run_debug_info_debug_info_id_fkey FOREIGN KEY (debug_info_id) REFERENCES public.debug_info(id) ON DELETE CASCADE;


--
-- Name: run_debug_info run_debug_info_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_debug_info
    ADD CONSTRAINT run_debug_info_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.run(id) ON DELETE CASCADE;


--
-- Name: run_models run_models_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_models
    ADD CONSTRAINT run_models_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.run(id);


--
-- Name: run_personas run_personas_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_personas
    ADD CONSTRAINT run_personas_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.run(id);


--
-- Name: run_pricing_usage run_pricing_usage_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_pricing_usage
    ADD CONSTRAINT run_pricing_usage_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.run(id);


--
-- Name: run_pricing_usage run_pricing_usage_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_pricing_usage
    ADD CONSTRAINT run_pricing_usage_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: run_profiles run_profiles_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_profiles
    ADD CONSTRAINT run_profiles_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.run(id);


--
-- Name: run runs_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run
    ADD CONSTRAINT runs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent(id);


--
-- Name: run runs_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run
    ADD CONSTRAINT runs_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.key(id);


--
-- Name: scenario_agent_domains scenario_agent_domains_agent_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_agent_domains
    ADD CONSTRAINT scenario_agent_domains_agent_domain_id_fkey FOREIGN KEY (agent_domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: scenario_departments scenario_departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_departments
    ADD CONSTRAINT scenario_departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_departments scenario_departments_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_departments
    ADD CONSTRAINT scenario_departments_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_descriptions scenario_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_descriptions
    ADD CONSTRAINT scenario_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_descriptions scenario_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_descriptions
    ADD CONSTRAINT scenario_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: scenario_descriptions scenario_descriptions_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_descriptions
    ADD CONSTRAINT scenario_descriptions_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: scenario_document_ranges scenario_document_ranges_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_document_ranges
    ADD CONSTRAINT scenario_document_ranges_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_documents scenario_documents_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_documents
    ADD CONSTRAINT scenario_documents_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_documents scenario_documents_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_documents
    ADD CONSTRAINT scenario_documents_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_agent_domains scenario_domains_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_agent_domains
    ADD CONSTRAINT scenario_domains_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: scenario_field_ranges scenario_field_ranges_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_field_ranges
    ADD CONSTRAINT scenario_field_ranges_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameter(id);


--
-- Name: scenario_field_ranges scenario_field_ranges_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_field_ranges
    ADD CONSTRAINT scenario_field_ranges_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_fields scenario_fields_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_fields
    ADD CONSTRAINT scenario_fields_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_fields scenario_fields_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_fields
    ADD CONSTRAINT scenario_fields_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_flags scenario_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_flags
    ADD CONSTRAINT scenario_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_flags scenario_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_flags
    ADD CONSTRAINT scenario_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: scenario_flags scenario_flags_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_flags
    ADD CONSTRAINT scenario_flags_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: scenario scenario_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: scenario_groups scenario_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_groups
    ADD CONSTRAINT scenario_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: scenario_groups scenario_groups_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_groups
    ADD CONSTRAINT scenario_groups_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_images scenario_images_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_images
    ADD CONSTRAINT scenario_images_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_images scenario_images_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_images
    ADD CONSTRAINT scenario_images_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: scenario_images scenario_images_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_images
    ADD CONSTRAINT scenario_images_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_names scenario_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_names
    ADD CONSTRAINT scenario_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_names scenario_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_names
    ADD CONSTRAINT scenario_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: scenario_names scenario_names_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_names
    ADD CONSTRAINT scenario_names_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: scenario_objectives scenario_objectives_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_objectives
    ADD CONSTRAINT scenario_objectives_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_objectives scenario_objectives_objective_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_objectives
    ADD CONSTRAINT scenario_objectives_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES public.objectives(id);


--
-- Name: scenario_objectives scenario_objectives_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_objectives
    ADD CONSTRAINT scenario_objectives_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_options scenario_options_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_options
    ADD CONSTRAINT scenario_options_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_options scenario_options_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_options
    ADD CONSTRAINT scenario_options_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.options(id) ON DELETE RESTRICT;


--
-- Name: scenario_options scenario_options_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_options
    ADD CONSTRAINT scenario_options_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: scenario_parameter_ranges scenario_parameter_ranges_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_parameter_ranges
    ADD CONSTRAINT scenario_parameter_ranges_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_parameters scenario_parameters_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_parameters
    ADD CONSTRAINT scenario_parameters_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_parameters scenario_parameters_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_parameters
    ADD CONSTRAINT scenario_parameters_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_persona_ranges scenario_persona_ranges_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_persona_ranges
    ADD CONSTRAINT scenario_persona_ranges_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_personas scenario_personas_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_personas
    ADD CONSTRAINT scenario_personas_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_personas scenario_personas_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_personas
    ADD CONSTRAINT scenario_personas_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_problem_statements scenario_problem_statements_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_problem_statements
    ADD CONSTRAINT scenario_problem_statements_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_problem_statements scenario_problem_statements_problem_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_problem_statements
    ADD CONSTRAINT scenario_problem_statements_problem_statement_id_fkey FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statements(id);


--
-- Name: scenario_problem_statements scenario_problem_statements_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_problem_statements
    ADD CONSTRAINT scenario_problem_statements_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_questions scenario_questions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_questions
    ADD CONSTRAINT scenario_questions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_questions scenario_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_questions
    ADD CONSTRAINT scenario_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: scenario_questions scenario_questions_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_questions
    ADD CONSTRAINT scenario_questions_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_templates scenario_templates_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_templates
    ADD CONSTRAINT scenario_templates_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_templates scenario_templates_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_templates
    ADD CONSTRAINT scenario_templates_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: scenario_templates scenario_templates_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_templates
    ADD CONSTRAINT scenario_templates_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: scenario_tree scenario_tree_child_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_tree
    ADD CONSTRAINT scenario_tree_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.scenario(id);


--
-- Name: scenario_tree scenario_tree_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_tree
    ADD CONSTRAINT scenario_tree_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.scenario(id);


--
-- Name: scenario_video_images scenario_video_images_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_video_images
    ADD CONSTRAINT scenario_video_images_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: scenario_video_images scenario_video_images_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_video_images
    ADD CONSTRAINT scenario_video_images_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_video_images scenario_video_images_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_video_images
    ADD CONSTRAINT scenario_video_images_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id);


--
-- Name: scenario_videos scenario_videos_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_videos
    ADD CONSTRAINT scenario_videos_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenario_videos scenario_videos_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_videos
    ADD CONSTRAINT scenario_videos_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: scenario_videos scenario_videos_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_videos
    ADD CONSTRAINT scenario_videos_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id);


--
-- Name: scenarios scenarios_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenarios
    ADD CONSTRAINT scenarios_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: scenarios scenarios_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenarios
    ADD CONSTRAINT scenarios_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id);


--
-- Name: schema_field_items schema_field_items_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_field_items
    ADD CONSTRAINT schema_field_items_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


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
-- Name: schema_fields schema_fields_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_fields
    ADD CONSTRAINT schema_fields_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


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
-- Name: schemas schemas_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schemas
    ADD CONSTRAINT schemas_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: setting_auth_keys setting_auth_keys_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_keys
    ADD CONSTRAINT setting_auth_keys_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id);


--
-- Name: setting_auth_keys setting_auth_keys_auth_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_keys
    ADD CONSTRAINT setting_auth_keys_auth_item_id_fkey FOREIGN KEY (auth_item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: setting_auth_keys setting_auth_keys_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_keys
    ADD CONSTRAINT setting_auth_keys_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.key(id);


--
-- Name: setting_auth_keys setting_auth_keys_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_keys
    ADD CONSTRAINT setting_auth_keys_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.setting(id);


--
-- Name: setting_auth_values setting_auth_values_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_values
    ADD CONSTRAINT setting_auth_values_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES public.auth(id);


--
-- Name: setting_auth_values setting_auth_values_auth_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_values
    ADD CONSTRAINT setting_auth_values_auth_item_id_fkey FOREIGN KEY (auth_item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: setting_auth_values setting_auth_values_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auth_values
    ADD CONSTRAINT setting_auth_values_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.setting(id);


--
-- Name: setting_auths setting_auths_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auths
    ADD CONSTRAINT setting_auths_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: setting_auths setting_auths_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_auths
    ADD CONSTRAINT setting_auths_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.setting(id);


--
-- Name: setting_colors setting_colors_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_colors
    ADD CONSTRAINT setting_colors_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: setting_colors setting_colors_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_colors
    ADD CONSTRAINT setting_colors_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colors(id) ON DELETE CASCADE;


--
-- Name: setting_colors setting_colors_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_colors
    ADD CONSTRAINT setting_colors_setting_id_fkey FOREIGN KEY (setting_id) REFERENCES public.setting(id) ON DELETE CASCADE;


--
-- Name: setting_descriptions setting_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_descriptions
    ADD CONSTRAINT setting_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: setting_descriptions setting_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_descriptions
    ADD CONSTRAINT setting_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: setting_descriptions setting_descriptions_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_descriptions
    ADD CONSTRAINT setting_descriptions_setting_id_fkey FOREIGN KEY (setting_id) REFERENCES public.setting(id) ON DELETE CASCADE;


--
-- Name: setting_flags setting_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_flags
    ADD CONSTRAINT setting_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: setting_flags setting_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_flags
    ADD CONSTRAINT setting_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: setting_flags setting_flags_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_flags
    ADD CONSTRAINT setting_flags_setting_id_fkey FOREIGN KEY (setting_id) REFERENCES public.setting(id) ON DELETE CASCADE;


--
-- Name: setting setting_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting
    ADD CONSTRAINT setting_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: setting_names setting_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_names
    ADD CONSTRAINT setting_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: setting_names setting_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_names
    ADD CONSTRAINT setting_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: setting_names setting_names_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_names
    ADD CONSTRAINT setting_names_setting_id_fkey FOREIGN KEY (setting_id) REFERENCES public.setting(id) ON DELETE CASCADE;


--
-- Name: setting_provider_keys setting_provider_keys_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_provider_keys
    ADD CONSTRAINT setting_provider_keys_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.key(id);


--
-- Name: setting_provider_keys setting_provider_keys_providers_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_provider_keys
    ADD CONSTRAINT setting_provider_keys_providers_id_fkey FOREIGN KEY (providers_id) REFERENCES public.providers(id);


--
-- Name: setting_provider_keys setting_provider_keys_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_provider_keys
    ADD CONSTRAINT setting_provider_keys_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.setting(id);


--
-- Name: setting_providers setting_providers_providers_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_providers
    ADD CONSTRAINT setting_providers_providers_id_fkey FOREIGN KEY (providers_id) REFERENCES public.providers(id);


--
-- Name: setting_providers setting_providers_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_providers
    ADD CONSTRAINT setting_providers_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.setting(id);


--
-- Name: setting_thresholds setting_thresholds_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_thresholds
    ADD CONSTRAINT setting_thresholds_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: setting_thresholds setting_thresholds_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_thresholds
    ADD CONSTRAINT setting_thresholds_setting_id_fkey FOREIGN KEY (setting_id) REFERENCES public.setting(id) ON DELETE CASCADE;


--
-- Name: setting_thresholds setting_thresholds_threshold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_thresholds
    ADD CONSTRAINT setting_thresholds_threshold_id_fkey FOREIGN KEY (threshold_id) REFERENCES public.thresholds(id) ON DELETE CASCADE;


--
-- Name: settings settings_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: settings_default_account settings_default_account_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_account
    ADD CONSTRAINT settings_default_account_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id);


--
-- Name: settings_default_account settings_default_account_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_account
    ADD CONSTRAINT settings_default_account_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.setting(id);


--
-- Name: settings_default_department settings_default_department_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_department
    ADD CONSTRAINT settings_default_department_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: settings_default_department settings_default_department_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_department
    ADD CONSTRAINT settings_default_department_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.setting(id);


--
-- Name: settings_default_guest settings_default_guest_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_guest
    ADD CONSTRAINT settings_default_guest_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id);


--
-- Name: settings_default_guest settings_default_guest_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_default_guest
    ADD CONSTRAINT settings_default_guest_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.setting(id);


--
-- Name: settings settings_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_setting_id_fkey FOREIGN KEY (setting_id) REFERENCES public.setting(id);


--
-- Name: simulation_agent_domains simulation_agent_domains_agent_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_agent_domains
    ADD CONSTRAINT simulation_agent_domains_agent_domain_id_fkey FOREIGN KEY (agent_domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: simulation_attempts simulation_attempts_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_attempts
    ADD CONSTRAINT simulation_attempts_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulation(id);


--
-- Name: simulation_departments simulation_departments_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_departments
    ADD CONSTRAINT simulation_departments_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: simulation_departments simulation_departments_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_departments
    ADD CONSTRAINT simulation_departments_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulation(id);


--
-- Name: simulation_descriptions simulation_descriptions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_descriptions
    ADD CONSTRAINT simulation_descriptions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: simulation_descriptions simulation_descriptions_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_descriptions
    ADD CONSTRAINT simulation_descriptions_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id) ON DELETE CASCADE;


--
-- Name: simulation_descriptions simulation_descriptions_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_descriptions
    ADD CONSTRAINT simulation_descriptions_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulation(id) ON DELETE CASCADE;


--
-- Name: simulation_agent_domains simulation_domains_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_agent_domains
    ADD CONSTRAINT simulation_domains_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulation(id) ON DELETE CASCADE;


--
-- Name: simulation_flags simulation_flags_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_flags
    ADD CONSTRAINT simulation_flags_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: simulation_flags simulation_flags_flag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_flags
    ADD CONSTRAINT simulation_flags_flag_id_fkey FOREIGN KEY (flag_id) REFERENCES public.flags(id) ON DELETE CASCADE;


--
-- Name: simulation_flags simulation_flags_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_flags
    ADD CONSTRAINT simulation_flags_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulation(id) ON DELETE CASCADE;


--
-- Name: simulation simulation_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation
    ADD CONSTRAINT simulation_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id);


--
-- Name: simulation_names simulation_names_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_names
    ADD CONSTRAINT simulation_names_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: simulation_names simulation_names_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_names
    ADD CONSTRAINT simulation_names_name_id_fkey FOREIGN KEY (name_id) REFERENCES public.names(id) ON DELETE CASCADE;


--
-- Name: simulation_names simulation_names_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_names
    ADD CONSTRAINT simulation_names_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulation(id) ON DELETE CASCADE;


--
-- Name: simulation_scenarios simulation_scenarios_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_scenarios
    ADD CONSTRAINT simulation_scenarios_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


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
-- Name: simulation_scenarios simulation_scenarios_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_scenarios
    ADD CONSTRAINT simulation_scenarios_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulation(id);


--
-- Name: simulations simulations_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulations
    ADD CONSTRAINT simulations_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: simulations simulations_simulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulations
    ADD CONSTRAINT simulations_simulation_id_fkey FOREIGN KEY (simulation_id) REFERENCES public.simulation(id);


--
-- Name: slugs slugs_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slugs
    ADD CONSTRAINT slugs_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: standard_groups standard_groups_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_groups
    ADD CONSTRAINT standard_groups_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: standards standards_standard_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standards
    ADD CONSTRAINT standards_standard_group_id_fkey FOREIGN KEY (standard_group_id) REFERENCES public.standard_groups(id);


--
-- Name: strengths strengths_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strengths
    ADD CONSTRAINT strengths_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: strengths strengths_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strengths
    ADD CONSTRAINT strengths_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.message(id) ON DELETE CASCADE;


--
-- Name: template_array_items template_array_items_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_array_items
    ADD CONSTRAINT template_array_items_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


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
-- Name: template_values template_values_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_values
    ADD CONSTRAINT template_values_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


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
-- Name: test_runs test_runs_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_runs
    ADD CONSTRAINT test_runs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.run(id);


--
-- Name: test_runs test_runs_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_runs
    ADD CONSTRAINT test_runs_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id);


--
-- Name: tests tests_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.run(id);


--
-- Name: texts texts_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.texts
    ADD CONSTRAINT texts_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: thresholds thresholds_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thresholds
    ADD CONSTRAINT thresholds_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: times times_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.times
    ADD CONSTRAINT times_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: tool_domains tool_domains_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_domains
    ADD CONSTRAINT tool_domains_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: tool_domains tool_domains_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_domains
    ADD CONSTRAINT tool_domains_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tool(id) ON DELETE CASCADE;


--
-- Name: tool_schemas tool_schemas_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_schemas
    ADD CONSTRAINT tool_schemas_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.schemas(id) ON DELETE CASCADE;


--
-- Name: tool_schemas tool_schemas_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_schemas
    ADD CONSTRAINT tool_schemas_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tool(id) ON DELETE CASCADE;


--
-- Name: tool_templates tool_templates_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_templates
    ADD CONSTRAINT tool_templates_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: tool_templates tool_templates_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_templates
    ADD CONSTRAINT tool_templates_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tool(id) ON DELETE CASCADE;


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
-- Name: videos videos_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- PostgreSQL database dump complete
--

\unrestrict J2tdwZHJoMvWsIZNNkLol9bRMKhZzdvFWjipUP9lzEPnkaoihDyZThqe4J0ipqM

