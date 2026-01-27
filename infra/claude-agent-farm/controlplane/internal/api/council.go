package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/council"
)

// CouncilProviderResponse is the response for listing available providers
type CouncilProviderResponse struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Model string `json:"model"`
	Tier  string `json:"tier"`
}

// GetCouncilPodStatus returns the council pod status
func (a *API) GetCouncilPodStatus(c echo.Context) error {
	if a.k8sClient == nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"status":   "unavailable",
			"pod_name": "",
			"message":  "Kubernetes not available",
		})
	}

	podName := "claude-council-pod"
	running, err := a.k8sClient.IsPodRunning(podName)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"status":   "not_found",
			"pod_name": podName,
			"message":  "Pod not created yet",
		})
	}

	status := "stopped"
	if running {
		status = "running"
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":   status,
		"pod_name": podName,
	})
}

// LaunchCouncilPod creates or ensures the council pod is running
func (a *API) LaunchCouncilPod(c echo.Context) error {
	if a.k8sClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Kubernetes not available",
		})
	}

	podName, err := a.k8sClient.GetOrCreateCouncilPod()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to launch council pod: %v", err),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"pod_name": podName,
		"status":   "running",
	})
}

// RefreshCouncilPod deletes and recreates the council pod
func (a *API) RefreshCouncilPod(c echo.Context) error {
	if a.k8sClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Kubernetes not available",
		})
	}

	podName := "claude-council-pod"

	// Delete existing pod
	_ = a.k8sClient.StopAgent(podName)

	// Wait a moment for deletion
	time.Sleep(2 * time.Second)

	// Create new pod
	newPodName, err := a.k8sClient.GetOrCreateCouncilPod()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to refresh council pod: %v", err),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"pod_name": newPodName,
		"status":   "running",
	})
}

// ListCouncilProviders returns available LLM providers for the council
func (a *API) ListCouncilProviders(c echo.Context) error {
	// Return providers grouped by tier
	allProviders := append(council.ProProviders, council.NormalProviders...)
	providers := make([]CouncilProviderResponse, len(allProviders))
	for i, p := range allProviders {
		providers[i] = CouncilProviderResponse{
			ID:    p.ID,
			Name:  p.Name,
			Model: p.Model,
			Tier:  p.Tier,
		}
	}
	return c.JSON(http.StatusOK, providers)
}

