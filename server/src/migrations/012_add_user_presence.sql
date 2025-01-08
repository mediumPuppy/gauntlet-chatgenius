-- Add presence columns to users table
ALTER TABLE users ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT false;

-- Create index for faster presence lookups
CREATE INDEX idx_users_online ON users(is_online);
CREATE INDEX idx_users_last_seen ON users(last_seen); 