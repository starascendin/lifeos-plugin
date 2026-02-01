package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/convex"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/github"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/k8s"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/mcp"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/models"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/version"
)

// getEnvValues reads allowed env vars from the controlplane environment
// so they can be substituted into MCP config args (e.g., ${LIFEOS_API_KEY})
func getEnvValues() map[string]string {
	values := make(map[string]string)
	for _, name := range mcp.GetAllowedEnvVars() {
		if val := os.Getenv(name); val != "" {
			values[name] = val
		}
	}
	return values
}

type API struct {
	convex       *convex.Client
	k8sClient    *k8s.Client
	githubClient *github.Client
}

// NewAPIWithConvex creates a new API handler with Convex client for configs
func NewAPIWithConvex(convexClient *convex.Client, k8sClient *k8s.Client, githubClient *github.Client) *API {
	return &API{
		convex:       convexClient,
		k8sClient:    k8sClient,
		githubClient: githubClient,
	}
}

// GetSystemInfo returns system information including Convex URL and version
func (a *API) GetSystemInfo(c echo.Context) error {
	info := map[string]interface{}{
		"storage_type": "convex",
		"convex_url":   a.convex.GetBaseURL(),
		"version":      version.Version,
		"build_time":   version.BuildTime,
	}

	if a.k8sClient != nil {
		info["k8s_enabled"] = true
	} else {
		info["k8s_enabled"] = false
	}

	if a.githubClient != nil && a.githubClient.IsConfigured() {
		info["github_enabled"] = true
	} else {
		info["github_enabled"] = false
	}

	return c.JSON(http.StatusOK, info)
}

// --- Config Endpoints ---

// ListConfigs returns all configs as JSON
func (a *API) ListConfigs(c echo.Context) error {
	configs, err := a.convex.ListAgentConfigs()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to list configs: %v", err),
		})
	}
	// Convert to models.AgentConfig for compatibility
	result := make([]models.AgentConfig, len(configs))
	for i, cfg := range configs {
		result[i] = convexToModelConfig(&cfg)
	}
	return c.JSON(http.StatusOK, result)
}

// convexToModelConfig converts a Convex AgentConfig to models.AgentConfig
func convexToModelConfig(cfg *convex.AgentConfig) models.AgentConfig {
	return models.AgentConfig{
		ID:            0, // Convex uses string IDs, we'll use a placeholder
		ConvexID:      cfg.ID,
		Name:          cfg.Name,
		Repos:         cfg.Repos,
		TaskPrompt:    cfg.TaskPrompt,
		SystemPrompt:  cfg.SystemPrompt,
		MaxTurns:      cfg.MaxTurns,
		MaxBudgetUSD:  cfg.MaxBudgetUSD,
		CPULimit:      cfg.CPULimit,
		MemoryLimit:   cfg.MemoryLimit,
		AllowedTools:  cfg.AllowedTools,
		EnabledMCPs:   cfg.EnabledMCPs,
		EnabledSkills: cfg.EnabledSkills,
		EnvVars:       cfg.EnvVars,
		CreatedAt:     time.UnixMilli(cfg.CreatedAt),
		UpdatedAt:     time.UnixMilli(cfg.UpdatedAt),
	}
}

// GetConfig returns a single config by ID
func (a *API) GetConfig(c echo.Context) error {
	idParam := c.Param("id")

	config, err := a.convex.GetAgentConfig(idParam)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Config not found",
		})
	}
	result := convexToModelConfig(config)
	return c.JSON(http.StatusOK, result)
}

// CreateConfigRequest is the request body for creating a config
type CreateConfigRequest struct {
	Name          string  `json:"name"`
	Repos         string  `json:"repos"`
	TaskPrompt    string  `json:"task_prompt"`
	SystemPrompt  string  `json:"system_prompt"`
	MaxTurns      int     `json:"max_turns"`
	MaxBudgetUSD  float64 `json:"max_budget_usd"`
	CPULimit      string  `json:"cpu_limit"`
	MemoryLimit   string  `json:"memory_limit"`
	AllowedTools  string  `json:"allowed_tools"`
	EnabledMCPs   string  `json:"enabled_mcps"`
	EnabledSkills string  `json:"enabled_skills"`
	EnvVars       string  `json:"env_vars"`
}

