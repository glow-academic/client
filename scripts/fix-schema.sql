-- Migration script to alter the quizzes table and allow NULL document_id

-- First, drop the foreign key constraint
ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_document_id_fkey;

-- Then alter the column to allow NULL values
ALTER TABLE quizzes ALTER COLUMN document_id DROP NOT NULL;

-- Finally, add back the foreign key constraint with ON DELETE SET NULL
ALTER TABLE quizzes ADD CONSTRAINT quizzes_document_id_fkey 
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;

-- Clean up orphaned quizzes that reference documents we want to delete
-- You can uncomment this if you want to delete the quizzes instead of fixing them
-- DELETE FROM quizzes WHERE document_id NOT IN (SELECT id FROM documents);
