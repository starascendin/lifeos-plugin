package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/github"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/k8s"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/mcp"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/models"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/storage"
)

type API struct {
	store        *storage.SQLiteStore
	k8sClient    *k8s.Client
	githubClient *github.Client
}

func NewAPI(store *storage.SQLiteStore, k8sClient *k8s.Client, githubClient *github.Client) *API {
	return &API{
		store:        store,
		k8sClient:    k8sClient,
		githubClient: githubClient,
	}
}

// --- Config Endpoints ---

// ListConfigs returns all configs as JSON
func (a *API) ListConfigs(c echo.Context) error {
	configs, err := a.store.ListConfigs()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to list configs",
		})
	}
	return c.JSON(http.StatusOK, configs)
}

// GetConfig returns a single config by ID
func (a *API) GetConfig(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid ID",
		})
	}

	config, err := a.store.GetConfig(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Config not found",
		})
	}

	return c.JSON(http.StatusOK, config)
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

	config := &models.AgentConfig{
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
	}

	// Set defaults
	if config.MaxTurns == 0 {
		config.MaxTurns = 50
	}
	if config.MaxBudgetUSD == 0 {
		config.MaxBudgetUSD = 10.0
	}
	if config.CPULimit == "" {
		config.CPULimit = "1000m"
	}
	if config.MemoryLimit == "" {
		config.MemoryLimit = "2Gi"
	}
	if config.AllowedTools == "" {
		config.AllowedTools = "Read,Write,Edit,Bash,Glob,Grep"
	}

	id, err := a.store.CreateConfig(config)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create config",
		})
	}

	config.ID = id
	return c.JSON(http.StatusCreated, config)
}

// UpdateConfig updates an existing config
func (a *API) UpdateConfig(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid ID",
		})
	}

	var req CreateConfigRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	config := &models.AgentConfig{
		ID:            id,
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
	}

	if err := a.store.UpdateConfig(config); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update config",
		})
	}

	return c.JSON(http.StatusOK, config)
}

// DeleteConfig deletes a config
func (a *API) DeleteConfig(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid ID",
		})
	}

	if err := a.store.DeleteConfig(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete config",
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

// LaunchAgentRequest is the request body for launching an agent
type LaunchAgentRequest struct {
	TaskPrompt string `json:"task_prompt"`
}

// LaunchAgent launches a new agent pod
func (a *API) LaunchAgent(c echo.Context) error {
	if a.k8sClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Kubernetes not available",
		})
	}

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid ID",
		})
	}

	config, err := a.store.GetConfig(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Config not found",
		})
	}

	var req LaunchAgentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	taskPrompt := req.TaskPrompt
	if taskPrompt == "" {
		taskPrompt = config.TaskPrompt
	}

	// Generate MCP configuration from enabled TOML configs
	var mcpJSON []byte
	if config.EnabledMCPs != "" {
		mcpNames := mcp.ParseEnabledMCPs(config.EnabledMCPs)
		if len(mcpNames) > 0 {
			// Get servers from enabled TOML configs (not the old mcp_servers table)
			enabledConfigs, err := a.store.GetEnabledTomlConfigs()
			if err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{
					"error": fmt.Sprintf("Failed to get enabled TOML configs: %v", err),
				})
			}

			// Parse all enabled configs and build server map
			serverMap := make(map[string]models.MCPServer)
			for _, tomlConfig := range enabledConfigs {
				servers, err := mcp.ParseTOML(tomlConfig.Content)
				if err != nil {
					continue // Skip invalid configs
				}
				for _, server := range servers {
					serverMap[server.Name] = server
				}
			}

			// Filter to only requested MCP servers
			var mcpServers []models.MCPServer
			for _, name := range mcpNames {
				if server, ok := serverMap[name]; ok {
					mcpServers = append(mcpServers, server)
				}
			}

			if len(mcpServers) > 0 {
				// Build env values from k8s secrets (these would typically come from the cluster)
				// For now, we'll leave placeholders that the pod can resolve at runtime
				envValues := map[string]string{}

				mcpJSON, err = mcp.GenerateMCPConfig(mcpServers, envValues)
				if err != nil {
					return c.JSON(http.StatusInternalServerError, map[string]string{
						"error": fmt.Sprintf("Failed to generate MCP config: %v", err),
					})
				}
			}
		}
	}

	podName, err := a.k8sClient.LaunchAgentWithMCP(config, taskPrompt, mcpJSON)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to launch: %v", err),
		})
	}

	return c.JSON(http.StatusCreated, map[string]string{
		"pod_name": podName,
		"status":   "Pending",
	})
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

	var podName string
	var err error
	var agentConfig *models.AgentConfig

	// Determine which pod to use
	if agentIDStr != "" {
		// Agent-based chat: get or create persistent agent pod
		agentID, parseErr := strconv.ParseInt(agentIDStr, 10, 64)
		if parseErr != nil {
			sendSSEError(c, "Invalid agent_id")
			return nil
		}
		agentConfig, err = a.store.GetConfig(agentID)
		if err != nil {
			sendSSEError(c, fmt.Sprintf("Agent config not found: %v", err))
			return nil
		}
		podName, err = a.k8sClient.GetOrCreateAgentPod(agentConfig)
		if err != nil {
			sendSSEError(c, fmt.Sprintf("Failed to get agent pod: %v", err))
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
		podName, err = a.k8sClient.GetOrCreateChatPod()
		if err != nil {
			sendSSEError(c, fmt.Sprintf("Failed to get chat pod: %v", err))
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
		// Add system prompt if configured
		if agentConfig.SystemPrompt != "" {
			cmd = append(cmd, "--system-prompt", agentConfig.SystemPrompt)
		}
		// Add max turns if configured
		if agentConfig.MaxTurns > 0 {
			cmd = append(cmd, "--max-turns", fmt.Sprintf("%d", agentConfig.MaxTurns))
		}
		// Add allowed tools if configured
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
		err := a.k8sClient.ExecCommand(ctx, podName, cmd, outputChan)
		if err != nil {
			outputChan <- fmt.Sprintf("__ERROR__:%v", err)
		}
		close(outputChan)
	}()

	// Stream output
	for {
		select {
		case output, ok := <-outputChan:
			if !ok {
				// Channel closed, send done
				sendSSEEvent(c, map[string]string{"type": "done"})
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
										}
									}
								}
							}
						}
					}
				} else {
					// Not JSON, send as content
					sendSSEEvent(c, map[string]string{"type": "content", "content": output})
				}
			} else {
				// Plain text mode
				sendSSEEvent(c, map[string]string{"type": "content", "content": output})
			}

		case <-ctx.Done():
			sendSSEEvent(c, map[string]string{"type": "error", "message": "Request timeout"})
			return nil
		}
	}
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

