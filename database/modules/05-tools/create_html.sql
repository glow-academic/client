-- Module: create_html
-- Category: tool
-- Description: create_html tool (document HTML generation)
-- ============================================================


-- Resource rows
INSERT INTO public.tools_resource (created_at, active, generated, mcp, id, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('2026-01-13T23:48:20.098044+00:00', true, false, false, '019bebc4-d436-7bcc-b38a-2799877eb259', 'create_html', 'Generate the Jinja template HTML for the document.', '{}', 'create', '{}', '{}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;
