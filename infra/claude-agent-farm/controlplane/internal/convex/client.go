package convex

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/starascendin/claude-agent-farm/controlplane/internal/mcp"
)

// Client is an HTTP client for Convex controlplane API
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new Convex HTTP client
func NewClient(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetBaseURL returns the Convex deployment URL
func (c *Client) GetBaseURL() string {
	return c.baseURL
}

// ==================== AGENT CONFIGS ====================

// AgentConfig represents an agent configuration from Convex
type AgentConfig struct {
	ID            string  `json:"_id"`
	Name          string  `json:"name"`
	Repos         string  `json:"repos"`
	TaskPrompt    string  `json:"taskPrompt"`
	SystemPrompt  string  `json:"systemPrompt"`
	MaxTurns      int     `json:"maxTurns"`
	MaxBudgetUSD  float64 `json:"maxBudgetUsd"`
	CPULimit      string  `json:"cpuLimit"`
	MemoryLimit   string  `json:"memoryLimit"`
	AllowedTools  string  `json:"allowedTools"`
	EnabledMCPs   string  `json:"enabledMcps"`
	EnabledSkills string  `json:"enabledSkills"`
	CreatedAt     int64   `json:"createdAt"`
	UpdatedAt     int64   `json:"updatedAt"`
}

// ListAgentConfigs lists all agent configs
func (c *Client) ListAgentConfigs() ([]AgentConfig, error) {
	var configs []AgentConfig
	err := c.doRequest("GET", "/controlplane/configs", nil, &configs)
	return configs, err
}

// GetAgentConfig gets a single agent config by ID
func (c *Client) GetAgentConfig(id string) (*AgentConfig, error) {
	var config AgentConfig
	err := c.doRequest("GET", "/controlplane/config?id="+url.QueryEscape(id), nil, &config)
	if err != nil {
		return nil, err
	}
	return &config, nil
}

// CreateAgentConfigRequest is the request body for creating an agent config
type CreateAgentConfigRequest struct {
	Name          string  `json:"name"`
	Repos         string  `json:"repos,omitempty"`
	TaskPrompt    string  `json:"taskPrompt,omitempty"`
	SystemPrompt  string  `json:"systemPrompt,omitempty"`
	MaxTurns      int     `json:"maxTurns,omitempty"`
	MaxBudgetUSD  float64 `json:"maxBudgetUsd,omitempty"`
	CPULimit      string  `json:"cpuLimit,omitempty"`
	MemoryLimit   string  `json:"memoryLimit,omitempty"`
	AllowedTools  string  `json:"allowedTools,omitempty"`
	EnabledMCPs   string  `json:"enabledMcps,omitempty"`
	EnabledSkills string  `json:"enabledSkills,omitempty"`
}

// CreateAgentConfig creates a new agent config
func (c *Client) CreateAgentConfig(req *CreateAgentConfigRequest) (string, error) {
	var result struct {
		ID string `json:"id"`
	}
	err := c.doRequest("POST", "/controlplane/configs", req, &result)
	return result.ID, err
}

// UpdateAgentConfig updates an existing agent config
func (c *Client) UpdateAgentConfig(id string, req *CreateAgentConfigRequest) error {
	return c.doRequest("PUT", "/controlplane/config?id="+url.QueryEscape(id), req, nil)
}

// DeleteAgentConfig deletes an agent config
func (c *Client) DeleteAgentConfig(id string) error {
	return c.doRequest("DELETE", "/controlplane/config?id="+url.QueryEscape(id), nil, nil)
}

// ==================== MCP CONFIGS ====================

// MCPConfig represents an MCP TOML configuration from Convex
type MCPConfig struct {
	ID        string `json:"_id"`
	Name      string `json:"name"`
	Content   string `json:"content"`
	IsDefault bool   `json:"isDefault"`
	Enabled   bool   `json:"enabled"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

// ListMCPConfigs lists all MCP configs
func (c *Client) ListMCPConfigs() ([]MCPConfig, error) {
	var configs []MCPConfig
	err := c.doRequest("GET", "/controlplane/mcp-configs", nil, &configs)
	return configs, err
}

// GetEnabledMCPConfigs lists only enabled MCP configs
func (c *Client) GetEnabledMCPConfigs() ([]MCPConfig, error) {
	var configs []MCPConfig
	err := c.doRequest("GET", "/controlplane/mcp-configs?enabled=true", nil, &configs)
	return configs, err
}

// GetMCPConfig gets a single MCP config by ID
func (c *Client) GetMCPConfig(id string) (*MCPConfig, error) {
	var config MCPConfig
	err := c.doRequest("GET", "/controlplane/mcp-config?id="+url.QueryEscape(id), nil, &config)
	if err != nil {
		return nil, err
	}
	return &config, nil
}

// CreateMCPConfigRequest is the request body for creating an MCP config
type CreateMCPConfigRequest struct {
	Name      string `json:"name"`
	Content   string `json:"content"`
	IsDefault bool   `json:"isDefault,omitempty"`
	Enabled   bool   `json:"enabled,omitempty"`
}

// CreateMCPConfig creates a new MCP config
func (c *Client) CreateMCPConfig(req *CreateMCPConfigRequest) (string, error) {
	var result struct {
		ID string `json:"id"`
	}
	err := c.doRequest("POST", "/controlplane/mcp-configs", req, &result)
	return result.ID, err
}

// UpdateMCPConfigRequest is the request body for updating an MCP config
type UpdateMCPConfigRequest struct {
	Content string `json:"content,omitempty"`
	Enabled *bool  `json:"enabled,omitempty"`
}

// UpdateMCPConfig updates an existing MCP config
func (c *Client) UpdateMCPConfig(id string, req *UpdateMCPConfigRequest) error {
	return c.doRequest("PUT", "/controlplane/mcp-config?id="+url.QueryEscape(id), req, nil)
}

// ToggleMCPConfig enables or disables an MCP config
func (c *Client) ToggleMCPConfig(id string, enabled bool) error {
	req := &UpdateMCPConfigRequest{Enabled: &enabled}
	return c.doRequest("PUT", "/controlplane/mcp-config?id="+url.QueryEscape(id), req, nil)
}

// DeleteMCPConfig deletes an MCP config
func (c *Client) DeleteMCPConfig(id string) error {
	return c.doRequest("DELETE", "/controlplane/mcp-config?id="+url.QueryEscape(id), nil, nil)
}

// ==================== SKILLS ====================

// Skill represents a Claude skill from Convex
type Skill struct {
	ID             string `json:"_id"`
	Name           string `json:"name"`
	InstallCommand string `json:"installCommand"`
	Description    string `json:"description"`
	Category       string `json:"category"`
	IsBuiltin      bool   `json:"isBuiltin"`
	Enabled        bool   `json:"enabled"`
	CreatedAt      int64  `json:"createdAt"`
	UpdatedAt      int64  `json:"updatedAt"`
}

// ListSkills lists all skills
func (c *Client) ListSkills() ([]Skill, error) {
	var skills []Skill
	err := c.doRequest("GET", "/controlplane/skills", nil, &skills)
	return skills, err
}

// GetEnabledSkills lists only enabled skills
func (c *Client) GetEnabledSkills() ([]Skill, error) {
	var skills []Skill
	err := c.doRequest("GET", "/controlplane/skills?enabled=true", nil, &skills)
	return skills, err
}

// GetSkill gets a single skill by ID
func (c *Client) GetSkill(id string) (*Skill, error) {
	var skill Skill
	err := c.doRequest("GET", "/controlplane/skill?id="+url.QueryEscape(id), nil, &skill)
	if err != nil {
		return nil, err
	}
	return &skill, nil
}

// CreateSkillRequest is the request body for creating a skill
type CreateSkillRequest struct {
	Name           string `json:"name"`
	InstallCommand string `json:"installCommand"`
	Description    string `json:"description,omitempty"`
	Category       string `json:"category,omitempty"`
	IsBuiltin      bool   `json:"isBuiltin,omitempty"`
	Enabled        bool   `json:"enabled,omitempty"`
}

// CreateSkill creates a new skill
func (c *Client) CreateSkill(req *CreateSkillRequest) (string, error) {
	var result struct {
		ID string `json:"id"`
	}
	err := c.doRequest("POST", "/controlplane/skills", req, &result)
	return result.ID, err
}

// UpdateSkillRequest is the request body for updating a skill
type UpdateSkillRequest struct {
	InstallCommand string `json:"installCommand,omitempty"`
	Description    string `json:"description,omitempty"`
	Category       string `json:"category,omitempty"`
	Enabled        *bool  `json:"enabled,omitempty"`
}

// UpdateSkill updates an existing skill
func (c *Client) UpdateSkill(id string, req *UpdateSkillRequest) error {
	return c.doRequest("PUT", "/controlplane/skill?id="+url.QueryEscape(id), req, nil)
}

// ToggleSkill enables or disables a skill
func (c *Client) ToggleSkill(id string, enabled bool) error {
	req := &UpdateSkillRequest{Enabled: &enabled}
	return c.doRequest("PUT", "/controlplane/skill?id="+url.QueryEscape(id), req, nil)
}

// DeleteSkill deletes a skill
func (c *Client) DeleteSkill(id string) error {
	return c.doRequest("DELETE", "/controlplane/skill?id="+url.QueryEscape(id), nil, nil)
}

// GetSkillByName gets a skill by name
func (c *Client) GetSkillByName(name string) (*Skill, error) {
	var skill Skill
	err := c.doRequest("GET", "/controlplane/skill-by-name?name="+url.QueryEscape(name), nil, &skill)
	if err != nil {
		return nil, err
	}
	return &skill, nil
}

// GetMCPConfigByName gets an MCP config by name
func (c *Client) GetMCPConfigByName(name string) (*MCPConfig, error) {
	var config MCPConfig
	err := c.doRequest("GET", "/controlplane/mcp-config-by-name?name="+url.QueryEscape(name), nil, &config)
	if err != nil {
		return nil, err
	}
	return &config, nil
}

// GetConversationByThreadID gets a conversation by thread ID
func (c *Client) GetConversationByThreadID(threadID string) (*Conversation, error) {
	var conv Conversation
	err := c.doRequest("GET", "/controlplane/conversation-by-thread?threadId="+url.QueryEscape(threadID), nil, &conv)
	if err != nil {
		return nil, err
	}
	return &conv, nil
}

// ==================== CONVERSATIONS ====================

// Conversation represents a chat conversation from Convex
type Conversation struct {
	ID              string `json:"_id"`
	AgentConfigID   string `json:"agentConfigId,omitempty"`
	AgentConfigName string `json:"agentConfigName,omitempty"`
	PodName         string `json:"podName,omitempty"`
	ThreadID        string `json:"threadId"`
	Title           string `json:"title,omitempty"`
	IsArchived      bool   `json:"isArchived"`
	CreatedAt       int64  `json:"createdAt"`
	UpdatedAt       int64  `json:"updatedAt"`
}

// ListConversations lists conversations
func (c *Client) ListConversations(limit int, includeArchived bool) ([]Conversation, error) {
	path := fmt.Sprintf("/controlplane/conversations?limit=%d&includeArchived=%t", limit, includeArchived)
	var conversations []Conversation
	err := c.doRequest("GET", path, nil, &conversations)
	return conversations, err
}

// GetConversation gets a single conversation by ID
func (c *Client) GetConversation(id string) (*Conversation, error) {
	var conv Conversation
	err := c.doRequest("GET", "/controlplane/conversation?id="+url.QueryEscape(id), nil, &conv)
	if err != nil {
		return nil, err
	}
	return &conv, nil
}

// CreateConversationRequest is the request body for creating a conversation
type CreateConversationRequest struct {
	AgentConfigID string `json:"agentConfigId,omitempty"`
	PodName       string `json:"podName,omitempty"`
	ThreadID      string `json:"threadId"`
	Title         string `json:"title,omitempty"`
}

// CreateConversation creates a new conversation
func (c *Client) CreateConversation(req *CreateConversationRequest) (string, error) {
	var result struct {
		ID string `json:"id"`
	}
	err := c.doRequest("POST", "/controlplane/conversations", req, &result)
	return result.ID, err
}

// UpdateConversationRequest is the request body for updating a conversation
type UpdateConversationRequest struct {
	Title      string `json:"title,omitempty"`
	IsArchived *bool  `json:"isArchived,omitempty"`
}

// UpdateConversation updates a conversation
func (c *Client) UpdateConversation(id string, req *UpdateConversationRequest) error {
	return c.doRequest("PUT", "/controlplane/conversation?id="+url.QueryEscape(id), req, nil)
}

// DeleteConversation deletes a conversation and all its messages
func (c *Client) DeleteConversation(id string) error {
	return c.doRequest("DELETE", "/controlplane/conversation?id="+url.QueryEscape(id), nil, nil)
}

// ==================== MESSAGES ====================

// ToolCall represents a tool call made by the assistant
type ToolCall struct {
	Name   string `json:"name"`
	Input  string `json:"input,omitempty"`
	Output string `json:"output,omitempty"`
}

// TokenUsage represents token usage for a message
type TokenUsage struct {
	Prompt     int `json:"prompt,omitempty"`
	Completion int `json:"completion,omitempty"`
}

// MessageMetadata represents optional metadata for a message
type MessageMetadata struct {
	ToolCalls []ToolCall  `json:"toolCalls,omitempty"`
	Model     string      `json:"model,omitempty"`
	Tokens    *TokenUsage `json:"tokens,omitempty"`
	Error     string      `json:"error,omitempty"`
}

// Message represents a chat message from Convex
type Message struct {
	ID             string           `json:"_id"`
	ConversationID string           `json:"conversationId"`
	Role           string           `json:"role"` // "user", "assistant", "system"
	Content        string           `json:"content"`
	Metadata       *MessageMetadata `json:"metadata,omitempty"`
	CreatedAt      int64            `json:"createdAt"`
}

// GetMessages gets messages for a conversation
func (c *Client) GetMessages(conversationID string, limit int) ([]Message, error) {
	path := fmt.Sprintf("/controlplane/messages?conversationId=%s&limit=%d", conversationID, limit)
	var messages []Message
	err := c.doRequest("GET", path, nil, &messages)
	return messages, err
}

// AddMessageRequest is the request body for adding a message
type AddMessageRequest struct {
	ConversationID string           `json:"conversationId"`
	Role           string           `json:"role"` // "user", "assistant", "system"
	Content        string           `json:"content"`
	Metadata       *MessageMetadata `json:"metadata,omitempty"`
}

// AddMessage adds a message to a conversation
func (c *Client) AddMessage(conversationID string, req *AddMessageRequest) (string, error) {
	// Set the conversation ID in the request
	req.ConversationID = conversationID
	var result struct {
		ID string `json:"id"`
	}
	err := c.doRequest("POST", "/controlplane/messages", req, &result)
	return result.ID, err
}

// ==================== INTERNAL HELPERS ====================

// doRequest performs an HTTP request to the Convex API
func (c *Client) doRequest(method, path string, body interface{}, result interface{}) error {
	// Build URL
	u, err := url.Parse(c.baseURL + path)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	// Build request body
	var bodyReader io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	// Create request
	req, err := http.NewRequest(method, u.String(), bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	// Handle error responses
	if resp.StatusCode >= 400 {
		var errResp struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(respBody, &errResp) == nil && errResp.Error != "" {
			return fmt.Errorf("API error (%d): %s", resp.StatusCode, errResp.Error)
		}
		return fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	if result != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("failed to parse response: %w", err)
		}
	}

	return nil
}

// SeedSkillsFromPresets seeds skills from presets.toml into Convex if they don't already exist
func (c *Client) SeedSkillsFromPresets() error {
	presets, err := mcp.LoadPresets()
	if err != nil {
		return fmt.Errorf("failed to load presets: %w", err)
	}

	// Get existing skills
	existing, err := c.ListSkills()
	if err != nil {
		return fmt.Errorf("failed to list existing skills: %w", err)
	}

	// Build a set of existing skill names
	existingNames := make(map[string]bool)
	for _, s := range existing {
		existingNames[s.Name] = true
	}

	// Create any missing preset skills
	for _, preset := range presets.Skills {
		if existingNames[preset.Name] {
			continue
		}
		_, err := c.CreateSkill(&CreateSkillRequest{
			Name:           preset.Name,
			InstallCommand: preset.InstallCommand,
			Description:    preset.Description,
			Category:       preset.Category,
			IsBuiltin:      true,
			Enabled:        true,
		})
		if err != nil {
			fmt.Printf("Warning: failed to seed skill %q: %v\n", preset.Name, err)
			continue
		}
		fmt.Printf("Seeded skill: %s\n", preset.Name)
	}

	return nil
}

// GetSkillInstallCommands gets install commands for a comma-separated list of skill names
func (c *Client) GetSkillInstallCommands(skillNames string) ([]string, error) {
	if skillNames == "" {
		return nil, nil
	}

	// Get enabled skills
	skills, err := c.GetEnabledSkills()
	if err != nil {
		return nil, err
	}

	// Build a map of skill name to install command
	skillMap := make(map[string]string)
	for _, skill := range skills {
		skillMap[skill.Name] = skill.InstallCommand
	}

	// Parse the comma-separated names and get commands
	names := parseCommaSeparated(skillNames)
	var commands []string
	for _, name := range names {
		if cmd, ok := skillMap[name]; ok {
			commands = append(commands, cmd)
		}
	}

	return commands, nil
}

// parseCommaSeparated splits a comma-separated string into a slice of trimmed strings
func parseCommaSeparated(s string) []string {
	if s == "" {
		return nil
	}

	var result []string
	for _, part := range bytes.Split([]byte(s), []byte(",")) {
		trimmed := bytes.TrimSpace(part)
		if len(trimmed) > 0 {
			result = append(result, string(trimmed))
		}
	}
	return result
}
