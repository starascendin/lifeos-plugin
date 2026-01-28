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
	"github.com/starascendin/claude-agent-farm/controlplane/internal/convex"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/github"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/k8s"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/mcp"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/models"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/storage"
)

type API struct {
	store        *storage.SQLiteStore // Legacy SQLite storage (deprecated)
	convex       *convex.Client       // Convex client for configs
	k8sClient    *k8s.Client
	githubClient *github.Client
}

// NewAPI creates a new API handler with SQLite storage (legacy)
func NewAPI(store *storage.SQLiteStore, k8sClient *k8s.Client, githubClient *github.Client) *API {
	return &API{
		store:        store,
		k8sClient:    k8sClient,
		githubClient: githubClient,
	}
}

// NewAPIWithConvex creates a new API handler with Convex client for configs
func NewAPIWithConvex(convexClient *convex.Client, k8sClient *k8s.Client, githubClient *github.Client) *API {
	return &API{
		convex:       convexClient,
		k8sClient:    k8sClient,
		githubClient: githubClient,
	}
}

// SetConvexClient sets the Convex client (for gradual migration)
func (a *API) SetConvexClient(convexClient *convex.Client) {
	a.convex = convexClient
}

// useConvex returns true if we should use Convex instead of SQLite
func (a *API) useConvex() bool {
	return a.convex != nil
}

// GetSystemInfo returns system information including Convex URL
func (a *API) GetSystemInfo(c echo.Context) error {
	info := map[string]interface{}{
		"storage_type": "sqlite",
		"convex_url":   "",
	}

	if a.useConvex() {
		info["storage_type"] = "convex"
		info["convex_url"] = a.convex.GetBaseURL()
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
	if a.useConvex() {
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

	// Legacy SQLite path
	configs, err := a.store.ListConfigs()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to list configs",
		})
	}
	return c.JSON(http.StatusOK, configs)
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
		CreatedAt:     time.UnixMilli(cfg.CreatedAt),
		UpdatedAt:     time.UnixMilli(cfg.UpdatedAt),
	}
}

// GetConfig returns a single config by ID
func (a *API) GetConfig(c echo.Context) error {
	idParam := c.Param("id")

	if a.useConvex() {
		// Convex uses string IDs
		config, err := a.convex.GetAgentConfig(idParam)
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "Config not found",
			})
		}
		result := convexToModelConfig(config)
		return c.JSON(http.StatusOK, result)
	}

	// Legacy SQLite path - parse as int64
	id, err := strconv.ParseInt(idParam, 10, 64)
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

	if a.useConvex() {
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
		}

		convexID, err := a.convex.CreateAgentConfig(convexReq)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": fmt.Sprintf("Failed to create config: %v", err),
			})
		}

		// Return the created config
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
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		return c.JSON(http.StatusCreated, config)
	}

	// Legacy SQLite path
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
	idParam := c.Param("id")

	var req CreateConfigRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if a.useConvex() {
		// Convex uses string IDs
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
			UpdatedAt:     time.Now(),
		}
		return c.JSON(http.StatusOK, config)
	}

	// Legacy SQLite path - parse as int64
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid ID",
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
	idParam := c.Param("id")

	if a.useConvex() {
		if err := a.convex.DeleteAgentConfig(idParam); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": fmt.Sprintf("Failed to delete config: %v", err),
			})
		}
		return c.NoContent(http.StatusNoContent)
	}

	// Legacy SQLite path - parse as int64
	id, err := strconv.ParseInt(idParam, 10, 64)
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

	idParam := c.Param("id")
	var config *models.AgentConfig

	if a.useConvex() {
		// Convex uses string IDs
		convexConfig, err := a.convex.GetAgentConfig(idParam)
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "Config not found",
			})
		}
		modelConfig := convexToModelConfig(convexConfig)
		config = &modelConfig
	} else {
		// Legacy SQLite path - parse as int64
		id, err := strconv.ParseInt(idParam, 10, 64)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "Invalid ID",
			})
		}
		config, err = a.store.GetConfig(id)
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "Config not found",
			})
		}
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
	// Task prompt is optional - main interaction is via Chat tab or claude -p

	// Generate MCP configuration from enabled TOML configs
	var mcpJSON []byte
	if config.EnabledMCPs != "" {
		mcpNames := mcp.ParseEnabledMCPs(config.EnabledMCPs)
		if len(mcpNames) > 0 {
			// Get servers from enabled TOML configs
			var enabledConfigContents []string

			if a.useConvex() {
				convexConfigs, err := a.convex.GetEnabledMCPConfigs()
				if err != nil {
					return c.JSON(http.StatusInternalServerError, map[string]string{
						"error": fmt.Sprintf("Failed to get enabled TOML configs: %v", err),
					})
				}
				for _, cfg := range convexConfigs {
					enabledConfigContents = append(enabledConfigContents, cfg.Content)
				}
			} else {
				// Legacy SQLite path
				enabledConfigs, err := a.store.GetEnabledTomlConfigs()
				if err != nil {
					return c.JSON(http.StatusInternalServerError, map[string]string{
						"error": fmt.Sprintf("Failed to get enabled TOML configs: %v", err),
					})
				}
				for _, cfg := range enabledConfigs {
					enabledConfigContents = append(enabledConfigContents, cfg.Content)
				}
			}

			// Parse all enabled configs and build server map
			serverMap := make(map[string]models.MCPServer)
			for _, tomlContent := range enabledConfigContents {
				servers, err := mcp.ParseTOML(tomlContent)
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

				var mcpErr error
				mcpJSON, mcpErr = mcp.GenerateMCPConfig(mcpServers, envValues)
				if mcpErr != nil {
					return c.JSON(http.StatusInternalServerError, map[string]string{
						"error": fmt.Sprintf("Failed to generate MCP config: %v", mcpErr),
					})
				}
			}
		}
	}

	// Get skill install commands from database
	var skillInstallCommands []string
	if config.EnabledSkills != "" {
		if a.useConvex() {
			commands, err := a.convex.GetSkillInstallCommands(config.EnabledSkills)
			if err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{
					"error": fmt.Sprintf("Failed to get skill install commands: %v", err),
				})
			}
			skillInstallCommands = commands
		} else {
			// Legacy SQLite path
			commands, err := a.store.GetSkillInstallCommands(config.EnabledSkills)
			if err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{
					"error": fmt.Sprintf("Failed to get skill install commands: %v", err),
				})
			}
			skillInstallCommands = commands
		}
	}

	podName, err := a.k8sClient.LaunchAgentWithMCP(config, taskPrompt, mcpJSON, skillInstallCommands)
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

