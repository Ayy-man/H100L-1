-- Migration: Convert 'Adult' category to 'Junior'
-- Run this in Supabase SQL Editor to fix existing data

-- First, check affected rows
SELECT id, form_data->>'playerFullName' as player_name, form_data->>'playerCategory' as category
FROM registrations
WHERE form_data->>'playerCategory' = 'Adult';

-- Update Adult to Junior
UPDATE registrations
SET form_data = jsonb_set(form_data, '{playerCategory}', '"Junior"')
WHERE form_data->>'playerCategory' = 'Adult';

-- Verify update
SELECT id, form_data->>'playerFullName' as player_name, form_data->>'playerCategory' as category
FROM registrations
WHERE form_data->>'playerCategory' = 'Junior';
