package mcp

import (
	"encoding/json"
	"fmt"
	"sort"

	"github.com/pelletier/go-toml/v2"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/models"
)

// TOMLConfig represents the TOML structure for MCP configuration
type TOMLConfig struct {
	Servers map[string]TOMLServer `toml:"servers"`
}

// TOMLServer represents a single server in TOML format
type TOMLServer struct {
	Command     string            `toml:"command"`
	Args        []string          `toml:"args,omitempty"`
	Env         map[string]string `toml:"env,omitempty"`
	Description string            `toml:"description,omitempty"`
}

// ParseTOML parses TOML input and returns MCP server models
func ParseTOML(tomlContent string) ([]models.MCPServer, error) {
	var config TOMLConfig
	if err := toml.Unmarshal([]byte(tomlContent), &config); err != nil {
		return nil, fmt.Errorf("failed to parse TOML: %w", err)
	}

	var servers []models.MCPServer
	for name, server := range config.Servers {
		if server.Command == "" {
			return nil, fmt.Errorf("server %q missing required 'command' field", name)
		}

		// Validate command against allowlist
		if !isAllowedCommand(server.Command) {
			return nil, fmt.Errorf("server %q has disallowed command %q (allowed: npx, uvx, docker, node, python)", name, server.Command)
		}

		// Convert args to JSON
		argsJSON := "[]"
		if len(server.Args) > 0 {
			argsBytes, err := json.Marshal(server.Args)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal args for %q: %w", name, err)
			}
			argsJSON = string(argsBytes)
		}

		// Convert env to JSON
		envJSON := "{}"
		if len(server.Env) > 0 {
			envBytes, err := json.Marshal(server.Env)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal env for %q: %w", name, err)
			}
			envJSON = string(envBytes)
		}

		servers = append(servers, models.MCPServer{
			Name:        name,
			Command:     server.Command,
			Args:        argsJSON,
			Env:         envJSON,
			Description: server.Description,
			Enabled:     true,
		})
	}

	// Sort by name for consistent ordering
	sort.Slice(servers, func(i, j int) bool {
		return servers[i].Name < servers[j].Name
	})

	return servers, nil
}

// ExportTOML exports MCP servers to TOML format
func ExportTOML(servers []models.MCPServer) (string, error) {
	config := TOMLConfig{
		Servers: make(map[string]TOMLServer),
	}

	for _, server := range servers {
		var args []string
		if server.Args != "" && server.Args != "[]" {
			if err := json.Unmarshal([]byte(server.Args), &args); err != nil {
				return "", fmt.Errorf("failed to unmarshal args for %q: %w", server.Name, err)
			}
		}

		var env map[string]string
		if server.Env != "" && server.Env != "{}" {
			if err := json.Unmarshal([]byte(server.Env), &env); err != nil {
				return "", fmt.Errorf("failed to unmarshal env for %q: %w", server.Name, err)
			}
		}

		config.Servers[server.Name] = TOMLServer{
			Command:     server.Command,
			Args:        args,
			Env:         env,
			Description: server.Description,
		}
	}

	tomlBytes, err := toml.Marshal(config)
	if err != nil {
		return "", fmt.Errorf("failed to marshal TOML: %w", err)
	}

	return string(tomlBytes), nil
}

// isAllowedCommand checks if a command is in the allowlist
func isAllowedCommand(cmd string) bool {
	allowed := []string{"npx", "uvx", "docker", "node", "python", "python3", "pip", "pipx"}
	for _, a := range allowed {
		if cmd == a {
			return true
		}
	}
	return false
}

// JSONConfig represents the Claude MCP JSON configuration format
type JSONConfig struct {
	MCPServers map[string]JSONServer `json:"mcpServers"`
}

// JSONServer represents a single server in JSON format
type JSONServer struct {
	Command string            `json:"command"`
	Args    []string          `json:"args,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
}

// ParseJSON parses Claude MCP JSON input and returns MCP server models
func ParseJSON(jsonContent string) ([]models.MCPServer, error) {
	var config JSONConfig
	if err := json.Unmarshal([]byte(jsonContent), &config); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	if config.MCPServers == nil || len(config.MCPServers) == 0 {
		return nil, fmt.Errorf("no mcpServers found in JSON")
	}

	var servers []models.MCPServer
	for name, server := range config.MCPServers {
		if server.Command == "" {
			return nil, fmt.Errorf("server %q missing required 'command' field", name)
		}

		// Convert args to JSON
		argsJSON := "[]"
		if len(server.Args) > 0 {
			argsBytes, err := json.Marshal(server.Args)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal args for %q: %w", name, err)
			}
			argsJSON = string(argsBytes)
		}

		// Convert env to JSON
		envJSON := "{}"
		if len(server.Env) > 0 {
			envBytes, err := json.Marshal(server.Env)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal env for %q: %w", name, err)
			}
			envJSON = string(envBytes)
		}

		servers = append(servers, models.MCPServer{
			Name:        name,
			Command:     server.Command,
			Args:        argsJSON,
			Env:         envJSON,
			Description: "", // JSON format doesn't have description
			Enabled:     true,
		})
	}

	// Sort by name for consistent ordering
	sort.Slice(servers, func(i, j int) bool {
		return servers[i].Name < servers[j].Name
	})

	return servers, nil
}

// ConvertJSONToTOML converts Claude MCP JSON to TOML format
func ConvertJSONToTOML(jsonContent string) (string, error) {
	servers, err := ParseJSON(jsonContent)
	if err != nil {
		return "", err
	}
	return ExportTOML(servers)
}