// CouncilAsk handles the council deliberation process with SSE streaming
// GET /api/council/ask?question=...&providers=claude,gpt4,gemini&chairmen=claude,openai
func (a *API) CouncilAsk(c echo.Context) error {
	if a.k8sClient == nil {
		return c.String(http.StatusServiceUnavailable, "Kubernetes not available")
	}

	question := c.QueryParam("question")
	providersParam := c.QueryParam("providers")
	chairmenParam := c.QueryParam("chairmen")
	// Backwards compatibility: support single chairman param
	if chairmenParam == "" {
		chairmenParam = c.QueryParam("chairman")
	}

	if question == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Question is required",
		})
	}

	// Parse providers
	providerIDs := []string{"claude", "gpt4", "gemini"} // defaults
	if providersParam != "" {
		providerIDs = strings.Split(providersParam, ",")
		for i, p := range providerIDs {
			providerIDs[i] = strings.TrimSpace(p)
		}
	}

	// Validate providers
	for _, pid := range providerIDs {
		if council.GetProviderByID(pid) == nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("Unknown provider: %s", pid),
			})
		}
	}

	// Parse chairmen (multiple allowed)
	var chairmanIDs []string
	if chairmenParam != "" {
		chairmanIDs = strings.Split(chairmenParam, ",")
		for i, c := range chairmanIDs {
			chairmanIDs[i] = strings.TrimSpace(c)
		}
	} else {
		// Default to first provider
		chairmanIDs = []string{providerIDs[0]}
	}

	// Validate chairmen
	for _, cid := range chairmanIDs {
		if council.GetProviderByID(cid) == nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("Unknown chairman provider: %s", cid),
			})
		}
	}

	// Set SSE headers
	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")
	c.Response().Header().Set("X-Accel-Buffering", "no")

	ctx, cancel := context.WithTimeout(c.Request().Context(), 15*time.Minute)
	defer cancel()

	// Start heartbeat goroutine to keep connection alive during long queries
	heartbeatDone := make(chan struct{})
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-heartbeatDone:
				return
			case <-ctx.Done():
				return
			case <-ticker.C:
				sendCouncilSSEEvent(c, map[string]interface{}{
					"type": "heartbeat",
				})
			}
		}
	}()
	defer close(heartbeatDone)

	// Get or create dedicated council pod for running queries
	podName, err := a.k8sClient.GetOrCreateCouncilPod()
	if err != nil {
		sendCouncilSSEError(c, fmt.Sprintf("Failed to get pod: %v", err))
		return nil
	}

	// Create orchestrator
	orchestrator := council.NewOrchestrator(a.k8sClient, podName)

	// Send start event
	sendCouncilSSEEvent(c, map[string]interface{}{
		"type":      "start",
		"providers": providerIDs,
		"chairmen":  chairmanIDs,
		"chairman":  chairmanIDs[0], // backwards compatibility
		"pod_name":  podName,
	})

	// Emit function for streaming events
	emit := func(event map[string]interface{}) {
		sendCouncilSSEEvent(c, event)
	}

	// Stage 1: Deliberation
	emit(map[string]interface{}{
		"type":  "stage",
		"stage": "deliberation",
	})

	responses, err := orchestrator.Deliberate(ctx, question, providerIDs, emit)
	if err != nil {
		sendCouncilSSEError(c, fmt.Sprintf("Deliberation failed: %v", err))
		return nil
	}

	// Send all responses
	for _, r := range responses {
		emit(map[string]interface{}{
			"type":        "provider_response",
			"provider":    r.Provider,
			"provider_id": r.ProviderID,
			"model":       r.Model,
			"response":    r.Response,
			"error":       r.Error,
		})
	}

	// Stage 2: Peer Review
	emit(map[string]interface{}{
		"type":  "stage",
		"stage": "peer_review",
	})

	rankings, err := orchestrator.PeerReview(ctx, question, responses, emit)
	if err != nil {
		// Peer review is optional, continue even if it fails
		emit(map[string]interface{}{
			"type":    "review_error",
			"message": err.Error(),
		})
		rankings = nil
	}

	// Stage 3: Synthesis (multiple chairmen)
	emit(map[string]interface{}{
		"type":     "stage",
		"stage":    "synthesis",
		"chairmen": chairmanIDs,
	})

	// Use multiple chairmen synthesis
	syntheses := orchestrator.SynthesizeMultiple(ctx, question, responses, rankings, chairmanIDs, emit)

	// Send final result
	result := council.CouncilResult{
		Question:    question,
		Responses:   responses,
		PeerReviews: rankings,
		Syntheses:   syntheses,
	}

	// Backwards compatibility: set single synthesis/chairman if only one
	if len(syntheses) > 0 {
		result.Synthesis = syntheses[0].Synthesis
		result.ChairmanID = syntheses[0].ChairmanID
	}

	emit(map[string]interface{}{
		"type":   "result",
		"result": result,
	})

	// Done
	sendCouncilSSEEvent(c, map[string]interface{}{
		"type": "done",
	})

	return nil
}

func sendCouncilSSEEvent(c echo.Context, data interface{}) {
	jsonData, _ := json.Marshal(data)
	fmt.Fprintf(c.Response(), "data: %s\n\n", jsonData)
	c.Response().Flush()
}

func sendCouncilSSEError(c echo.Context, message string) {
	sendCouncilSSEEvent(c, map[string]string{
		"type":    "error",
		"message": message,
	})
	// Always send done event to properly terminate the stream
	sendCouncilSSEEvent(c, map[string]string{
		"type": "done",
	})
}
