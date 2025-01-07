-- Add email column to organization_invites table
ALTER TABLE organization_invites ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Make expires_at NOT NULL if it isn't already
ALTER TABLE organization_invites ALTER COLUMN expires_at SET NOT NULL; 