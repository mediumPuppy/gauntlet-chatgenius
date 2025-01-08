-- Add attachments column to messages table
ALTER TABLE messages ADD COLUMN attachments TEXT[];

-- Create index for faster queries on messages with attachments
CREATE INDEX idx_messages_attachments ON messages USING GIN (attachments); 