// CreateConfig creates a new config
func (a *API) CreateConfig(c echo.Context) error {
	var req CreateConfigRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Name is required",
		})
	}

	// Set defaults
	if req.MaxTurns == 0 {
		req.MaxTurns = 50
	}
	if req.MaxBudgetUSD == 0 {
		req.MaxBudgetUSD = 10.0
	}
	if req.CPULimit == "" {
		req.CPULimit = "1000m"
	}
	if req.MemoryLimit == "" {
		req.MemoryLimit = "2Gi"
	}
	if req.AllowedTools == "" {
		req.AllowedTools = "Read,Write,Edit,Bash,Glob,Grep"
	}

	convexReq := &convex.CreateAgentConfigRequest{
		Name:          req.Name,
		Repos:         req.Repos,
		TaskPrompt:    req.TaskPrompt,
		SystemPrompt:  req.SystemPrompt,
		MaxTurns:      req.MaxTurns,
		MaxBudgetUSD:  req.MaxBudgetUSD,
		CPULimit:      req.CPULimit,
		MemoryLimit:   req.MemoryLimit,
		AllowedTools:  req.AllowedTools,
		EnabledMCPs:   req.EnabledMCPs,
		EnabledSkills: req.EnabledSkills,
		EnvVars:       req.EnvVars,
	}

	convexID, err := a.convex.CreateAgentConfig(convexReq)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to create config: %v", err),
		})
	}

	config := models.AgentConfig{
		ConvexID:      convexID,
		Name:          req.Name,
		Repos:         req.Repos,
		TaskPrompt:    req.TaskPrompt,
		SystemPrompt:  req.SystemPrompt,
		MaxTurns:      req.MaxTurns,
		MaxBudgetUSD:  req.MaxBudgetUSD,
		CPULimit:      req.CPULimit,
		MemoryLimit:   req.MemoryLimit,
		AllowedTools:  req.AllowedTools,
		EnabledMCPs:   req.EnabledMCPs,
		EnabledSkills: req.EnabledSkills,
		EnvVars:       req.EnvVars,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	return c.JSON(http.StatusCreated, config)
}

// UpdateConfig updates an existing config
func (a *API) UpdateConfig(c echo.Context) error {
	idParam := c.Param("id")

	var req CreateConfigRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	convexReq := &convex.CreateAgentConfigRequest{
		Name:          req.Name,
		Repos:         req.Repos,
		TaskPrompt:    req.TaskPrompt,
		SystemPrompt:  req.SystemPrompt,
		MaxTurns:      req.MaxTurns,
		MaxBudgetUSD:  req.MaxBudgetUSD,
		CPULimit:      req.CPULimit,
		MemoryLimit:   req.MemoryLimit,
		AllowedTools:  req.AllowedTools,
		EnabledMCPs:   req.EnabledMCPs,
		EnabledSkills: req.EnabledSkills,
		EnvVars:       req.EnvVars,
	}

	if err := a.convex.UpdateAgentConfig(idParam, convexReq); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to update config: %v", err),
		})
	}

	config := models.AgentConfig{
		ConvexID:      idParam,
		Name:          req.Name,
		Repos:         req.Repos,
		TaskPrompt:    req.TaskPrompt,
		SystemPrompt:  req.SystemPrompt,
		MaxTurns:      req.MaxTurns,
		MaxBudgetUSD:  req.MaxBudgetUSD,
		CPULimit:      req.CPULimit,
		MemoryLimit:   req.MemoryLimit,
		AllowedTools:  req.AllowedTools,
		EnabledMCPs:   req.EnabledMCPs,
		EnabledSkills: req.EnabledSkills,
		EnvVars:       req.EnvVars,
		UpdatedAt:     time.Now(),
	}
	return c.JSON(http.StatusOK, config)
}

// DeleteConfig deletes a config
func (a *API) DeleteConfig(c echo.Context) error {
	idParam := c.Param("id")

	if err := a.convex.DeleteAgentConfig(idParam); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to delete config: %v", err),
		})
	}
	return c.NoContent(http.StatusNoContent)
}

// --- Agent Endpoints ---

// ListAgents returns all running agents
func (a *API) ListAgents(c echo.Context) error {
	if a.k8sClient == nil {
		return c.JSON(http.StatusOK, []models.RunningAgent{})
	}

	agents, err := a.k8sClient.ListRunningAgents()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to list agents: %v", err),
		})
	}

	return c.JSON(http.StatusOK, agents)
}

