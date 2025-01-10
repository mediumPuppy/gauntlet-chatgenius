-- Create direct_messages table
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID REFERENCES users(id),
  user2_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user1_id, user2_id)
);

-- Add dm_id column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS dm_id UUID REFERENCES direct_messages(id);

-- Add constraint if it doesn't exist (note: constraints need different syntax)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_target_check'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT message_target_check 
      CHECK ((channel_id IS NOT NULL AND dm_id IS NULL) 
             OR (channel_id IS NULL AND dm_id IS NOT NULL));
  END IF;
END $$; 