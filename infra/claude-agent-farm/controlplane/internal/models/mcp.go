package models

import (
	"time"
)

// MCPServer represents an MCP server configuration stored in the database
type MCPServer struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Command     string    `json:"command"`
	Args        string    `json:"args"`        // JSON array
	Env         string    `json:"env"`         // JSON object
	Description string    `json:"description"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// MCPServerConfig is the runtime configuration for an MCP server (used in JSON generation)
type MCPServerConfig struct {
	Command string            `json:"command"`
	Args    []string          `json:"args,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
}

// MCPConfig is the full MCP configuration structure for Claude
type MCPConfig struct {
	MCPServers map[string]MCPServerConfig `json:"mcpServers"`
}

// MCPTomlConfig represents a named TOML configuration file stored in the database
type MCPTomlConfig struct {
	ID        int64     `json:"id"`
	ConvexID  string    `json:"convex_id,omitempty"` // Convex document ID
	Name      string    `json:"name"`                // e.g., "defaults", "user", "work"
	Content   string    `json:"content"`    // Raw TOML content
	IsDefault bool      `json:"is_default"` // True for the built-in defaults (read-only)
	Enabled   bool      `json:"enabled"`    // Whether this config is active
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
