-- Migration to add last_greeting_date to users table
-- This allows tracking when the user was last greeted to avoid repetitive full introductions

ALTER TABLE users ADD COLUMN last_greeting_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN users.last_greeting_date IS 'The date (YYYY-MM-DD) when the user was last sent a full greeting introduction';
