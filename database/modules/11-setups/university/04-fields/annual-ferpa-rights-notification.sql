-- Module: Annual FERPA Rights Notification
-- Category: field
-- Description: Annual FERPA Rights Notification field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77f3-ba07-66ac3926e5f8', 'Annual notification requirements for FERPA rights', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-02T23:06:38.169734+00:00', true, false, false, '019bb25e-e5f8-7ce8-825f-6d1d8ddcc6b9', 'Annual FERPA Rights Notification', 'Annual notification requirements for FERPA rights', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7afe-88e0-c6d1ec1b3245', 'Annual FERPA Rights Notification', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02 17:06:38.169734-06', '2025-12-02 17:06:38.169734-06', '019b3be4-3255-7ed6-b953-cc0f5a8973d6', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ed6-b953-cc0f5a8973d6', '019b995c-8e9e-77f3-ba07-66ac3926e5f8', '2025-12-02 17:06:38.169734-06', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ed6-b953-cc0f5a8973d6', '019bb25e-e5f8-7ce8-825f-6d1d8ddcc6b9', true, '2025-12-02 17:06:38.169734-06', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ed6-b953-cc0f5a8973d6', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-12-02 17:06:38.169734-06', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ed6-b953-cc0f5a8973d6', '019b995c-8e9b-7afe-88e0-c6d1ec1b3245', '2025-12-02 17:06:38.169734-06', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c5d-9629-7aedbc8f5928', '019bb25e-e5f8-7ce8-825f-6d1d8ddcc6b9', true, '2025-12-02 17:06:38.169734-06', false, false) ON CONFLICT (parameter_id, fields_id) DO NOTHING;