// ListMCPServers returns all MCP server configurations
func (a *API) ListMCPServers(c echo.Context) error {
	servers, err := a.store.ListMCPServers()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to list MCP servers",
		})
	}
	if servers == nil {
		servers = []models.MCPServer{}
	}
	return c.JSON(http.StatusOK, servers)
}

// ImportTOMLRequest is the request body for importing TOML
type ImportTOMLRequest struct {
	TOML string `json:"toml"`
}

// ImportTOML imports MCP servers from TOML format
func (a *API) ImportTOML(c echo.Context) error {
	var req ImportTOMLRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.TOML == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "TOML content is required",
		})
	}

	servers, err := mcp.ParseTOML(req.TOML)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("Failed to parse TOML: %v", err),
		})
	}

	if err := a.store.BulkUpsertMCPServers(servers); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to save MCP servers",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("Imported %d MCP servers", len(servers)),
		"servers": servers,
	})
}

// ExportTOML exports all MCP servers as TOML
func (a *API) ExportTOML(c echo.Context) error {
	servers, err := a.store.ListMCPServers()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to list MCP servers",
		})
	}

	tomlContent, err := mcp.ExportTOML(servers)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to export TOML",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"toml": tomlContent,
	})
}

// DeleteMCPServer deletes an MCP server by name
func (a *API) DeleteMCPServer(c echo.Context) error {
	name := c.Param("name")
	if name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Server name is required",
		})
	}

	if err := a.store.DeleteMCPServer(name); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete MCP server",
		})
	}

	return c.NoContent(http.StatusNoContent)
}

// GetMCPPresets returns the embedded MCP server presets and skills
func (a *API) GetMCPPresets(c echo.Context) error {
	presets, err := mcp.LoadPresets()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to load presets: %v", err),
		})
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
	configs, err := a.store.ListTomlConfigs()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to list TOML configs",
		})
	}
	if configs == nil {
		configs = []models.MCPTomlConfig{}
	}
	return c.JSON(http.StatusOK, configs)
}

// GetTomlConfig returns a specific TOML config by name
func (a *API) GetTomlConfig(c echo.Context) error {
	name := c.Param("name")
	config, err := a.store.GetTomlConfig(name)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "TOML config not found",
		})
	}
	return c.JSON(http.StatusOK, config)
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

	config := &models.MCPTomlConfig{
		Name:    req.Name,
		Content: req.Content,
	}

	id, err := a.store.CreateTomlConfig(config)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create TOML config",
		})
	}

	config.ID = id
	return c.JSON(http.StatusCreated, config)
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

	if err := a.store.UpdateTomlConfig(name, req.Content); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update TOML config",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "TOML config updated",
	})
}

// DeleteTomlConfig deletes a TOML config
func (a *API) DeleteTomlConfig(c echo.Context) error {
	name := c.Param("name")

	if err := a.store.DeleteTomlConfig(name); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete TOML config",
		})
	}

	return c.NoContent(http.StatusNoContent)
}

// ImportJSONRequest is the request body for importing JSON
type ImportJSONRequest struct {
	JSON string `json:"json"`
}

// ImportJSON imports MCP servers from JSON format (upserts - updates existing, adds new)
func (a *API) ImportJSON(c echo.Context) error {
	var req ImportJSONRequest
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

	servers, err := mcp.ParseJSON(req.JSON)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("Failed to parse JSON: %v", err),
		})
	}

	if err := a.store.BulkUpsertMCPServers(servers); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to save MCP servers",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("Imported %d MCP servers", len(servers)),
		"servers": servers,
	})
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

	if err := a.store.ToggleTomlConfig(name, req.Enabled); err != nil {
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
	configs, err := a.store.GetEnabledTomlConfigs()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to get enabled configs",
		})
	}

	// Parse all enabled configs and merge servers
	serverMap := make(map[string]models.MCPServer)
	for _, config := range configs {
		servers, err := mcp.ParseTOML(config.Content)
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
func (a *API) CleanupPods(c echo.Context) error {
	if a.k8sClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Kubernetes not available",
		})
	}

	minutesStr := c.QueryParam("minutes")
	minutes := 30 // Default: 30 minutes
	if minutesStr != "" {
		if parsed, err := strconv.Atoi(minutesStr); err == nil && parsed > 0 {
			minutes = parsed
		}
	}

	cleaned, err := a.k8sClient.CleanupCompletedPods(time.Duration(minutes) * time.Minute)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to cleanup pods: %v", err),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"cleaned": cleaned,
		"message": fmt.Sprintf("Cleaned up %d completed pods older than %d minutes", cleaned, minutes),
	})
}

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