// RecreateAgentPod recreates a persistent agent pod with the latest config
// This is used for "relaunch" of persistent pods (not task jobs)
func (a *API) RecreateAgentPod(c echo.Context) error {
	if a.k8sClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Kubernetes not available",
		})
	}

	idParam := c.Param("id")

	convexConfig, err := a.convex.GetAgentConfig(idParam)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Config not found",
		})
	}
	modelConfig := convexToModelConfig(convexConfig)
	config := &modelConfig

	// Delete existing persistent pod if it exists (name pattern: agent-{config.Name}-pod)
	existingPodName := fmt.Sprintf("agent-%s-pod", config.Name)
	_ = a.k8sClient.StopAgentWithCleanup(existingPodName) // Ignore error if doesn't exist, also cleans up MCP ConfigMap

	// Wait a moment for deletion to process
	time.Sleep(500 * time.Millisecond)

	// Build MCP JSON from config.EnabledMCPs
	mcpJSON, mcpErr := a.buildMCPJSON(config.EnabledMCPs)
	if mcpErr != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to build MCP config: %v", mcpErr),
		})
	}

	// Get skill install commands
	var skillInstallCommands []string
	if config.EnabledSkills != "" {
		commands, err := a.convex.GetSkillInstallCommands(config.EnabledSkills)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": fmt.Sprintf("Failed to get skill install commands: %v", err),
			})
		}
		skillInstallCommands = commands
	}

	// Create new persistent pod with MCP and skills
	podName, err := a.k8sClient.GetOrCreateAgentPod(config, mcpJSON, skillInstallCommands)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to create pod: %v", err),
		})
	}

	return c.JSON(http.StatusCreated, map[string]string{
		"pod_name": podName,
		"status":   "Pending",
	})
}

// buildMCPJSON fetches each requested MCP server config by name and generates the MCP JSON
func (a *API) buildMCPJSON(enabledMCPs string) ([]byte, error) {
	if enabledMCPs == "" {
		return nil, nil
	}

	mcpNames := mcp.ParseEnabledMCPs(enabledMCPs)
	if len(mcpNames) == 0 {
		return nil, nil
	}

	var mcpServers []models.MCPServer
	for _, name := range mcpNames {
		cfg, err := a.convex.GetMCPConfigByName("server-" + name)
		if err != nil {
			log.Printf("[buildMCPJSON] Server config not found for %q, skipping", name)
			continue
		}
		servers, err := mcp.ParseTOML(cfg.Content)
		if err != nil {
			log.Printf("[buildMCPJSON] Failed to parse TOML for %q, skipping: %v", name, err)
			continue
		}
		mcpServers = append(mcpServers, servers...)
	}

	if len(mcpServers) == 0 {
		return nil, nil
	}

	envValues := getEnvValues()
	return mcp.GenerateMCPConfig(mcpServers, envValues)
}

// StopAgent stops a running agent
func (a *API) StopAgent(c echo.Context) error {
	if a.k8sClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Kubernetes not available",
		})
	}

	podName := c.Param("name")
	if err := a.k8sClient.StopAgentWithCleanup(podName); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to stop: %v", err),
		})
	}

	return c.NoContent(http.StatusNoContent)
}

// GetAgentLogs returns logs for an agent
func (a *API) GetAgentLogs(c echo.Context) error {
	if a.k8sClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Kubernetes not available",
		})
	}

	podName := c.Param("name")
	lines, _ := strconv.Atoi(c.QueryParam("lines"))
	if lines <= 0 {
		lines = 100
	}

	logs, err := a.k8sClient.GetLogs(podName, int64(lines))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to get logs: %v", err),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"pod_name": podName,
		"logs":     logs,
	})
}

// StreamAgentLogs streams logs via SSE
func (a *API) StreamAgentLogs(c echo.Context) error {
	if a.k8sClient == nil {
		return c.String(http.StatusServiceUnavailable, "Kubernetes not available")
	}

	podName := c.Param("name")

	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Minute)
	defer cancel()

	logChan := make(chan string, 100)

	go func() {
		_ = a.k8sClient.StreamLogs(ctx, podName, logChan)
		close(logChan)
	}()

	for {
		select {
		case line, ok := <-logChan:
			if !ok {
				return nil
			}
			fmt.Fprintf(c.Response(), "data: %s\n\n", line)
			c.Response().Flush()
		case <-ctx.Done():
			return nil
		}
	}
}

// --- Chat Endpoints ---

