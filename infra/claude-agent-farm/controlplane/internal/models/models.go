package models

import (
	"time"
)

// AgentConfig represents a saved agent configuration template
type AgentConfig struct {
	ID            int64     `json:"id"`
	Name          string    `json:"name"`
	Repos         string    `json:"repos"`         // Comma-separated repo URLs
	TaskPrompt    string    `json:"task_prompt"`   // Default task prompt
	SystemPrompt  string    `json:"system_prompt"`
	MaxTurns      int       `json:"max_turns"`
	MaxBudgetUSD  float64   `json:"max_budget_usd"`
	CPULimit      string    `json:"cpu_limit"`      // e.g., "1000m"
	MemoryLimit   string    `json:"memory_limit"`   // e.g., "2Gi"
	AllowedTools  string    `json:"allowed_tools"`  // Comma-separated tool names
	EnabledMCPs   string    `json:"enabled_mcps"`   // Comma-separated MCP server names
	EnabledSkills string    `json:"enabled_skills"` // Comma-separated Claude skill names
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// RunningAgent represents an agent pod (running or completed)
type RunningAgent struct {
	PodName      string    `json:"pod_name"`
	PodType      string    `json:"pod_type"`   // "chat", "agent", "job"
	Persistent   bool      `json:"persistent"` // true if persistent pod (sleep infinity)
	ConfigID     int64     `json:"config_id"`
	ConfigName   string    `json:"config_name"`
	TaskPrompt   string    `json:"task_prompt"`
	Status       string    `json:"status"` // Pending, Running, Succeeded, Failed
	StartedAt    time.Time `json:"started_at"`
	Node         string    `json:"node"`
	RuntimeClass string    `json:"runtime_class"`
}

// LaunchRequest represents a request to launch an agent
type LaunchRequest struct {
	ConfigID   int64  `json:"config_id"`
	TaskPrompt string `json:"task_prompt"` // Override the default task
}

// AgentLog represents a log entry from an agent
type AgentLog struct {
	PodName   string    `json:"pod_name"`
	Timestamp time.Time `json:"timestamp"`
	Message   string    `json:"message"`
}

// Skill represents a Claude skill that can be installed
type Skill struct {
	ID             int64     `json:"id"`
	Name           string    `json:"name"`
	InstallCommand string    `json:"install_command"`
	Description    string    `json:"description"`
	Category       string    `json:"category"`
	IsBuiltin      bool      `json:"is_builtin"`
	Enabled        bool      `json:"enabled"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
