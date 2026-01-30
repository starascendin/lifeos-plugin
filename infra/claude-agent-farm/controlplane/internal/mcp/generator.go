package mcp

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/starascendin/claude-agent-farm/controlplane/internal/models"
)

// KnownEnvVars lists environment variables that can be substituted
var KnownEnvVars = []string{
	"GITHUB_PAT",
	"ANTHROPIC_API_KEY",
	"OPENAI_API_KEY",
	"NPM_TOKEN",
	"AWS_ACCESS_KEY_ID",
	"AWS_SECRET_ACCESS_KEY",
	"LIFEOS_API_KEY",
}

// envVarPattern matches ${VAR_NAME} patterns
var envVarPattern = regexp.MustCompile(`\$\{([A-Z_][A-Z0-9_]*)\}`)

// GenerateMCPConfig generates the Claude MCP JSON configuration from servers
// envValues is a map of environment variable names to their actual values
func GenerateMCPConfig(servers []models.MCPServer, envValues map[string]string) ([]byte, error) {
	mcpConfig := models.MCPConfig{
		MCPServers: make(map[string]models.MCPServerConfig),
	}

	for _, server := range servers {
		if !server.Enabled {
			continue
		}

		// Parse args from JSON
		var args []string
		if server.Args != "" && server.Args != "[]" {
			if err := json.Unmarshal([]byte(server.Args), &args); err != nil {
				return nil, fmt.Errorf("failed to unmarshal args for %q: %w", server.Name, err)
			}
		}

		// Parse env from JSON
		var env map[string]string
		if server.Env != "" && server.Env != "{}" {
			if err := json.Unmarshal([]byte(server.Env), &env); err != nil {
				return nil, fmt.Errorf("failed to unmarshal env for %q: %w", server.Name, err)
			}
		}

		// Substitute environment variables in env values
		if len(env) > 0 {
			env = substituteEnvVars(env, envValues)
		}

		// Substitute environment variables in args as well
		if len(args) > 0 {
			args = substituteEnvVarsInArgs(args, envValues)
		}

		serverConfig := models.MCPServerConfig{
			Command: server.Command,
		}

		if len(args) > 0 {
			serverConfig.Args = args
		}

		if len(env) > 0 {
			serverConfig.Env = env
		}

		mcpConfig.MCPServers[server.Name] = serverConfig
	}

	return json.MarshalIndent(mcpConfig, "", "  ")
}

// substituteEnvVars replaces ${VAR_NAME} patterns with actual values
func substituteEnvVars(env map[string]string, values map[string]string) map[string]string {
	result := make(map[string]string)
	for key, value := range env {
		result[key] = substituteValue(value, values)
	}
	return result
}

// substituteEnvVarsInArgs replaces ${VAR_NAME} patterns in args
func substituteEnvVarsInArgs(args []string, values map[string]string) []string {
	result := make([]string, len(args))
	for i, arg := range args {
		result[i] = substituteValue(arg, values)
	}
	return result
}

// substituteValue replaces ${VAR_NAME} patterns in a single string
func substituteValue(value string, envValues map[string]string) string {
	return envVarPattern.ReplaceAllStringFunc(value, func(match string) string {
		// Extract variable name from ${VAR_NAME}
		varName := strings.TrimPrefix(strings.TrimSuffix(match, "}"), "${")

		// Only substitute known environment variables for security
		if !isKnownEnvVar(varName) {
			return match // Leave unknown vars as-is
		}

		if val, ok := envValues[varName]; ok {
			return val
		}
		return match // Leave unresolved vars as-is
	})
}

// isKnownEnvVar checks if a variable name is in the known list
func isKnownEnvVar(name string) bool {
	for _, known := range KnownEnvVars {
		if name == known {
			return true
		}
	}
	return false
}

// ParseEnabledMCPs splits a comma-separated string of MCP names
func ParseEnabledMCPs(enabledMCPs string) []string {
	if enabledMCPs == "" {
		return nil
	}

	names := strings.Split(enabledMCPs, ",")
	var result []string
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name != "" {
			result = append(result, name)
		}
	}
	return result
}
