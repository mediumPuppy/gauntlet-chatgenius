-- First delete the bot user's messages and then the user if they exist
DELETE FROM messages WHERE user_id IN (
    SELECT id FROM users WHERE email = 'bot@chatgenius.local'
);
DELETE FROM organization_members WHERE user_id IN (
    SELECT id FROM users WHERE email = 'bot@chatgenius.local'
);
DELETE FROM channel_members WHERE user_id IN (
    SELECT id FROM users WHERE email = 'bot@chatgenius.local'
);
DELETE FROM users WHERE email = 'bot@chatgenius.local';

-- Add is_bot column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;

-- Add unique constraint on email if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_email_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
END $$;

-- Create the bot user
INSERT INTO users (
    email,
    username,
    password_hash,
    is_online,
    ai_enabled,
    is_bot
)
VALUES (
    'bot@chatgenius.local',
    'bot',
    'BOT_NO_LOGIN',
    true,
    true,
    true
)
ON CONFLICT (email) DO UPDATE
SET 
    is_online = true,
    ai_enabled = true,
    is_bot = true;

-- Add bot to all existing organizations
INSERT INTO organization_members (organization_id, user_id, role)
SELECT 
    organizations.id,
    users.id,
    'member'
FROM organizations 
CROSS JOIN users 
WHERE users.email = 'bot@chatgenius.local';

-- Add bot to all existing channels
INSERT INTO channel_members (channel_id, user_id)
SELECT 
    channels.id,
    users.id
FROM channels
CROSS JOIN users 
WHERE users.email = 'bot@chatgenius.local'; 