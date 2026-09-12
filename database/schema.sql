-- BLACKSENTINEL AI - Clean Database Schema
-- Only super admin user - all other data starts empty
-- Each company configures their own data after deployment

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  company VARCHAR(255),
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'default',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,
  actor VARCHAR(128) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id VARCHAR(128),
  details JSONB,
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'default',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- ============================================================================
-- ALERTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  source VARCHAR(100) NOT NULL,
  source_id VARCHAR(255),
  mitre_mapping JSONB,
  confidence FLOAT DEFAULT 0.5,
  assigned_to UUID REFERENCES users(id),
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'default',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);

-- ============================================================================
-- INCIDENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  related_alerts UUID[],
  related_entities JSONB,
  timeline JSONB DEFAULT '[]',
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'default',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id);

-- ============================================================================
-- INVESTIGATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  assigned_to VARCHAR(100),
  findings JSONB DEFAULT '[]',
  evidence JSONB DEFAULT '[]',
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'default',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investigations_status ON investigations(status);
CREATE INDEX IF NOT EXISTS idx_investigations_severity ON investigations(severity);
CREATE INDEX IF NOT EXISTS idx_investigations_tenant ON investigations(tenant_id);

-- ============================================================================
-- PLAYBOOKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  trigger_condition VARCHAR(100),
  steps JSONB DEFAULT '[]',
  success_rate FLOAT DEFAULT 0,
  last_used_at TIMESTAMP,
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'default',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_tenant ON playbooks(tenant_id);

-- ============================================================================
-- THREAT INTEL (IOCS) TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS iocs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  value VARCHAR(500) NOT NULL,
  threat_type VARCHAR(100),
  confidence FLOAT DEFAULT 0.5,
  source VARCHAR(100),
  description TEXT,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'default',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iocs_type ON iocs(type);
CREATE INDEX IF NOT EXISTS idx_iocs_value ON iocs(value);
CREATE INDEX IF NOT EXISTS idx_iocs_tenant ON iocs(tenant_id);

-- ============================================================================
-- MEMORY ENTRIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  embedding FLOAT8[],
  metadata JSONB,
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'default',
  access_count INTEGER DEFAULT 0,
  relevance_score FLOAT DEFAULT 1.0,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(type);
CREATE INDEX IF NOT EXISTS idx_memory_tenant ON memory_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memory_created ON memory_entries(created_at);

-- ============================================================================
-- MODELS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  version VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  endpoint VARCHAR(500),
  capabilities JSONB,
  status VARCHAR(20) DEFAULT 'inactive',
  metrics JSONB,
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'default',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_models_type ON models(type);
CREATE INDEX IF NOT EXISTS idx_models_status ON models(status);
CREATE INDEX IF NOT EXISTS idx_models_tenant ON models(tenant_id);

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500),
  user_id UUID REFERENCES users(id),
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'default',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON conversation_messages(conversation_id);

-- ============================================================================
-- KNOWLEDGE GRAPH TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS kg_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  properties JSONB DEFAULT '{}',
  embedding FLOAT8[],
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'default',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kg_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES kg_nodes(id) ON DELETE CASCADE,
  target_id UUID REFERENCES kg_nodes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  properties JSONB DEFAULT '{}',
  weight FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON kg_nodes(type);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_name ON kg_nodes(name);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_tenant ON kg_nodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON kg_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON kg_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_type ON kg_edges(type);

-- ============================================================================
-- SEED DATA - SUPER ADMIN ONLY
-- Password: Admin123! (bcrypt hash)
-- ============================================================================

INSERT INTO users (email, name, password_hash, role, company, tenant_id) VALUES
  ('admin@blacksentinel.ai', 'Super Administrator', '$2a$10$pkJxCyLoV/KI0LKP2YXsiuQLukQSm75Foxd7c4EAW6m6DXuqcGvM6', 'admin', 'BlackSentinel AI', 'default')
ON CONFLICT (email) DO NOTHING;
