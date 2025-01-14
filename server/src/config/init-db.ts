import pool, { testConnection } from "./database";

const initializeDatabase = async () => {
  try {
    // Test connection first
    await testConnection();

    // Enable UUID extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR NOT NULL,
        username VARCHAR NOT NULL,
        password_hash VARCHAR NOT NULL,
        is_online BOOLEAN DEFAULT false,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ai_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create organizations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create organization_members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organization_members (
        organization_id UUID NOT NULL REFERENCES organizations(id),
        user_id UUID NOT NULL REFERENCES users(id),
        role VARCHAR NOT NULL,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (organization_id, user_id)
      )
    `);

    // Create organization_invites table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organization_invites (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        code VARCHAR NOT NULL,
        email VARCHAR,
        invited_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        accepted_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Create channels table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR NOT NULL,
        organization_id UUID REFERENCES organizations(id),
        is_dm BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create channel_members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS channel_members (
        channel_id UUID NOT NULL REFERENCES channels(id),
        user_id UUID NOT NULL REFERENCES users(id),
        PRIMARY KEY (channel_id, user_id)
      )
    `);

    // Create direct_messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user1_id UUID REFERENCES users(id),
        user2_id UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        content TEXT NOT NULL,
        user_id UUID REFERENCES users(id),
        channel_id UUID REFERENCES channels(id),
        dm_id UUID REFERENCES direct_messages(id),
        parent_id UUID REFERENCES messages(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        has_replies BOOLEAN DEFAULT false,
        reply_count INTEGER DEFAULT 0
      )
    `);

    // Create message_reactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        message_id UUID NOT NULL REFERENCES messages(id),
        user_id UUID NOT NULL REFERENCES users(id),
        emoji VARCHAR NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create vector_stores table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vector_stores (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        organization_id UUID REFERENCES organizations(id),
        channel_id UUID REFERENCES channels(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create migrations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id)",
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)",
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id)",
    );
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
};

export default initializeDatabase;
