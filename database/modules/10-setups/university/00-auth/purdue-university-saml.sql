-- Module: Purdue University (SAML)
-- Category: auth
-- Description: Purdue University (SAML) authentication provider
-- ============================================================


-- Resource rows
INSERT INTO public.auths_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2025-11-23T04:09:25.807568+00:00', true, false, false, '019bb25e-e5e2-74bd-8076-85aa2a463638', 'Purdue University (SAML)', 'Purdue BoilerKey via Shibboleth SAML', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8eaf-7d08-901d-eaae318d39e3', 'Purdue BoilerKey via Shibboleth SAML', '2025-11-23T04:09:25.807568+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-701a-8784-4a7e20ffc51c', 'ssoUrl', 'SAML SSO Service URL', false, 1, true, '2025-11-23T04:09:25.809914+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-7021-860b-266da671533f', 'entityId', 'SAML Entity ID', false, 2, true, '2025-11-23T04:09:25.809914+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-7024-971e-93dd94bd826e', 'metadataUrl', 'SAML Metadata URL', false, 3, true, '2025-11-23T04:09:25.809914+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-702b-b227-ad27a15a3193', 'certificate', 'SAML X.509 Certificate', true, 4, true, '2025-11-23T04:09:25.809914+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8eae-7e8e-b8be-231dc5e28b11', 'Purdue University (SAML)', '2025-11-23T04:09:25.807568+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- auth_artifact
INSERT INTO public.auth_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-11-23T04:09:25.807568+00:00', '2025-11-23T15:36:22.017859+00:00', '019b3be4-3117-7af5-b1f7-dc0f5582ce54', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- auth_auths_junction
INSERT INTO public.auth_auths_junction (auth_id, auths_id, active, created_at, generated, mcp) VALUES ('019b3be4-3117-7af5-b1f7-dc0f5582ce54', '019bb25e-e5e2-74bd-8076-85aa2a463638', true, '2025-11-23T04:09:25.807568+00:00', false, false) ON CONFLICT (auth_id, auths_id) DO NOTHING;
-- auth_descriptions_junction
INSERT INTO public.auth_descriptions_junction (auth_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7af5-b1f7-dc0f5582ce54', '019b995c-8eaf-7d08-901d-eaae318d39e3', '2025-11-23T04:09:25.807568+00:00', false, false, true) ON CONFLICT (auth_id, description_id) DO NOTHING;
-- auth_flags_junction
INSERT INTO public.auth_flags_junction (auth_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7af5-b1f7-dc0f5582ce54', '019be334-bfc4-79b2-949c-9f99ea25d2c0', false, '2025-11-23T04:09:25.807568+00:00', false, false, true) ON CONFLICT (auth_id, flag_id) DO NOTHING;
-- auth_items_junction
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7af5-b1f7-dc0f5582ce54', '019b3be4-311a-701a-8784-4a7e20ffc51c', '2025-11-23T04:09:25.809914+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7af5-b1f7-dc0f5582ce54', '019b3be4-311a-7021-860b-266da671533f', '2025-11-23T04:09:25.809914+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7af5-b1f7-dc0f5582ce54', '019b3be4-311a-7024-971e-93dd94bd826e', '2025-11-23T04:09:25.809914+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7af5-b1f7-dc0f5582ce54', '019b3be4-311a-702b-b227-ad27a15a3193', '2025-11-23T04:09:25.809914+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
-- auth_names_junction
INSERT INTO public.auth_names_junction (auth_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7af5-b1f7-dc0f5582ce54', '019b995c-8eae-7e8e-b8be-231dc5e28b11', '2025-11-23T04:09:25.807568+00:00', false, false, true) ON CONFLICT (auth_id, name_id) DO NOTHING;
-- auth_protocols_junction
INSERT INTO public.auth_protocols_junction (auth_id, protocol_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7af5-b1f7-dc0f5582ce54', '019b9fb7-4439-7a12-acef-95c81fe1436d', '2026-01-08T22:25:46.555384+00:00', false, false, true) ON CONFLICT (auth_id, protocol_id) DO NOTHING;
-- auth_slugs_junction
INSERT INTO public.auth_slugs_junction (auth_id, slug_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7af5-b1f7-dc0f5582ce54', '019b9fb7-4447-75c7-9e8a-33be5bb699cf', '2026-01-08T22:25:46.566757+00:00', false, false, true) ON CONFLICT (auth_id, slug_id) DO NOTHING;
