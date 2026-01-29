package handlers

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
	"github.com/starascendin/claude-agent-farm/controlplane/internal/k8s"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/models"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/storage"
)

type Handler struct {
	store     *storage.SQLiteStore
	k8sClient *k8s.Client
}

func NewHandler(store *storage.SQLiteStore, k8sClient *k8s.Client) *Handler {
	return &Handler{
		store:     store,
		k8sClient: k8sClient,
	}
}

// Dashboard renders the main dashboard
func (h *Handler) Dashboard(c echo.Context) error {
	agents, err := h.k8sClient.ListRunningAgents()
	if err != nil {
		agents = []models.RunningAgent{} // Show empty on error
	}

	configs, err := h.store.ListConfigs()
	if err != nil {
		configs = []models.AgentConfig{}
	}

	return c.Render(http.StatusOK, "dashboard", map[string]interface{}{
		"Agents":  agents,
		"Configs": configs,
	})
}

// AgentsList returns HTMX partial for agents list
func (h *Handler) AgentsList(c echo.Context) error {
	agents, err := h.k8sClient.ListRunningAgents()
	if err != nil {
		return c.String(http.StatusInternalServerError, "Failed to list agents")
	}

	return c.Render(http.StatusOK, "agents-list", map[string]interface{}{
		"Agents": agents,
	})
}

// ConfigsList returns HTMX partial for configs list
func (h *Handler) ConfigsList(c echo.Context) error {
	configs, err := h.store.ListConfigs()
	if err != nil {
		return c.String(http.StatusInternalServerError, "Failed to list configs")
	}

	return c.Render(http.StatusOK, "configs-list", map[string]interface{}{
		"Configs": configs,
	})
}

// ConfigForm returns the config creation/edit form
func (h *Handler) ConfigForm(c echo.Context) error {
	idStr := c.QueryParam("id")
	var config *models.AgentConfig

	if idStr != "" {
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err == nil {
			config, _ = h.store.GetConfig(id)
		}
	}

	if config == nil {
		config = &models.AgentConfig{
			MaxTurns:     50,
			MaxBudgetUSD: 10.0,
			CPULimit:     "1000m",
			MemoryLimit:  "2Gi",
			AllowedTools: "Read,Write,Edit,Bash,Glob,Grep",
		}
	}

	return c.Render(http.StatusOK, "config-form", config)
}

// SaveConfig creates or updates a config
func (h *Handler) SaveConfig(c echo.Context) error {
	config := &models.AgentConfig{}

	idStr := c.FormValue("id")
	if idStr != "" {
		id, _ := strconv.ParseInt(idStr, 10, 64)
		config.ID = id
	}

	config.Name = c.FormValue("name")
	config.Repos = c.FormValue("repos")
	config.TaskPrompt = c.FormValue("task_prompt")
	config.SystemPrompt = c.FormValue("system_prompt")
	config.MaxTurns, _ = strconv.Atoi(c.FormValue("max_turns"))
	config.MaxBudgetUSD, _ = strconv.ParseFloat(c.FormValue("max_budget_usd"), 64)
	config.CPULimit = c.FormValue("cpu_limit")
	config.MemoryLimit = c.FormValue("memory_limit")
	config.AllowedTools = c.FormValue("allowed_tools")

	if config.ID > 0 {
		if err := h.store.UpdateConfig(config); err != nil {
			return c.String(http.StatusInternalServerError, "Failed to update config")
		}
	} else {
		if _, err := h.store.CreateConfig(config); err != nil {
			return c.String(http.StatusInternalServerError, "Failed to create config")
		}
	}

	c.Response().Header().Set("HX-Trigger", "configSaved")
	return c.String(http.StatusOK, "Saved")
}

// DeleteConfig deletes a config
func (h *Handler) DeleteConfig(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.String(http.StatusBadRequest, "Invalid ID")
	}

	if err := h.store.DeleteConfig(id); err != nil {
		return c.String(http.StatusInternalServerError, "Failed to delete")
	}

	c.Response().Header().Set("HX-Trigger", "configDeleted")
	return c.String(http.StatusOK, "")
}

// StopAgent stops a running agent
func (h *Handler) StopAgent(c echo.Context) error {
	podName := c.Param("name")
	if err := h.k8sClient.StopAgent(podName); err != nil {
		return c.String(http.StatusInternalServerError, fmt.Sprintf("Failed to stop: %v", err))
	}

	c.Response().Header().Set("HX-Trigger", "agentStopped")
	return c.String(http.StatusOK, "Stopped")
}

// AgentLogs returns logs for an agent
func (h *Handler) AgentLogs(c echo.Context) error {
	podName := c.Param("name")
	logs, err := h.k8sClient.GetLogs(podName, 100)
	if err != nil {
		return c.String(http.StatusInternalServerError, fmt.Sprintf("Failed to get logs: %v", err))
	}

	return c.Render(http.StatusOK, "logs-view", map[string]interface{}{
		"PodName": podName,
		"Logs":    logs,
	})
}

// StreamAgentLogs streams logs via SSE
func (h *Handler) StreamAgentLogs(c echo.Context) error {
	podName := c.Param("name")

	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")

	ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Minute)
	defer cancel()

	logChan := make(chan string, 100)

	go func() {
		_ = h.k8sClient.StreamLogs(ctx, podName, logChan)
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

// ChatMessage represents a chat message
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Chat renders the chat page
func (h *Handler) Chat(c echo.Context) error {
	threadID := c.QueryParam("thread_id")

	return c.Render(http.StatusOK, "chat", map[string]interface{}{
		"ThreadID": threadID,
		"Messages": []ChatMessage{},
	})
}

// ChatSend handles sending a message and streaming the response via SSE
func (h *Handler) ChatSend(c echo.Context) error {
	message := c.QueryParam("message")
	threadID := c.QueryParam("thread_id")
	skipPermissions := c.QueryParam("skip_permissions") == "true"
	streamJSON := c.QueryParam("stream_json") == "true"

	if message == "" {
		return c.String(http.StatusBadRequest, "Message is required")
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

	// Get or create chat pod
	podName, err := h.k8sClient.GetOrCreateChatPod()
	if err != nil {
		sendSSEError(c, fmt.Sprintf("Failed to get chat pod: %v", err))
		return nil
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
		err := h.k8sClient.ExecCommand(ctx, podName, cmd, outputChan)
		if err != nil {
			outputChan <- fmt.Sprintf("__ERROR__:%v", err)
		}
		close(outputChan)
	}()

	// Stream output
	var fullResponse strings.Builder
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
											fullResponse.WriteString(text)
											sendSSEEvent(c, map[string]string{"type": "content", "content": text})
										}
									}
								}
							}
						}
					}
				} else {
					// Not JSON, send as content
					fullResponse.WriteString(output)
					sendSSEEvent(c, map[string]string{"type": "content", "content": output})
				}
			} else {
				// Plain text mode
				fullResponse.WriteString(output)
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
