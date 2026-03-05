-- Module: Emotion
-- Category: field
-- Description: Emotion field
-- ============================================================


-- Resource rows
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a160-7268-b1ec-814bf8d45478', '019bb25e-e621-702e-a7ba-81fd751a9c61', '2025-12-12T13:26:55.660542+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7813-91de-e75f877117dc', 'Personas with emotional temperaments (aggressive, passive, confused, happy)', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7dd6-b648-490037cad081', 'Emotion', 'Personas with emotional temperaments (aggressive, passive, confused, happy)', '', '{}', '{019c04f5-a160-7268-b1ec-814bf8d45478}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79e8-8107-f2a74eb4c228', 'Emotion', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12 07:26:55.660542-06', '2025-12-12 07:26:55.660542-06', '019b3be4-3255-7fd0-bc67-fb69f3292a88', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fd0-bc67-fb69f3292a88', '019c04f5-a160-7268-b1ec-814bf8d45478', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (field_id, conditional_parameters_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fd0-bc67-fb69f3292a88', '019b995c-8e9e-7813-91de-e75f877117dc', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fd0-bc67-fb69f3292a88', '019bb25e-e5f8-7dd6-b648-490037cad081', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fd0-bc67-fb69f3292a88', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fd0-bc67-fb69f3292a88', '019b995c-8e9b-79e8-8107-f2a74eb4c228', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c79-80fa-7ab7ea171647', '019bb25e-e5f8-7dd6-b648-490037cad081', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (parameter_id, fields_id) DO NOTHING;
