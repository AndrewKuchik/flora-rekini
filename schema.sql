CREATE TABLE IF NOT EXISTS workspace_state (
  workspace TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
