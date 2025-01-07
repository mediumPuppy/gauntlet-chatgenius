-- Drop existing table and its dependencies
DROP TABLE IF EXISTS organization_invites CASCADE;

-- Recreate the table with the correct structure
CREATE TABLE organization_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    code VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE
);

-- Add constraints
ALTER TABLE organization_invites ADD CONSTRAINT organization_invites_code_key UNIQUE (code);

-- Create indexes
CREATE INDEX idx_org_invites_code ON organization_invites(code);
CREATE INDEX idx_org_invites_org ON organization_invites(organization_id);
CREATE INDEX idx_org_invites_expires ON organization_invites(expires_at); 