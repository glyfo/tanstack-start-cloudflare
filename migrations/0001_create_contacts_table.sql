-- Create contacts table for workflow contact creation
-- Stores contact information collected through the contact_creation workflow

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Contact Information (from workflow)
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  company TEXT,
  job_title TEXT,
  address TEXT,
  birthday TEXT,
  relationship TEXT,
  notes TEXT,
  
  -- Metadata
  session_id TEXT NOT NULL,
  created_by_agent TEXT DEFAULT 'system',
  created_at TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexing for common queries
  UNIQUE(email),
  INDEX idx_session_id (session_id),
  INDEX idx_created_at (created_at)
);

-- Create audit log table for workflow submissions
CREATE TABLE IF NOT EXISTS workflow_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Workflow Info
  workflow_id TEXT NOT NULL,
  workflow_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'submitted',
  data TEXT NOT NULL,
  
  -- Timestamps
  created_at TEXT NOT NULL,
  
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_session_id (session_id),
  INDEX idx_workflow_type (workflow_type)
);