// ChatSend handles sending a message and streaming the response via SSE
func (a *API) ChatSend(c echo.Context) error {
	if a.k8sClient == nil {
		return c.String(http.StatusServiceUnavailable, "Kubernetes not available")
	}

	message := c.QueryParam("message")
	threadID := c.QueryParam("thread_id")
	skipPermissions := c.QueryParam("skip_permissions") == "true"
	streamJSON := c.QueryParam("stream_json") == "true"
	targetPodName := c.QueryParam("pod_name")  // Optional: specific agent pod to chat with
	agentIDStr := c.QueryParam("agent_id")     // Optional: agent config ID to use

	if message == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Message is required",
		})
	}

	// Set SSE headers
	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")

	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Minute)
	defer cancel()

	// Check if this is a continuation of existing thread
	isNewThread := threadID == ""
	if isNewThread {
		threadID = uuid.New().String()
	}

	// Convex conversation tracking
	var convexConversationID string
	existing, err := a.convex.GetConversationByThreadID(threadID)
	if err == nil && existing != nil {
		convexConversationID = existing.ID
	} else if isNewThread {
		convexID, createErr := a.convex.CreateConversation(&convex.CreateConversationRequest{
			ThreadID: threadID,
			Title:    truncateString(message, 50),
		})
		if createErr == nil {
			convexConversationID = convexID
		}
	}

	// Save user message
	if convexConversationID != "" {
		a.convex.AddMessage(convexConversationID, &convex.AddMessageRequest{
			Role:    "user",
			Content: message,
		})
	}

	var podName string
	var agentConfig *models.AgentConfig

	// Determine which pod to use
	if agentIDStr != "" {
		// Agent-based chat: get or create persistent agent pod
		convexConfig, convexErr := a.convex.GetAgentConfig(agentIDStr)
		if convexErr != nil {
			sendSSEError(c, fmt.Sprintf("Agent config not found: %v", convexErr))
			return nil
		}
		modelConfig := convexToModelConfig(convexConfig)
		agentConfig = &modelConfig

		// Build MCP JSON
		var mcpJSON []byte
		log.Printf("[ChatSend] Agent config loaded: name=%s, EnabledMCPs=%q", agentConfig.Name, agentConfig.EnabledMCPs)
		if agentConfig.EnabledMCPs != "" {
			var mcpErr error
			mcpJSON, mcpErr = a.buildMCPJSON(agentConfig.EnabledMCPs)
			if mcpErr != nil {
				sendSSEError(c, fmt.Sprintf("Failed to build MCP config: %v", mcpErr))
				return nil
			}
			if mcpJSON != nil {
				log.Printf("[ChatSend] Generated MCP JSON (%d bytes)", len(mcpJSON))
			}
		} else {
			log.Printf("[ChatSend] No EnabledMCPs configured for agent %s", agentConfig.Name)
		}

		// Get skill install commands
		var skillInstallCommands []string
		if agentConfig.EnabledSkills != "" {
			commands, convexErr := a.convex.GetSkillInstallCommands(agentConfig.EnabledSkills)
			if convexErr != nil {
				sendSSEError(c, fmt.Sprintf("Failed to get skill install commands: %v", convexErr))
				return nil
			}
			skillInstallCommands = commands
		}

		var podErr error
		podName, podErr = a.k8sClient.GetOrCreateAgentPod(agentConfig, mcpJSON, skillInstallCommands)
		if podErr != nil {
			sendSSEError(c, fmt.Sprintf("Failed to get agent pod: %v", podErr))
			return nil
		}
	} else if targetPodName != "" {
		// Specific pod requested, verify it exists and is running
		running, verifyErr := a.k8sClient.IsPodRunning(targetPodName)
		if verifyErr != nil {
			sendSSEError(c, fmt.Sprintf("Failed to verify pod: %v", verifyErr))
			return nil
		}
		if !running {
			sendSSEError(c, fmt.Sprintf("Pod %s is not running", targetPodName))
			return nil
		}
		podName = targetPodName
	} else {
		// Get or create default chat pod
		var podErr error
		podName, podErr = a.k8sClient.GetOrCreateChatPod()
		if podErr != nil {
			sendSSEError(c, fmt.Sprintf("Failed to get chat pod: %v", podErr))
			return nil
		}
	}

	// Send start event
	startData := map[string]string{
		"type":      "start",
		"thread_id": threadID,
		"pod_name":  podName,
	}
	sendSSEEvent(c, startData)

	// Build claude command
	cmd := []string{"claude", "-p", message, "--print"}

	// Add agent-specific configuration
	if agentConfig != nil {
		if agentConfig.SystemPrompt != "" {
			cmd = append(cmd, "--system-prompt", agentConfig.SystemPrompt)
		}
		if agentConfig.MaxTurns > 0 {
			cmd = append(cmd, "--max-turns", fmt.Sprintf("%d", agentConfig.MaxTurns))
		}
		if agentConfig.AllowedTools != "" {
			tools := strings.Split(agentConfig.AllowedTools, ",")
			for _, tool := range tools {
				tool = strings.TrimSpace(tool)
				if tool != "" {
					cmd = append(cmd, "--allowedTools", tool)
				}
			}
		}
	}

	// Continue existing session if not a new thread
	if !isNewThread {
		cmd = append(cmd, "--continue")
	}

	if skipPermissions {
		cmd = append(cmd, "--dangerously-skip-permissions")
	}

	if streamJSON {
		cmd = append(cmd, "--verbose", "--output-format", "stream-json")
	}

	// Create output channel
	outputChan := make(chan string, 100)

	// Start exec in goroutine
	go func() {
		execErr := a.k8sClient.ExecCommand(ctx, podName, cmd, outputChan)
		if execErr != nil {
			outputChan <- fmt.Sprintf("__ERROR__:%v", execErr)
		}
		close(outputChan)
	}()

	// Track assistant response for Convex
	var assistantResponse strings.Builder

	// Stream output
	for {
		select {
		case output, ok := <-outputChan:
			if !ok {
				// Channel closed, send done
				sendSSEEvent(c, map[string]string{"type": "done"})

				// Save assistant response to Convex
				if convexConversationID != "" && assistantResponse.Len() > 0 {
					a.convex.AddMessage(convexConversationID, &convex.AddMessageRequest{
						Role:    "assistant",
						Content: assistantResponse.String(),
					})
				}
				return nil
			}

			// Check for error marker
			if strings.HasPrefix(output, "__ERROR__:") {
				errMsg := strings.TrimPrefix(output, "__ERROR__:")
				sendSSEEvent(c, map[string]string{"type": "error", "message": errMsg})
				continue
			}

			if streamJSON {
				// Try to parse as JSON
				var jsonData map[string]interface{}
				if err := json.Unmarshal([]byte(output), &jsonData); err == nil {
					sendSSEEvent(c, map[string]interface{}{"type": "json", "data": jsonData})

					// Extract content from assistant message
					if msgType, ok := jsonData["type"].(string); ok && msgType == "assistant" {
						if msg, ok := jsonData["message"].(map[string]interface{}); ok {
							if content, ok := msg["content"].([]interface{}); ok {
								for _, item := range content {
									if itemMap, ok := item.(map[string]interface{}); ok {
										if text, ok := itemMap["text"].(string); ok {
											sendSSEEvent(c, map[string]string{"type": "content", "content": text})
											assistantResponse.WriteString(text)
										}
									}
								}
							}
						}
					}
				} else {
					// Not JSON, send as content
					sendSSEEvent(c, map[string]string{"type": "content", "content": output})
					assistantResponse.WriteString(output)
				}
			} else {
				// Plain text mode
				sendSSEEvent(c, map[string]string{"type": "content", "content": output})
				assistantResponse.WriteString(output)
			}

		case <-ctx.Done():
			sendSSEEvent(c, map[string]string{"type": "error", "message": "Request timeout"})
			return nil
		}
	}
}