// RecreateAgentPod recreates a persistent agent pod with the latest config
// This is used for "relaunch" of persistent pods (not task jobs)
func (a *API) RecreateAgentPod(c echo.Context) error {
	if a.k8sClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Kubernetes not available",
		})
	}

	idParam := c.Param("id")
	var config *models.AgentConfig

	if a.useConvex() {
		// Convex uses string IDs
		convexConfig, err := a.convex.GetAgentConfig(idParam)
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "Config not found",
			})
		}
		modelConfig := convexToModelConfig(convexConfig)
		config = &modelConfig
	} else {
		// Legacy SQLite path - parse as int64
		id, err := strconv.ParseInt(idParam, 10, 64)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "Invalid ID",
			})
		}
		config, err = a.store.GetConfig(id)
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "Config not found",
			})
		}
	}

	// Delete existing persistent pod if it exists (name pattern: agent-{config.Name}-pod)
	existingPodName := fmt.Sprintf("agent-%s-pod", config.Name)
	_ = a.k8sClient.StopAgent(existingPodName) // Ignore error if doesn't exist

	// Wait a moment for deletion to process
	time.Sleep(500 * time.Millisecond)

	// Create new persistent pod
	podName, err := a.k8sClient.GetOrCreateAgentPod(config)
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
	if a.useConvex() {
		// Try to find existing conversation by thread ID, or create new one
		existing, err := a.convex.GetConversationByThreadID(threadID)
		if err == nil && existing != nil {
			convexConversationID = existing.ID
		} else if isNewThread {
			// Create new conversation
			convexID, createErr := a.convex.CreateConversation(&convex.CreateConversationRequest{
				ThreadID: threadID,
				Title:    truncateString(message, 50), // Use first 50 chars of message as title
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
	}

	var podName string
	var err error
	var agentConfig *models.AgentConfig

	// Determine which pod to use
	if agentIDStr != "" {
		// Agent-based chat: get or create persistent agent pod
		if a.useConvex() {
			// Convex uses string IDs
			convexConfig, convexErr := a.convex.GetAgentConfig(agentIDStr)
			if convexErr != nil {
				sendSSEError(c, fmt.Sprintf("Agent config not found: %v", convexErr))
				return nil
			}
			modelConfig := convexToModelConfig(convexConfig)
			agentConfig = &modelConfig
		} else {
			// Legacy SQLite path - parse as int64
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
				if a.useConvex() && convexConversationID != "" && assistantResponse.Len() > 0 {
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
// active servers from user's saved TOML configs in the database.
// DB servers OVERRIDE embedded presets with the same name.
func (a *API) GetMCPPresets(c echo.Context) error {
	presets, err := mcp.LoadPresets()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to load presets: %v", err),
		})
	}

	// Collect all DB servers into a map (DB servers override embedded presets)
	configs, err := a.store.GetEnabledTomlConfigs()
	if err == nil {
		dbServers := make(map[string]mcp.PresetServer)

		for _, tomlConfig := range configs {
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
				// Keep original category and description if DB doesn't have one
				if dbServer.Description == "" {
					dbServer.Description = preset.Description
				}
				dbServer.Category = preset.Category // Keep original category
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
	if a.useConvex() {
		convexConfigs, err := a.convex.ListMCPConfigs()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to list TOML configs",
			})
		}
		// Convert to models.MCPTomlConfig for compatibility
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

	if a.useConvex() {
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

	if a.useConvex() {
		convexReq := &convex.CreateMCPConfigRequest{
			Name:    req.Name,
			Content: req.Content,
			Enabled: true, // Default to enabled
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

	if a.useConvex() {
		// Get the config by name to find its ID
		cfg, err := a.convex.GetMCPConfigByName(name)
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "TOML config not found",
			})
		}
		// Update via Convex
		convexReq := &convex.UpdateMCPConfigRequest{
			Content: req.Content,
		}
		if err := a.convex.UpdateMCPConfig(cfg.ID, convexReq); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to update TOML config",
			})
		}
		// Fetch updated config
		updated, _ := a.convex.GetMCPConfigByName(name)
		return c.JSON(http.StatusOK, models.MCPTomlConfig{
			ConvexID:  updated.ID,
			Name:      updated.Name,
			Content:   updated.Content,
			IsDefault: updated.IsDefault,
			Enabled:   updated.Enabled,
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

	if a.useConvex() {
		// Get the config by name to find its ID
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

	if err := a.store.DeleteTomlConfig(name); err != nil {
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

	if a.useConvex() {
		// Get the config by name to find its ID
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
	var configContents []string

	if a.useConvex() {
		convexConfigs, err := a.convex.GetEnabledMCPConfigs()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to get enabled configs",
			})
		}
		for _, cfg := range convexConfigs {
			configContents = append(configContents, cfg.Content)
		}
	} else {
		configs, err := a.store.GetEnabledTomlConfigs()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to get enabled configs",
			})
		}
		for _, cfg := range configs {
			configContents = append(configContents, cfg.Content)
		}
	}

	// Parse all enabled configs and merge servers
	serverMap := make(map[string]models.MCPServer)
	for _, content := range configContents {
		servers, err := mcp.ParseTOML(content)
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

// --- Skill Endpoints ---

// ListSkills returns all skills
func (a *API) ListSkills(c echo.Context) error {
	if a.useConvex() {
		convexSkills, err := a.convex.ListSkills()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to list skills",
			})
		}
		// Convert to models.Skill for compatibility
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

	skills, err := a.store.ListSkills()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to list skills",
		})
	}
	if skills == nil {
		skills = []models.Skill{}
	}
	return c.JSON(http.StatusOK, skills)
}

