CREATE TABLE IF NOT EXISTS vector_stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('workspace', 'channel')),
  workspace_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_store_type CHECK (
    (type = 'workspace' AND workspace_id IS NOT NULL AND channel_id IS NULL) OR
    (type = 'channel' AND channel_id IS NOT NULL AND workspace_id IS NULL)
  )
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_vector_stores_workspace ON vector_stores(workspace_id) WHERE type = 'workspace';
CREATE INDEX IF NOT EXISTS idx_vector_stores_channel ON vector_stores(channel_id) WHERE type = 'channel';

-- Add foreign key only if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'channels_organization_id_fkey'
  ) THEN
    ALTER TABLE channels 
      ADD CONSTRAINT channels_organization_id_fkey 
      FOREIGN KEY (organization_id) 
      REFERENCES organizations(id) 
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

-- Fix existing channels without organization_id
UPDATE channels SET organization_id = (
  SELECT organization_id FROM organization_members 
  WHERE user_id IN (
    SELECT user_id FROM channel_members 
    WHERE channel_id = channels.id
  ) LIMIT 1
) WHERE organization_id IS NULL; 