// truncateString truncates a string to maxLen characters
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// sendSSEEvent sends a Server-Sent Event
func sendSSEEvent(c echo.Context, data interface{}) {
	jsonData, _ := json.Marshal(data)
	fmt.Fprintf(c.Response(), "data: %s\n\n", jsonData)
	c.Response().Flush()
}

// sendSSEError sends an error SSE event
func sendSSEError(c echo.Context, message string) {
	sendSSEEvent(c, map[string]string{"type": "error", "message": message})
}

// --- MCP Endpoints ---

// GetMCPPresets returns the embedded MCP server presets and skills, merged with
// active servers from user's saved TOML configs in Convex.
// DB servers OVERRIDE embedded presets with the same name.
func (a *API) GetMCPPresets(c echo.Context) error {
	presets, err := mcp.LoadPresets()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to load presets: %v", err),
		})
	}

	// Collect all enabled config servers into a map (DB servers override embedded presets)
	convexConfigs, err := a.convex.GetEnabledMCPConfigs()
	if err == nil {
		dbServers := make(map[string]mcp.PresetServer)

		for _, tomlConfig := range convexConfigs {
			servers, err := mcp.ParseTOML(tomlConfig.Content)
			if err != nil {
				continue // Skip malformed configs
			}
			for _, server := range servers {
				// Convert Args from JSON string to []string
				var args []string
				if server.Args != "" && server.Args != "[]" {
					json.Unmarshal([]byte(server.Args), &args)
				}

				// Convert Env from JSON string to map[string]string
				var env map[string]string
				if server.Env != "" && server.Env != "{}" {
					json.Unmarshal([]byte(server.Env), &env)
				}

				dbServers[server.Name] = mcp.PresetServer{
					Name:        server.Name,
					Command:     server.Command,
					Args:        args,
					Env:         env,
					Description: server.Description,
					Category:    "custom",
				}
			}
		}

		// Override embedded presets with DB servers, preserve category for existing ones
		for i, preset := range presets.Servers {
			if dbServer, exists := dbServers[preset.Name]; exists {
				if dbServer.Description == "" {
					dbServer.Description = preset.Description
				}
				dbServer.Category = preset.Category
				presets.Servers[i] = dbServer
				delete(dbServers, preset.Name)
			}
		}

		// Add remaining DB servers that weren't in embedded presets
		for _, server := range dbServers {
			presets.Servers = append(presets.Servers, server)
		}
	}

	return c.JSON(http.StatusOK, presets)
}

// ConvertJSONRequest is the request body for converting JSON to TOML
type ConvertJSONRequest struct {
	JSON string `json:"json"`
}