// GetSkill returns a skill by name
func (a *API) GetSkill(c echo.Context) error {
	name := c.Param("name")

	if a.useConvex() {
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

	skill, err := a.store.GetSkill(name)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Skill not found",
		})
	}
	return c.JSON(http.StatusOK, skill)
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

	if a.useConvex() {
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

	skill := &models.Skill{
		Name:           req.Name,
		InstallCommand: req.InstallCommand,
		Description:    req.Description,
		Category:       category,
		IsBuiltin:      false,
		Enabled:        true,
	}

	id, err := a.store.CreateSkill(skill)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create skill",
		})
	}

	skill.ID = id
	return c.JSON(http.StatusCreated, skill)
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

	if a.useConvex() {
		// Get existing skill to get its ID
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

		// Return updated skill
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

	// Get existing skill
	existing, err := a.store.GetSkill(name)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Skill not found",
		})
	}

	// Update fields
	if req.InstallCommand != "" {
		existing.InstallCommand = req.InstallCommand
	}
	if req.Description != "" {
		existing.Description = req.Description
	}
	if req.Category != "" {
		existing.Category = req.Category
	}

	if err := a.store.UpdateSkill(existing); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update skill",
		})
	}

	return c.JSON(http.StatusOK, existing)
}

// DeleteSkill deletes a skill
func (a *API) DeleteSkill(c echo.Context) error {
	name := c.Param("name")

	if a.useConvex() {
		// Get skill to check if it's builtin
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

	// Check if skill exists and is not builtin
	skill, err := a.store.GetSkill(name)
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

	if err := a.store.DeleteSkill(name); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete skill",
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

	if a.useConvex() {
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

	if err := a.store.ToggleSkill(name, req.Enabled); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to toggle skill",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Skill %s %s", name, map[bool]string{true: "enabled", false: "disabled"}[req.Enabled]),
	})
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
