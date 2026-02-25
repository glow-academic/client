-- Module: Emotion
-- Category: field
-- Description: Emotion field
-- ============================================================


-- Resource rows
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a160-7268-b1ec-814bf8d45478', '019bb25e-e621-702e-a7ba-81fd751a9c61', '2025-12-12T13:26:55.660542+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7813-91de-e75f877117dc', 'Personas with emotional temperaments (aggressive, passive, confused, happy)', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7dd6-b648-490037cad081', 'Emotion', 'Personas with emotional temperaments (aggressive, passive, confused, happy)', NULL, '{}', '{019c04f5-a160-7268-b1ec-814bf8d45478}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79e8-8107-f2a74eb4c228', 'Emotion', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_conditional_parameters_junction
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