// ConvertJSONToTOML converts Claude MCP JSON format to TOML
func (a *API) ConvertJSONToTOML(c echo.Context) error {
	var req ConvertJSONRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.JSON == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "JSON content is required",
		})
	}

	tomlContent, err := mcp.ConvertJSONToTOML(req.JSON)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("Failed to convert JSON: %v", err),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"toml": tomlContent,
	})
}

// --- MCP TOML Config Endpoints ---

// ListTomlConfigs returns all saved TOML configurations
func (a *API) ListTomlConfigs(c echo.Context) error {
	convexConfigs, err := a.convex.ListMCPConfigs()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to list TOML configs",
		})
	}
	configs := make([]models.MCPTomlConfig, len(convexConfigs))
	for i, cfg := range convexConfigs {
		configs[i] = models.MCPTomlConfig{
			ConvexID:  cfg.ID,
			Name:      cfg.Name,
			Content:   cfg.Content,
			IsDefault: cfg.IsDefault,
			Enabled:   cfg.Enabled,
		}
	}
	return c.JSON(http.StatusOK, configs)
}

// GetTomlConfig returns a specific TOML config by name
func (a *API) GetTomlConfig(c echo.Context) error {
	name := c.Param("name")

	cfg, err := a.convex.GetMCPConfigByName(name)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "TOML config not found",
		})
	}
	return c.JSON(http.StatusOK, models.MCPTomlConfig{
		ConvexID:  cfg.ID,
		Name:      cfg.Name,
		Content:   cfg.Content,
		IsDefault: cfg.IsDefault,
		Enabled:   cfg.Enabled,
	})
}

// CreateTomlConfigRequest is the request body for creating a TOML config
type CreateTomlConfigRequest struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// CreateTomlConfig creates a new TOML config
func (a *API) CreateTomlConfig(c echo.Context) error {
	var req CreateTomlConfigRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Name is required",
		})
	}

	convexReq := &convex.CreateMCPConfigRequest{
		Name:    req.Name,
		Content: req.Content,
		Enabled: true,
	}
	convexID, err := a.convex.CreateMCPConfig(convexReq)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create TOML config",
		})
	}
	return c.JSON(http.StatusCreated, models.MCPTomlConfig{
		ConvexID: convexID,
		Name:     req.Name,
		Content:  req.Content,
		Enabled:  true,
	})
}

// UpdateTomlConfigRequest is the request body for updating a TOML config
type UpdateTomlConfigRequest struct {
	Content string `json:"content"`
}

// UpdateTomlConfig updates an existing TOML config
func (a *API) UpdateTomlConfig(c echo.Context) error {
	name := c.Param("name")

	var req UpdateTomlConfigRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	cfg, err := a.convex.GetMCPConfigByName(name)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "TOML config not found",
		})
	}

	convexReq := &convex.UpdateMCPConfigRequest{
		Content: req.Content,
	}
	if err := a.convex.UpdateMCPConfig(cfg.ID, convexReq); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update TOML config",
		})
	}

	updated, _ := a.convex.GetMCPConfigByName(name)
	return c.JSON(http.StatusOK, models.MCPTomlConfig{
		ConvexID:  updated.ID,
		Name:      updated.Name,
		Content:   updated.Content,
		IsDefault: updated.IsDefault,
		Enabled:   updated.Enabled,
	})
}

// DeleteTomlConfig deletes a TOML config
func (a *API) DeleteTomlConfig(c echo.Context) error {
	name := c.Param("name")

	cfg, err := a.convex.GetMCPConfigByName(name)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "TOML config not found",
		})
	}
	if err := a.convex.DeleteMCPConfig(cfg.ID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete TOML config",
		})
	}
	return c.NoContent(http.StatusNoContent)
}

// ToggleTomlConfigRequest is the request body for toggling a TOML config
type ToggleTomlConfigRequest struct {
	Enabled bool `json:"enabled"`
}

// ToggleTomlConfig enables or disables a TOML config
func (a *API) ToggleTomlConfig(c echo.Context) error {
	name := c.Param("name")

	var req ToggleTomlConfigRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	cfg, err := a.convex.GetMCPConfigByName(name)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "TOML config not found",
		})
	}
	if err := a.convex.ToggleMCPConfig(cfg.ID, req.Enabled); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to toggle TOML config",
		})
	}
	return c.JSON(http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Config %s %s", name, map[bool]string{true: "enabled", false: "disabled"}[req.Enabled]),
	})
}

