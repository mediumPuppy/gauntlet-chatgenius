-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR UNIQUE NOT NULL,
    username VARCHAR NOT NULL,
    password_hash VARCHAR NOT NULL,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ai_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_members (
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS organization_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR NOT NULL,
    email VARCHAR,
    invited_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    is_dm BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channel_members (
    channel_id UUID NOT NULL REFERENCES channels(id),
    user_id UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID REFERENCES users(id),
    user2_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    user_id UUID REFERENCES users(id),
    channel_id UUID REFERENCES channels(id),
    dm_id UUID REFERENCES direct_messages(id),
    parent_id UUID REFERENCES messages(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    has_replies BOOLEAN DEFAULT false,
    reply_count INTEGER DEFAULT 0,
    bot_message BOOLEAN DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id),
    user_id UUID NOT NULL REFERENCES users(id),
    emoji VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vector_stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    channel_id UUID REFERENCES channels(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Add is_bot column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_bot'
    ) THEN
        ALTER TABLE users ADD COLUMN is_bot BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create the bot user if it doesn't exist
INSERT INTO users (
    email,
    username,
    password_hash,
    is_online,
    ai_enabled,
    is_bot
)
SELECT 
    'bot@chatgenius.local',
    'bot',
    'BOT_NO_LOGIN',
    true,
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'bot@chatgenius.local'
)
ON CONFLICT (email) DO UPDATE
SET 
    is_online = true,
    ai_enabled = true,
    is_bot = true;

-- Create function to add bot to new organizations if it doesn't exist
CREATE OR REPLACE FUNCTION add_bot_to_new_organization()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO organization_members (organization_id, user_id, role)
    SELECT 
        NEW.id,
        users.id,
        'MEMBER'
    FROM users 
    WHERE users.email = 'bot@chatgenius.local'
    AND NOT EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_id = NEW.id 
        AND user_id = users.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new organizations if it doesn't exist
DROP TRIGGER IF EXISTS trigger_add_bot_to_organization ON organizations;
CREATE TRIGGER trigger_add_bot_to_organization
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION add_bot_to_new_organization();

-- Create function to add bot to new channels if it doesn't exist
CREATE OR REPLACE FUNCTION add_bot_to_new_channel()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO channel_members (channel_id, user_id)
    SELECT 
        NEW.id,
        users.id
    FROM users 
    WHERE users.email = 'bot@chatgenius.local'
    AND NOT EXISTS (
        SELECT 1 FROM channel_members 
        WHERE channel_id = NEW.id 
        AND user_id = users.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new channels if it doesn't exist
DROP TRIGGER IF EXISTS trigger_add_bot_to_channel ON channels;
CREATE TRIGGER trigger_add_bot_to_channel
    AFTER INSERT ON channels
    FOR EACH ROW
    EXECUTE FUNCTION add_bot_to_new_channel();

-- Add bot to all existing organizations if not already a member
INSERT INTO organization_members (organization_id, user_id, role)
SELECT 
    organizations.id,
    users.id,
    'MEMBER'
FROM organizations 
CROSS JOIN users 
WHERE users.email = 'bot@chatgenius.local'
AND NOT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_id = organizations.id 
    AND user_id = users.id
);

-- Add bot to all existing channels if not already a member
INSERT INTO channel_members (channel_id, user_id)
SELECT 
    channels.id,
    users.id
FROM channels
CROSS JOIN users 
WHERE users.email = 'bot@chatgenius.local'
AND NOT EXISTS (
    SELECT 1 FROM channel_members 
    WHERE channel_id = channels.id 
    AND user_id = users.id
); 