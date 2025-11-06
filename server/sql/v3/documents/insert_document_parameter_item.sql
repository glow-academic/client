INSERT INTO document_parameter_items (document_id, parameter_item_id)
VALUES ($1, $2)
ON CONFLICT (document_id, parameter_item_id) DO NOTHING