// GetActiveServers returns all servers from enabled TOML configs (merged)
func (a *API) GetActiveServers(c echo.Context) error {
	convexConfigs, err := a.convex.GetEnabledMCPConfigs()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to get enabled configs",
		})
	}

	// Parse all enabled configs and merge servers
	serverMap := make(map[string]models.MCPServer)
	for _, cfg := range convexConfigs {
		servers, err := mcp.ParseTOML(cfg.Content)
		if err != nil {
			continue // Skip invalid configs
		}
		for _, server := range servers {
			serverMap[server.Name] = server
		}
	}

	// Convert map to slice
	servers := make([]models.MCPServer, 0, len(serverMap))
	for _, server := range serverMap {
		servers = append(servers, server)
	}

	return c.JSON(http.StatusOK, servers)
}

// --- Cleanup Endpoints ---

// CleanupPods deletes completed/failed pods older than specified minutes
// --- GitHub Endpoints ---

// ListGitHubRepos returns the user's GitHub repos
func (a *API) ListGitHubRepos(c echo.Context) error {
	if a.githubClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "GitHub client not initialized",
		})
	}

	if !a.githubClient.IsConfigured() {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error":     "GITHUB_PAT not configured",
			"configured": "false",
		})
	}

	repos, err := a.githubClient.ListRepos()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to fetch repos: %v", err),
		})
	}

	return c.JSON(http.StatusOK, repos)
}

// --- Skill Endpoints ---

// ListSkills returns all skills
func (a *API) ListSkills(c echo.Context) error {
	convexSkills, err := a.convex.ListSkills()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to list skills",
		})
	}
	skills := make([]models.Skill, len(convexSkills))
	for i, s := range convexSkills {
		skills[i] = models.Skill{
			ConvexID:       s.ID,
			Name:           s.Name,
			InstallCommand: s.InstallCommand,
			Description:    s.Description,
			Category:       s.Category,
			IsBuiltin:      s.IsBuiltin,
			Enabled:        s.Enabled,
		}
	}
	return c.JSON(http.StatusOK, skills)
}

// GetSkill returns a skill by name
func (a *API) GetSkill(c echo.Context) error {
	name := c.Param("name")

	skill, err := a.convex.GetSkillByName(name)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Skill not found",
		})
	}
	return c.JSON(http.StatusOK, models.Skill{
		ConvexID:       skill.ID,
		Name:           skill.Name,
		InstallCommand: skill.InstallCommand,
		Description:    skill.Description,
		Category:       skill.Category,
		IsBuiltin:      skill.IsBuiltin,
		Enabled:        skill.Enabled,
	})
}

// CreateSkillRequest is the request body for creating a skill
type CreateSkillRequest struct {
	Name           string `json:"name"`
	InstallCommand string `json:"install_command"`
	Description    string `json:"description"`
	Category       string `json:"category"`
}

// CreateSkill creates a new skill
func (a *API) CreateSkill(c echo.Context) error {
	var req CreateSkillRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Name is required",
		})
	}

	if req.InstallCommand == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Install command is required",
		})
	}

	category := req.Category
	if category == "" {
		category = "other"
	}

	convexReq := &convex.CreateSkillRequest{
		Name:           req.Name,
		InstallCommand: req.InstallCommand,
		Description:    req.Description,
		Category:       category,
		IsBuiltin:      false,
		Enabled:        true,
	}
	convexID, err := a.convex.CreateSkill(convexReq)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to create skill: %v", err),
		})
	}
	return c.JSON(http.StatusCreated, models.Skill{
		ConvexID:       convexID,
		Name:           req.Name,
		InstallCommand: req.InstallCommand,
		Description:    req.Description,
		Category:       category,
		IsBuiltin:      false,
		Enabled:        true,
	})
}

// UpdateSkillRequest is the request body for updating a skill
type UpdateSkillRequest struct {
	InstallCommand string `json:"install_command"`
	Description    string `json:"description"`
	Category       string `json:"category"`
}

// UpdateSkill updates an existing skill
func (a *API) UpdateSkill(c echo.Context) error {
	name := c.Param("name")

	var req UpdateSkillRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	existing, err := a.convex.GetSkillByName(name)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Skill not found",
		})
	}

	convexReq := &convex.UpdateSkillRequest{
		InstallCommand: req.InstallCommand,
		Description:    req.Description,
		Category:       req.Category,
	}
	if err := a.convex.UpdateSkill(existing.ID, convexReq); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to update skill: %v", err),
		})
	}

	updated, _ := a.convex.GetSkillByName(name)
	return c.JSON(http.StatusOK, models.Skill{
		ConvexID:       updated.ID,
		Name:           updated.Name,
		InstallCommand: updated.InstallCommand,
		Description:    updated.Description,
		Category:       updated.Category,
		IsBuiltin:      updated.IsBuiltin,
		Enabled:        updated.Enabled,
	})
}

