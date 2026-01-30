package mcp

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sort"
	"sync"

	"github.com/pelletier/go-toml/v2"
)

//go:embed presets.toml
var presetsToml string

// PresetServer represents a preset MCP server configuration
type PresetServer struct {
	Name        string            `json:"name"`
	Command     string            `json:"command"`
	Args        []string          `json:"args"`
	Env         map[string]string `json:"env,omitempty"`
	Description string            `json:"description"`
	Category    string            `json:"category"`
}

// PresetSkill represents a Claude skill that can be installed
type PresetSkill struct {
	Name           string `json:"name"`
	InstallCommand string `json:"install_command"`
	Description    string `json:"description"`
	Category       string `json:"category"`
}

// PresetAgentConfig represents a preset agent configuration
type PresetAgentConfig struct {
	Name          string `json:"name"`
	SystemPrompt  string `json:"system_prompt"`
	TaskPrompt    string `json:"task_prompt"`
	EnabledMCPs   string `json:"enabled_mcps"`
	EnabledSkills string `json:"enabled_skills"`
	MaxTurns      int    `json:"max_turns"`
	Description   string `json:"description"`
	Category      string `json:"category"`
}

// PresetsConfig represents the full presets structure
type PresetsConfig struct {
	Servers      []PresetServer      `json:"servers"`
	Skills       []PresetSkill       `json:"skills"`
	AgentConfigs []PresetAgentConfig `json:"agent_configs"`
	AllowedEnvVars []string          `json:"allowed_env_vars,omitempty"`
}

// TOMLEnvVars represents the env_vars section in presets TOML
type TOMLEnvVars struct {
	Allowed []string `toml:"allowed"`
}

// TOMLPresetsConfig represents the TOML structure for presets
type TOMLPresetsConfig struct {
	EnvVars TOMLEnvVars                      `toml:"env_vars"`
	Servers map[string]TOMLPresetServer      `toml:"servers"`
	Skills  map[string]TOMLPresetSkill       `toml:"skills"`
	Agents  map[string]TOMLPresetAgentConfig `toml:"agents"`
}

// TOMLPresetServer represents a server in the presets TOML
type TOMLPresetServer struct {
	Command     string            `toml:"command"`
	Args        []string          `toml:"args,omitempty"`
	Env         map[string]string `toml:"env,omitempty"`
	Description string            `toml:"description,omitempty"`
	Category    string            `toml:"category,omitempty"`
}

// TOMLPresetSkill represents a skill in the presets TOML
type TOMLPresetSkill struct {
	InstallCommand string `toml:"install_command"`
	Description    string `toml:"description,omitempty"`
	Category       string `toml:"category,omitempty"`
}

// TOMLPresetAgentConfig represents an agent config in the presets TOML
type TOMLPresetAgentConfig struct {
	SystemPrompt  string `toml:"system_prompt,omitempty"`
	TaskPrompt    string `toml:"task_prompt,omitempty"`
	EnabledMCPs   string `toml:"enabled_mcps,omitempty"`
	EnabledSkills string `toml:"enabled_skills,omitempty"`
	MaxTurns      int    `toml:"max_turns,omitempty"`
	Description   string `toml:"description,omitempty"`
	Category      string `toml:"category,omitempty"`
}

