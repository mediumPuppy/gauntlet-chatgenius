-- Add columns for threading
ALTER TABLE messages
  ADD COLUMN parent_id UUID REFERENCES messages(id),
  ADD COLUMN has_replies BOOLEAN DEFAULT false,
  ADD COLUMN reply_count INT DEFAULT 0;

-- Create indexes
CREATE INDEX idx_messages_parent_id ON messages(parent_id);
CREATE INDEX idx_messages_has_replies ON messages(has_replies);

-- (Optional) Update existing rows to set has_replies and reply_count 
-- based on existing data. This part depends on the data you already have:
-- (Pseudo-code for illustration; adapt to your schema.)
-- UPDATE messages m
-- SET has_replies = true, 
--     reply_count = sub.reply_count
-- FROM (
--     SELECT parent_id, COUNT(*) AS reply_count
--     FROM messages
--     WHERE parent_id IS NOT NULL
--     GROUP BY parent_id
-- ) sub
-- WHERE m.id = sub.parent_id; 