// DeleteSkill deletes a skill
func (a *API) DeleteSkill(c echo.Context) error {
	name := c.Param("name")

	skill, err := a.convex.GetSkillByName(name)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Skill not found",
		})
	}

	if skill.IsBuiltin {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Cannot delete builtin skills",
		})
	}

	if err := a.convex.DeleteSkill(skill.ID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to delete skill: %v", err),
		})
	}
	return c.NoContent(http.StatusNoContent)
}

// ToggleSkillRequest is the request body for toggling a skill
type ToggleSkillRequest struct {
	Enabled bool `json:"enabled"`
}

// ToggleSkill enables or disables a skill
func (a *API) ToggleSkill(c echo.Context) error {
	name := c.Param("name")

	var req ToggleSkillRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	skill, err := a.convex.GetSkillByName(name)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Skill not found",
		})
	}

	if err := a.convex.ToggleSkill(skill.ID, req.Enabled); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to toggle skill: %v", err),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Skill %s %s", name, map[bool]string{true: "enabled", false: "disabled"}[req.Enabled]),
	})
}

// EnvVarDefault represents a configurable environment variable with its current default value
type EnvVarDefault struct {
	Name        string `json:"name"`
	Value       string `json:"value"`
	Sensitive   bool   `json:"sensitive"`
	Description string `json:"description"`
}

// maskValue returns the first 4 characters plus "***" for sensitive values
func maskValue(val string) string {
	if val == "" {
		return ""
	}
	if len(val) <= 4 {
		return "***"
	}
	return val[:4] + "***"
}

// GetEnvVarDefaults returns the list of configurable environment variables
// with their current default values (sensitive values are masked)
func (a *API) GetEnvVarDefaults(c echo.Context) error {
	defaults := []EnvVarDefault{
		// LifeOS vars
		{Name: "CONVEX_URL", Value: os.Getenv("LIFEOS_CONVEX_URL"), Sensitive: false, Description: "Convex deployment URL for LifeOS"},
		{Name: "LIFEOS_USER_ID", Value: os.Getenv("LIFEOS_USER_ID"), Sensitive: false, Description: "LifeOS user ID"},
		{Name: "LIFEOS_API_KEY", Value: os.Getenv("LIFEOS_API_KEY"), Sensitive: true, Description: "LifeOS API key"},
		// Preset allowed vars
		{Name: "GITHUB_PAT", Value: os.Getenv("GITHUB_PAT"), Sensitive: true, Description: "GitHub personal access token"},
		{Name: "ANTHROPIC_API_KEY", Value: os.Getenv("ANTHROPIC_API_KEY"), Sensitive: true, Description: "Anthropic API key"},
		{Name: "OPENAI_API_KEY", Value: os.Getenv("OPENAI_API_KEY"), Sensitive: true, Description: "OpenAI API key"},
		{Name: "GOOGLE_API_KEY", Value: os.Getenv("GOOGLE_API_KEY"), Sensitive: true, Description: "Google AI API key for Gemini models"},
		{Name: "NPM_TOKEN", Value: os.Getenv("NPM_TOKEN"), Sensitive: true, Description: "NPM authentication token"},
		{Name: "AWS_ACCESS_KEY_ID", Value: os.Getenv("AWS_ACCESS_KEY_ID"), Sensitive: false, Description: "AWS access key ID"},
		{Name: "AWS_SECRET_ACCESS_KEY", Value: os.Getenv("AWS_SECRET_ACCESS_KEY"), Sensitive: true, Description: "AWS secret access key"},
	}

	// Mask sensitive values
	for i := range defaults {
		if defaults[i].Sensitive {
			defaults[i].Value = maskValue(defaults[i].Value)
		}
	}

	return c.JSON(http.StatusOK, defaults)
}

// ClearMCPCache clears the npx cache on all running agent pods
func (a *API) ClearMCPCache(c echo.Context) error {
	if a.k8sClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Kubernetes client not initialized",
		})
	}

	// Get all running agent pods
	agents, err := a.k8sClient.ListRunningAgents()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to list agents: %v", err),
		})
	}

	cleared := 0
	errors := []string{}

	for _, agent := range agents {
		if agent.Status != "Running" {
			continue
		}

		// Execute cache clear command in the pod
		err := a.k8sClient.ExecInPod(agent.PodName, "claude-agents", []string{
			"sh", "-c", "rm -rf ~/.npm/_npx 2>/dev/null; echo 'cache cleared'",
		})
		if err != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", agent.PodName, err))
		} else {
			cleared++
		}
	}

	result := map[string]interface{}{
		"cleared": cleared,
		"total":   len(agents),
		"message": fmt.Sprintf("Cleared npx cache on %d pods", cleared),
	}

	if len(errors) > 0 {
		result["errors"] = errors
	}

	return c.JSON(http.StatusOK, result)
}
