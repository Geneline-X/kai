-- Migration: Add location fields to special_contacts for location-based escalation
-- Date: 2026-03-11
-- Description: Adds district and hospital columns to special_contacts table
--              so escalation messages can be routed to contacts based on location.
--              Contacts with NULL district/hospital are global fallback contacts.

ALTER TABLE special_contacts
ADD COLUMN IF NOT EXISTS district TEXT,
ADD COLUMN IF NOT EXISTS hospital TEXT;

-- Add index for efficient location-based lookups
CREATE INDEX IF NOT EXISTS idx_special_contacts_district ON special_contacts(district);
CREATE INDEX IF NOT EXISTS idx_special_contacts_hospital ON special_contacts(hospital);

-- Add a comment explaining the semantics
COMMENT ON COLUMN special_contacts.district IS 'District this contact covers (e.g., Bo, Kenema). NULL = global fallback contact.';
COMMENT ON COLUMN special_contacts.hospital IS 'Specific hospital/facility this contact is assigned to. NULL = covers entire district.';
