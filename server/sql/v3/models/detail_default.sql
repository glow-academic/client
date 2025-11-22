-- Get default model detail for creation (provider enum options)
-- Parameters: none
-- Returns: valid_providers (array of enum values)

SELECT 
    ARRAY['openai', 'gemini', 'custom']::text[] as valid_providers