// LoadPresets parses the embedded presets.toml and returns the configuration
func LoadPresets() (*PresetsConfig, error) {
	var config TOMLPresetsConfig
	if err := toml.Unmarshal([]byte(presetsToml), &config); err != nil {
		return nil, fmt.Errorf("failed to parse presets TOML: %w", err)
	}

	result := &PresetsConfig{
		Servers:        make([]PresetServer, 0, len(config.Servers)),
		Skills:         make([]PresetSkill, 0, len(config.Skills)),
		AgentConfigs:   make([]PresetAgentConfig, 0, len(config.Agents)),
		AllowedEnvVars: config.EnvVars.Allowed,
	}

	// Convert servers
	for name, server := range config.Servers {
		if server.Command == "" {
			return nil, fmt.Errorf("preset server %q missing required 'command' field", name)
		}

		category := server.Category
		if category == "" {
			category = "other"
		}

		result.Servers = append(result.Servers, PresetServer{
			Name:        name,
			Command:     server.Command,
			Args:        server.Args,
			Env:         server.Env,
			Description: server.Description,
			Category:    category,
		})
	}

	// Sort servers by category, then by name
	sort.Slice(result.Servers, func(i, j int) bool {
		if result.Servers[i].Category != result.Servers[j].Category {
			return result.Servers[i].Category < result.Servers[j].Category
		}
		return result.Servers[i].Name < result.Servers[j].Name
	})

	// Convert skills
	for name, skill := range config.Skills {
		if skill.InstallCommand == "" {
			return nil, fmt.Errorf("preset skill %q missing required 'install_command' field", name)
		}

		category := skill.Category
		if category == "" {
			category = "other"
		}

		result.Skills = append(result.Skills, PresetSkill{
			Name:           name,
			InstallCommand: skill.InstallCommand,
			Description:    skill.Description,
			Category:       category,
		})
	}

	// Sort skills by category, then by name
	sort.Slice(result.Skills, func(i, j int) bool {
		if result.Skills[i].Category != result.Skills[j].Category {
			return result.Skills[i].Category < result.Skills[j].Category
		}
		return result.Skills[i].Name < result.Skills[j].Name
	})

	// Convert agent configs
	for name, agent := range config.Agents {
		category := agent.Category
		if category == "" {
			category = "other"
		}
		maxTurns := agent.MaxTurns
		if maxTurns == 0 {
			maxTurns = 50
		}

		result.AgentConfigs = append(result.AgentConfigs, PresetAgentConfig{
			Name:          name,
			SystemPrompt:  agent.SystemPrompt,
			TaskPrompt:    agent.TaskPrompt,
			EnabledMCPs:   agent.EnabledMCPs,
			EnabledSkills: agent.EnabledSkills,
			MaxTurns:      maxTurns,
			Description:   agent.Description,
			Category:      category,
		})
	}

	// Sort agent configs by category, then by name
	sort.Slice(result.AgentConfigs, func(i, j int) bool {
		if result.AgentConfigs[i].Category != result.AgentConfigs[j].Category {
			return result.AgentConfigs[i].Category < result.AgentConfigs[j].Category
		}
		return result.AgentConfigs[i].Name < result.AgentConfigs[j].Name
	})

	return result, nil
}

// PresetServerToJSON converts a PresetServer to JSON strings for storage
func PresetServerToJSON(server PresetServer) (argsJSON string, envJSON string, err error) {
	argsJSON = "[]"
	if len(server.Args) > 0 {
		argsBytes, err := json.Marshal(server.Args)
		if err != nil {
			return "", "", fmt.Errorf("failed to marshal args: %w", err)
		}
		argsJSON = string(argsBytes)
	}

	envJSON = "{}"
	if len(server.Env) > 0 {
		envBytes, err := json.Marshal(server.Env)
		if err != nil {
			return "", "", fmt.Errorf("failed to marshal env: %w", err)
		}
		envJSON = string(envBytes)
	}

	return argsJSON, envJSON, nil
}

// GetSkillInstallCommands returns the install commands for the given skill names
// The skills parameter is a comma-separated list of skill names
func GetSkillInstallCommands(skills string) ([]string, error) {
	if skills == "" {
		return nil, nil
	}

	presets, err := LoadPresets()
	if err != nil {
		return nil, err
	}

	// Build a map for quick lookup
	skillMap := make(map[string]string)
	for _, skill := range presets.Skills {
		skillMap[skill.Name] = skill.InstallCommand
	}

	// Parse skill names and get commands
	var commands []string
	for _, name := range ParseCommaSeparated(skills) {
		if cmd, ok := skillMap[name]; ok {
			commands = append(commands, cmd)
		}
	}

	return commands, nil
}

// ParseCommaSeparated splits a comma-separated string into trimmed parts
func ParseCommaSeparated(s string) []string {
	if s == "" {
		return nil
	}
	var result []string
	for _, part := range splitByComma(s) {
		trimmed := trimString(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// Helper to split by comma without importing strings package
func splitByComma(s string) []string {
	var parts []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	parts = append(parts, s[start:])
	return parts
}

// Helper to trim whitespace
func trimString(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}

// Cached allowed env vars (presets don't change at runtime)
var (
	allowedEnvVarsOnce sync.Once
	allowedEnvVars     []string
)

// GetAllowedEnvVars returns the list of allowed environment variables from presets.toml.
// The result is cached since presets are embedded and don't change at runtime.
func GetAllowedEnvVars() []string {
	allowedEnvVarsOnce.Do(func() {
		presets, err := LoadPresets()
		if err != nil || len(presets.AllowedEnvVars) == 0 {
			// Fallback to empty list if presets can't be loaded
			allowedEnvVars = []string{}
			return
		}
		allowedEnvVars = presets.AllowedEnvVars
	})
	return allowedEnvVars
}
