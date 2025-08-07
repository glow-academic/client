-- Migration to convert temperature columns from integer to real
-- This handles the case where existing data might be stored as integers (0-100)
-- and converts them to real values (0.0-1.0)

-- Convert personas temperature from integer to real
-- First, update any existing integer values to be divided by 100
UPDATE personas 
SET temperature = temperature / 100.0 
WHERE temperature > 1.0;

-- Convert agents temperature from integer to real  
-- First, update any existing integer values to be divided by 100
UPDATE agents 
SET temperature = temperature / 100.0 
WHERE temperature > 1.0;

-- Note: The actual column type change from integer to real 
-- was already done by the init.sql script, so we just need to 
-- ensure the data is in the correct format (0.0-1.0) 