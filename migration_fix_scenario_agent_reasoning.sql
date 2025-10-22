-- Migration: Fix scenario agent reasoning to 'none' to prevent reasoning_effort parameter errors
-- Date: $(date +%Y%m%d_%H%M%S)
-- Description: Set the scenario agent's reasoning from 'medium' to 'none' to avoid 
--              unsupported reasoning_effort parameter errors with gpt-4.1 model

-- Update the scenario agent's reasoning to 'none'
UPDATE agents 
SET reasoning = 'none'::reasoning_effort,
    updated_at = NOW()
WHERE id = '88888888-8888-8888-8888-888888888888' 
  AND name = 'Scenario'
  AND reasoning = 'medium';

-- Verify the update
SELECT id, name, reasoning, updated_at 
FROM agents 
WHERE id = '88888888-8888-8888-8888-888888888888';
