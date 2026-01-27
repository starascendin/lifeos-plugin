package storage

import (
	"database/sql"
	"time"

	"github.com/starascendin/claude-agent-farm/controlplane/internal/mcp"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/models"
	_ "modernc.org/sqlite"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(dbPath string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	store := &SQLiteStore{db: db}
	if err := store.migrate(); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *SQLiteStore) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS agent_configs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		repos TEXT DEFAULT '',
		task_prompt TEXT DEFAULT '',
		system_prompt TEXT DEFAULT '',
		max_turns INTEGER DEFAULT 50,
		max_budget_usd REAL DEFAULT 10.0,
		cpu_limit TEXT DEFAULT '1000m',
		memory_limit TEXT DEFAULT '2Gi',
		allowed_tools TEXT DEFAULT 'Read,Write,Edit,Bash,Glob,Grep',
		enabled_mcps TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_agent_configs_name ON agent_configs(name);

	CREATE TABLE IF NOT EXISTS mcp_servers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		command TEXT NOT NULL,
		args TEXT DEFAULT '[]',
		env TEXT DEFAULT '{}',
		description TEXT DEFAULT '',
		enabled INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON mcp_servers(name);

	CREATE TABLE IF NOT EXISTS mcp_toml_configs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		content TEXT NOT NULL,
		is_default INTEGER DEFAULT 0,
		enabled INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_mcp_toml_configs_name ON mcp_toml_configs(name);

	CREATE TABLE IF NOT EXISTS skills (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		install_command TEXT NOT NULL,
		description TEXT DEFAULT '',
		category TEXT DEFAULT 'other',
		is_builtin INTEGER DEFAULT 0,
		enabled INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
	`
	_, err := s.db.Exec(schema)
	if err != nil {
		return err
	}

	// Add enabled_mcps column if it doesn't exist (for existing databases)
	_, _ = s.db.Exec("ALTER TABLE agent_configs ADD COLUMN enabled_mcps TEXT DEFAULT ''")

	// Add enabled_skills column if it doesn't exist (for existing databases)
	_, _ = s.db.Exec("ALTER TABLE agent_configs ADD COLUMN enabled_skills TEXT DEFAULT ''")

	// Add enabled column to mcp_toml_configs if it doesn't exist
	_, _ = s.db.Exec("ALTER TABLE mcp_toml_configs ADD COLUMN enabled INTEGER DEFAULT 0")

	// Seed default TOML config if it doesn't exist
	s.seedDefaultTomlConfig()

	// Enable defaults config by default
	_, _ = s.db.Exec("UPDATE mcp_toml_configs SET enabled = 1 WHERE is_default = 1")

	// Seed skills from presets.toml
	s.seedSkillsFromPresets()

	return nil
}

// seedDefaultTomlConfig creates the default TOML config with playwright and github
func (s *SQLiteStore) seedDefaultTomlConfig() {
	defaultToml := `# Default MCP Servers
# These are the recommended defaults

[servers.playwright]
command = "npx"
args = ["-y", "@anthropic/mcp-server-playwright"]
description = "Browser automation with Playwright"

[servers.github]
command = "npx"
args = ["-y", "@anthropic/mcp-server-github"]
env = { GITHUB_TOKEN = "${GITHUB_PAT}" }
description = "GitHub API access"
`
	// Only insert if doesn't exist
	_, _ = s.db.Exec(`
		INSERT OR IGNORE INTO mcp_toml_configs (name, content, is_default)
		VALUES ('defaults', ?, 1)
	`, defaultToml)
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

// CreateConfig creates a new agent configuration
func (s *SQLiteStore) CreateConfig(config *models.AgentConfig) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO agent_configs (name, repos, task_prompt, system_prompt, max_turns, max_budget_usd, cpu_limit, memory_limit, allowed_tools, enabled_mcps, enabled_skills)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, config.Name, config.Repos, config.TaskPrompt, config.SystemPrompt, config.MaxTurns, config.MaxBudgetUSD, config.CPULimit, config.MemoryLimit, config.AllowedTools, config.EnabledMCPs, config.EnabledSkills)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// GetConfig retrieves a config by ID
func (s *SQLiteStore) GetConfig(id int64) (*models.AgentConfig, error) {
	config := &models.AgentConfig{}
	err := s.db.QueryRow(`
		SELECT id, name, repos, task_prompt, system_prompt, max_turns, max_budget_usd, cpu_limit, memory_limit, allowed_tools, COALESCE(enabled_mcps, ''), COALESCE(enabled_skills, ''), created_at, updated_at
		FROM agent_configs WHERE id = ?
	`, id).Scan(&config.ID, &config.Name, &config.Repos, &config.TaskPrompt, &config.SystemPrompt, &config.MaxTurns, &config.MaxBudgetUSD, &config.CPULimit, &config.MemoryLimit, &config.AllowedTools, &config.EnabledMCPs, &config.EnabledSkills, &config.CreatedAt, &config.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return config, nil
}

// ListConfigs returns all agent configurations
func (s *SQLiteStore) ListConfigs() ([]models.AgentConfig, error) {
	rows, err := s.db.Query(`
		SELECT id, name, repos, task_prompt, system_prompt, max_turns, max_budget_usd, cpu_limit, memory_limit, allowed_tools, COALESCE(enabled_mcps, ''), COALESCE(enabled_skills, ''), created_at, updated_at
		FROM agent_configs ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var configs []models.AgentConfig
	for rows.Next() {
		var config models.AgentConfig
		if err := rows.Scan(&config.ID, &config.Name, &config.Repos, &config.TaskPrompt, &config.SystemPrompt, &config.MaxTurns, &config.MaxBudgetUSD, &config.CPULimit, &config.MemoryLimit, &config.AllowedTools, &config.EnabledMCPs, &config.EnabledSkills, &config.CreatedAt, &config.UpdatedAt); err != nil {
			return nil, err
		}
		configs = append(configs, config)
	}
	return configs, nil
}

// UpdateConfig updates an existing configuration
func (s *SQLiteStore) UpdateConfig(config *models.AgentConfig) error {
	_, err := s.db.Exec(`
		UPDATE agent_configs
		SET name = ?, repos = ?, task_prompt = ?, system_prompt = ?, max_turns = ?, max_budget_usd = ?, cpu_limit = ?, memory_limit = ?, allowed_tools = ?, enabled_mcps = ?, enabled_skills = ?, updated_at = ?
		WHERE id = ?
	`, config.Name, config.Repos, config.TaskPrompt, config.SystemPrompt, config.MaxTurns, config.MaxBudgetUSD, config.CPULimit, config.MemoryLimit, config.AllowedTools, config.EnabledMCPs, config.EnabledSkills, time.Now(), config.ID)
	return err
}

// DeleteConfig deletes a configuration by ID
func (s *SQLiteStore) DeleteConfig(id int64) error {
	_, err := s.db.Exec("DELETE FROM agent_configs WHERE id = ?", id)
	return err
}

// --- MCP Server Methods ---

// ListMCPServers returns all MCP server configurations
func (s *SQLiteStore) ListMCPServers() ([]models.MCPServer, error) {
	rows, err := s.db.Query(`
		SELECT id, name, command, args, env, description, enabled, created_at, updated_at
		FROM mcp_servers ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var servers []models.MCPServer
	for rows.Next() {
		var server models.MCPServer
		var enabled int
		if err := rows.Scan(&server.ID, &server.Name, &server.Command, &server.Args, &server.Env, &server.Description, &enabled, &server.CreatedAt, &server.UpdatedAt); err != nil {
			return nil, err
		}
		server.Enabled = enabled == 1
		servers = append(servers, server)
	}
	return servers, nil
}

// GetMCPServer retrieves an MCP server by name
func (s *SQLiteStore) GetMCPServer(name string) (*models.MCPServer, error) {
	server := &models.MCPServer{}
	var enabled int
	err := s.db.QueryRow(`
		SELECT id, name, command, args, env, description, enabled, created_at, updated_at
		FROM mcp_servers WHERE name = ?
	`, name).Scan(&server.ID, &server.Name, &server.Command, &server.Args, &server.Env, &server.Description, &enabled, &server.CreatedAt, &server.UpdatedAt)
	if err != nil {
		return nil, err
	}
	server.Enabled = enabled == 1
	return server, nil
}

// GetMCPServersByNames retrieves multiple MCP servers by their names
func (s *SQLiteStore) GetMCPServersByNames(names []string) ([]models.MCPServer, error) {
	if len(names) == 0 {
		return []models.MCPServer{}, nil
	}

	// Build query with placeholders
	placeholders := ""
	args := make([]interface{}, len(names))
	for i, name := range names {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args[i] = name
	}

	query := `
		SELECT id, name, command, args, env, description, enabled, created_at, updated_at
		FROM mcp_servers WHERE name IN (` + placeholders + `) AND enabled = 1
	`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var servers []models.MCPServer
	for rows.Next() {
		var server models.MCPServer
		var enabled int
		if err := rows.Scan(&server.ID, &server.Name, &server.Command, &server.Args, &server.Env, &server.Description, &enabled, &server.CreatedAt, &server.UpdatedAt); err != nil {
			return nil, err
		}
		server.Enabled = enabled == 1
		servers = append(servers, server)
	}
	return servers, nil
}

// UpsertMCPServer creates or updates an MCP server
func (s *SQLiteStore) UpsertMCPServer(server *models.MCPServer) error {
	enabled := 0
	if server.Enabled {
		enabled = 1
	}

	_, err := s.db.Exec(`
		INSERT INTO mcp_servers (name, command, args, env, description, enabled, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(name) DO UPDATE SET
			command = excluded.command,
			args = excluded.args,
			env = excluded.env,
			description = excluded.description,
			enabled = excluded.enabled,
			updated_at = excluded.updated_at
	`, server.Name, server.Command, server.Args, server.Env, server.Description, enabled, time.Now())
	return err
}

// BulkUpsertMCPServers creates or updates multiple MCP servers
func (s *SQLiteStore) BulkUpsertMCPServers(servers []models.MCPServer) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO mcp_servers (name, command, args, env, description, enabled, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(name) DO UPDATE SET
			command = excluded.command,
			args = excluded.args,
			env = excluded.env,
			description = excluded.description,
			enabled = excluded.enabled,
			updated_at = excluded.updated_at
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now()
	for _, server := range servers {
		enabled := 0
		if server.Enabled {
			enabled = 1
		}
		if _, err := stmt.Exec(server.Name, server.Command, server.Args, server.Env, server.Description, enabled, now); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// DeleteMCPServer deletes an MCP server by name
func (s *SQLiteStore) DeleteMCPServer(name string) error {
	_, err := s.db.Exec("DELETE FROM mcp_servers WHERE name = ?", name)
	return err
}

// --- MCP TOML Config Methods ---

// ListTomlConfigs returns all TOML configurations
func (s *SQLiteStore) ListTomlConfigs() ([]models.MCPTomlConfig, error) {
	rows, err := s.db.Query(`
		SELECT id, name, content, is_default, COALESCE(enabled, 0), created_at, updated_at
		FROM mcp_toml_configs ORDER BY is_default DESC, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var configs []models.MCPTomlConfig
	for rows.Next() {
		var config models.MCPTomlConfig
		var isDefault, enabled int
		if err := rows.Scan(&config.ID, &config.Name, &config.Content, &isDefault, &enabled, &config.CreatedAt, &config.UpdatedAt); err != nil {
			return nil, err
		}
		config.IsDefault = isDefault == 1
		config.Enabled = enabled == 1
		configs = append(configs, config)
	}
	return configs, nil
}

// GetTomlConfig retrieves a TOML config by name
func (s *SQLiteStore) GetTomlConfig(name string) (*models.MCPTomlConfig, error) {
	config := &models.MCPTomlConfig{}
	var isDefault, enabled int
	err := s.db.QueryRow(`
		SELECT id, name, content, is_default, COALESCE(enabled, 0), created_at, updated_at
		FROM mcp_toml_configs WHERE name = ?
	`, name).Scan(&config.ID, &config.Name, &config.Content, &isDefault, &enabled, &config.CreatedAt, &config.UpdatedAt)
	if err != nil {
		return nil, err
	}
	config.IsDefault = isDefault == 1
	config.Enabled = enabled == 1
	return config, nil
}

// CreateTomlConfig creates a new TOML config
func (s *SQLiteStore) CreateTomlConfig(config *models.MCPTomlConfig) (int64, error) {
	isDefault := 0
	if config.IsDefault {
		isDefault = 1
	}
	result, err := s.db.Exec(`
		INSERT INTO mcp_toml_configs (name, content, is_default)
		VALUES (?, ?, ?)
	`, config.Name, config.Content, isDefault)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// UpdateTomlConfig updates a TOML config (cannot update default configs)
func (s *SQLiteStore) UpdateTomlConfig(name string, content string) error {
	_, err := s.db.Exec(`
		UPDATE mcp_toml_configs
		SET content = ?, updated_at = ?
		WHERE name = ?
	`, content, time.Now(), name)
	return err
}

// DeleteTomlConfig deletes a TOML config by name (cannot delete default configs)
func (s *SQLiteStore) DeleteTomlConfig(name string) error {
	_, err := s.db.Exec("DELETE FROM mcp_toml_configs WHERE name = ? AND is_default = 0", name)
	return err
}

// ToggleTomlConfig enables or disables a TOML config
func (s *SQLiteStore) ToggleTomlConfig(name string, enabled bool) error {
	enabledInt := 0
	if enabled {
		enabledInt = 1
	}
	_, err := s.db.Exec(`
		UPDATE mcp_toml_configs
		SET enabled = ?, updated_at = ?
		WHERE name = ?
	`, enabledInt, time.Now(), name)
	return err
}

// GetEnabledTomlConfigs returns all enabled TOML configurations
func (s *SQLiteStore) GetEnabledTomlConfigs() ([]models.MCPTomlConfig, error) {
	rows, err := s.db.Query(`
		SELECT id, name, content, is_default, enabled, created_at, updated_at
		FROM mcp_toml_configs WHERE enabled = 1 ORDER BY is_default DESC, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var configs []models.MCPTomlConfig
	for rows.Next() {
		var config models.MCPTomlConfig
		var isDefault, enabled int
		if err := rows.Scan(&config.ID, &config.Name, &config.Content, &isDefault, &enabled, &config.CreatedAt, &config.UpdatedAt); err != nil {
			return nil, err
		}
		config.IsDefault = isDefault == 1
		config.Enabled = enabled == 1
		configs = append(configs, config)
	}
	return configs, nil
}

// --- Skill Methods ---

// seedSkillsFromPresets seeds the skills table from presets.toml
func (s *SQLiteStore) seedSkillsFromPresets() {
	presets, err := mcp.LoadPresets()
	if err != nil {
		return
	}

	for _, skill := range presets.Skills {
		// Only insert if doesn't exist
		_, _ = s.db.Exec(`
			INSERT OR IGNORE INTO skills (name, install_command, description, category, is_builtin, enabled)
			VALUES (?, ?, ?, ?, 1, 1)
		`, skill.Name, skill.InstallCommand, skill.Description, skill.Category)
	}
}

// ListSkills returns all skills
func (s *SQLiteStore) ListSkills() ([]models.Skill, error) {
	rows, err := s.db.Query(`
		SELECT id, name, install_command, description, category, is_builtin, enabled, created_at, updated_at
		FROM skills ORDER BY category, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var skills []models.Skill
	for rows.Next() {
		var skill models.Skill
		var isBuiltin, enabled int
		if err := rows.Scan(&skill.ID, &skill.Name, &skill.InstallCommand, &skill.Description, &skill.Category, &isBuiltin, &enabled, &skill.CreatedAt, &skill.UpdatedAt); err != nil {
			return nil, err
		}
		skill.IsBuiltin = isBuiltin == 1
		skill.Enabled = enabled == 1
		skills = append(skills, skill)
	}
	return skills, nil
}

// GetSkill retrieves a skill by name
func (s *SQLiteStore) GetSkill(name string) (*models.Skill, error) {
	skill := &models.Skill{}
	var isBuiltin, enabled int
	err := s.db.QueryRow(`
		SELECT id, name, install_command, description, category, is_builtin, enabled, created_at, updated_at
		FROM skills WHERE name = ?
	`, name).Scan(&skill.ID, &skill.Name, &skill.InstallCommand, &skill.Description, &skill.Category, &isBuiltin, &enabled, &skill.CreatedAt, &skill.UpdatedAt)
	if err != nil {
		return nil, err
	}
	skill.IsBuiltin = isBuiltin == 1
	skill.Enabled = enabled == 1
	return skill, nil
}

// CreateSkill creates a new skill
func (s *SQLiteStore) CreateSkill(skill *models.Skill) (int64, error) {
	isBuiltin := 0
	if skill.IsBuiltin {
		isBuiltin = 1
	}
	enabled := 1
	if !skill.Enabled {
		enabled = 0
	}

	result, err := s.db.Exec(`
		INSERT INTO skills (name, install_command, description, category, is_builtin, enabled)
		VALUES (?, ?, ?, ?, ?, ?)
	`, skill.Name, skill.InstallCommand, skill.Description, skill.Category, isBuiltin, enabled)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// UpdateSkill updates an existing skill
func (s *SQLiteStore) UpdateSkill(skill *models.Skill) error {
	enabled := 1
	if !skill.Enabled {
		enabled = 0
	}

	_, err := s.db.Exec(`
		UPDATE skills
		SET install_command = ?, description = ?, category = ?, enabled = ?, updated_at = ?
		WHERE name = ?
	`, skill.InstallCommand, skill.Description, skill.Category, enabled, time.Now(), skill.Name)
	return err
}

// DeleteSkill deletes a skill by name (cannot delete builtin skills)
func (s *SQLiteStore) DeleteSkill(name string) error {
	_, err := s.db.Exec("DELETE FROM skills WHERE name = ? AND is_builtin = 0", name)
	return err
}

// ToggleSkill enables or disables a skill
func (s *SQLiteStore) ToggleSkill(name string, enabled bool) error {
	enabledInt := 0
	if enabled {
		enabledInt = 1
	}
	_, err := s.db.Exec(`
		UPDATE skills SET enabled = ?, updated_at = ? WHERE name = ?
	`, enabledInt, time.Now(), name)
	return err
}

// GetEnabledSkills returns all enabled skills
func (s *SQLiteStore) GetEnabledSkills() ([]models.Skill, error) {
	rows, err := s.db.Query(`
		SELECT id, name, install_command, description, category, is_builtin, enabled, created_at, updated_at
		FROM skills WHERE enabled = 1 ORDER BY category, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var skills []models.Skill
	for rows.Next() {
		var skill models.Skill
		var isBuiltin, enabled int
		if err := rows.Scan(&skill.ID, &skill.Name, &skill.InstallCommand, &skill.Description, &skill.Category, &isBuiltin, &enabled, &skill.CreatedAt, &skill.UpdatedAt); err != nil {
			return nil, err
		}
		skill.IsBuiltin = isBuiltin == 1
		skill.Enabled = enabled == 1
		skills = append(skills, skill)
	}
	return skills, nil
}

// GetSkillInstallCommands returns install commands for the given comma-separated skill names
func (s *SQLiteStore) GetSkillInstallCommands(skillNames string) ([]string, error) {
	if skillNames == "" {
		return nil, nil
	}

	names := mcp.ParseCommaSeparated(skillNames)
	if len(names) == 0 {
		return nil, nil
	}

	// Build query with placeholders
	placeholders := ""
	args := make([]interface{}, len(names))
	for i, name := range names {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args[i] = name
	}

	query := `SELECT install_command FROM skills WHERE name IN (` + placeholders + `) AND enabled = 1`
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var commands []string
	for rows.Next() {
		var cmd string
		if err := rows.Scan(&cmd); err != nil {
			return nil, err
		}
		commands = append(commands, cmd)
	}
	return commands, nil
}
