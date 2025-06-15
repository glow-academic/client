-- Migration: Rename app_logs.message to app_logs.message_test
-- This migration handles the schema change from the old backup format to the new schema

-- Rename the message column to message_test in app_logs table
ALTER TABLE app_logs RENAME COLUMN message TO message_test; 