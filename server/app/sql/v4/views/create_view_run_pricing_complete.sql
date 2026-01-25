-- View: view_run_pricing_complete
-- Combines run_pricing_entry with unit information for cost calculation.
-- Write to _entry tables, read from this _view.
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_run_pricing_complete AS
SELECT
    rp.run_id,
    rp.pricing_type,
    rp.count,
    rp.unit_id,
    rp.created_at,
    rp.updated_at,
    rp.generated,
    rp.mcp,
    rp.active,
    -- Join with artifact_units_relation for unit info
    u.name AS unit_name,
    u.unit_category,
    u.value AS unit_value
FROM run_pricing_entry rp
LEFT JOIN artifact_units_relation u ON rp.unit_id = u.id AND u.active = true
WHERE rp.active = true;
