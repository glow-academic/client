SELECT COUNT(DISTINCT spi.scenario_id) as usage_count
FROM parameter_items pi
JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
WHERE pi.parameter_id = $1 AND spi.active = true

