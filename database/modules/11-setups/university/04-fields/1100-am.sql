-- Module: 11:00 AM
-- Category: field
-- Description: 11:00 AM field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7734-9651-8e74f8656d10', 'Late morning session, students are alert and engaged.', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.874255+00:00', true, false, false, '019bb25e-e5f8-7dbe-843e-5cc6e2bb7241', '11:00 AM', 'Late morning session, students are alert and engaged.', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7aa1-8385-1cf9f5d35c27', '11:00 AM', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:09.874255-05', '2025-08-12 07:52:09.874255-05', '019b3be4-3255-7ad0-a4ca-f1824fe493a3', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ad0-a4ca-f1824fe493a3', '019b995c-8e9e-7734-9651-8e74f8656d10', '2025-08-12 07:52:09.874255-05', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ad0-a4ca-f1824fe493a3', '019bb25e-e5f8-7dbe-843e-5cc6e2bb7241', true, '2025-08-12 07:52:09.874255-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ad0-a4ca-f1824fe493a3', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-08-12 07:52:09.874255-05', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ad0-a4ca-f1824fe493a3', '019b995c-8e9b-7aa1-8385-1cf9f5d35c27', '2025-08-12 07:52:09.874255-05', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c6b-bf97-4e28b5fd13bb', '019bb25e-e5f8-7dbe-843e-5cc6e2bb7241', true, '2025-08-12 07:52:09.874255-05', false, false) ON CONFLICT (parameter_id, fields_id) DO NOTHING;
