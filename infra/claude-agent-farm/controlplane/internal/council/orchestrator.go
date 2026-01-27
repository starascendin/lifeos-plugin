package council

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/starascendin/claude-agent-farm/controlplane/internal/k8s"
)

// Provider represents a supported LLM provider
type Provider struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Model string `json:"model"`
	Tier  string `json:"tier"` // "pro" or "normal"
}

// ProProviders are the high-end models
var ProProviders = []Provider{
	{ID: "claude-pro", Name: "Opus 4.5", Model: "anthropic/claude-opus-4-5", Tier: "pro"},
	{ID: "openai-pro", Name: "GPT-5.2", Model: "openai/gpt-5.2", Tier: "pro"},
	{ID: "gemini-pro", Name: "Gemini Pro", Model: "google/gemini-2.5-pro", Tier: "pro"},
}

// NormalProviders are the standard models
var NormalProviders = []Provider{
	{ID: "claude", Name: "Sonnet 4.5", Model: "anthropic/claude-sonnet-4-5", Tier: "normal"},
	{ID: "openai", Name: "GPT-5.1 Mini", Model: "openai/gpt-5.1-codex-mini", Tier: "normal"},
	{ID: "gemini", Name: "Gemini Flash", Model: "google/gemini-2.5-flash", Tier: "normal"},
}

// DefaultProviders returns all providers (for backwards compatibility)
var DefaultProviders = append(ProProviders, NormalProviders...)

// ProviderResponse holds a provider's response to a question
type ProviderResponse struct {
	Provider   string `json:"provider"`
	ProviderID string `json:"provider_id"`
	Model      string `json:"model"`
	Response   string `json:"response"`
	Error      string `json:"error,omitempty"`
}

// DimensionScore holds scores for a single response across dimensions
type DimensionScore struct {
	Accuracy    int      `json:"accuracy"`    // 1-5, how factually correct
	Completeness int     `json:"completeness"` // 1-5, how thorough
	Clarity     int      `json:"clarity"`     // 1-5, how clear and readable
	Insight     int      `json:"insight"`     // 1-5, depth of understanding
	Total       int      `json:"total"`       // sum of all dimensions
	Pros        []string `json:"pros"`        // strengths
	Cons        []string `json:"cons"`        // weaknesses
}

// PeerRanking holds a provider's ranking of responses
type PeerRanking struct {
	RankerID   string                     `json:"ranker_id"`
	Rankings   map[string]int             `json:"rankings"`   // provider_id -> rank (1 = best)
	Scores     map[string]DimensionScore  `json:"scores"`     // provider_id -> dimension scores
	Reasoning  string                     `json:"reasoning"`
}

// ChairmanSynthesis holds a single chairman's synthesis
type ChairmanSynthesis struct {
	ChairmanID   string `json:"chairman_id"`
	ChairmanName string `json:"chairman_name"`
	Synthesis    string `json:"synthesis"`
	Error        string `json:"error,omitempty"`
}

// CouncilResult holds the final synthesized result
type CouncilResult struct {
	Question     string              `json:"question"`
	Responses    []ProviderResponse  `json:"responses"`
	PeerReviews  []PeerRanking       `json:"peer_reviews"`
	Syntheses    []ChairmanSynthesis `json:"syntheses"`
	// Deprecated: use Syntheses instead. Kept for backwards compatibility.
	Synthesis    string              `json:"synthesis,omitempty"`
	ChairmanID   string              `json:"chairman_id,omitempty"`
}

// Orchestrator manages the council deliberation process
type Orchestrator struct {
	k8sClient *k8s.Client
	podName   string
}

// NewOrchestrator creates a new council orchestrator
func NewOrchestrator(k8sClient *k8s.Client, podName string) *Orchestrator {
	return &Orchestrator{
		k8sClient: k8sClient,
		podName:   podName,
	}
}

// GetProviderByID returns a provider by its ID
func GetProviderByID(id string) *Provider {
	for _, p := range ProProviders {
		if p.ID == id {
			return &p
		}
	}
	for _, p := range NormalProviders {
		if p.ID == id {
			return &p
		}
	}
	return nil
}

// GetProvidersByTier returns providers for a specific tier
func GetProvidersByTier(tier string) []Provider {
	if tier == "pro" {
		return ProProviders
	}
	return NormalProviders
}

// EventEmitter is a function type for emitting SSE events
type EventEmitter func(event map[string]interface{})

// Deliberate queries all providers in parallel (Stage 1)
func (o *Orchestrator) Deliberate(ctx context.Context, question string, providerIDs []string, emit EventEmitter) ([]ProviderResponse, error) {
	var wg sync.WaitGroup
	responses := make([]ProviderResponse, len(providerIDs))
	var mu sync.Mutex

	for i, providerID := range providerIDs {
		wg.Add(1)
		go func(idx int, pid string) {
			defer wg.Done()

			provider := GetProviderByID(pid)
			if provider == nil {
				mu.Lock()
				responses[idx] = ProviderResponse{
					ProviderID: pid,
					Error:      "unknown provider",
				}
				mu.Unlock()
				return
			}

			emit(map[string]interface{}{
				"type":     "provider_start",
				"provider": provider.Name,
				"provider_id": pid,
			})

			// Query the provider using opencode
			response, err := o.queryProvider(ctx, provider, question, emit)

			mu.Lock()
			responses[idx] = ProviderResponse{
				Provider:   provider.Name,
				ProviderID: pid,
				Model:      provider.Model,
				Response:   response,
			}
			if err != nil {
				responses[idx].Error = err.Error()
			}
			mu.Unlock()

			emit(map[string]interface{}{
				"type":        "provider_done",
				"provider":    provider.Name,
				"provider_id": pid,
				"has_error":   err != nil,
			})
		}(i, providerID)
	}

	wg.Wait()
	return responses, nil
}

func (o *Orchestrator) queryProvider(ctx context.Context, provider *Provider, question string, emit EventEmitter) (string, error) {
	// Use opencode with the specific model
	cmd := []string{
		"opencode", "run",
		"--model", provider.Model,
		question,
	}

	// Create a context with timeout for each provider query
	queryCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	output, err := o.k8sClient.ExecCommandWithOutput(queryCtx, o.podName, cmd)
	if err != nil {
		return "", fmt.Errorf("query failed: %w", err)
	}

	return strings.TrimSpace(output), nil
}

// PeerReview has each provider rank the anonymized responses (Stage 2)
func (o *Orchestrator) PeerReview(ctx context.Context, question string, responses []ProviderResponse, emit EventEmitter) ([]PeerRanking, error) {
	emit(map[string]interface{}{
		"type": "review_start",
	})

	// Build anonymized response text
	labels := []string{"A", "B", "C", "D", "E", "F"}
	providerLabels := make(map[string]string) // provider_id -> label
	var responseText strings.Builder

	for i, r := range responses {
		if i >= len(labels) {
			break
		}
		label := labels[i]
		providerLabels[r.ProviderID] = label
		responseText.WriteString(fmt.Sprintf("\nResponse %s:\n%s\n", label, r.Response))
	}

	reviewPrompt := fmt.Sprintf(`You are reviewing multiple AI responses to this question: "%s"

%s

Rate each response on these dimensions (1-5 scale, 3 = standard/acceptable):
- Accuracy: Is it factually correct?
- Completeness: Does it fully address the question?
- Clarity: Is it well-organized and easy to understand?
- Insight: Does it show deep understanding or novel perspectives?

For each response, identify specific Pros (add points) and Cons (dock points).

Respond in this exact JSON format:
{
  "scores": {
    "A": {
      "accuracy": 4,
      "completeness": 3,
      "clarity": 5,
      "insight": 4,
      "pros": ["Clear explanation", "Good examples"],
      "cons": ["Missing edge cases"]
    },
    "B": { ... }
  },
  "rankings": {"A": 1, "B": 2},
  "reasoning": "Brief summary of your evaluation"
}`, question, responseText.String())

	var wg sync.WaitGroup
	rankings := make([]PeerRanking, 0)
	var mu sync.Mutex

	// Have each provider review (use only providers that responded successfully)
	for _, r := range responses {
		if r.Error != "" {
			continue
		}
		wg.Add(1)
		go func(resp ProviderResponse) {
			defer wg.Done()

			provider := GetProviderByID(resp.ProviderID)
			if provider == nil {
				return
			}

			// Query the provider for rankings
			reviewCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
			defer cancel()

			cmd := []string{
				"opencode", "run",
				"--model", provider.Model,
				reviewPrompt,
			}

			output, err := o.k8sClient.ExecCommandWithOutput(reviewCtx, o.podName, cmd)
			if err != nil {
				return
			}

			// Parse the JSON response
			ranking, err := parseRankingResponse(output, providerLabels, responses)
			if err != nil {
				return
			}

			ranking.RankerID = resp.ProviderID

			mu.Lock()
			rankings = append(rankings, ranking)
			mu.Unlock()
		}(r)
	}

	wg.Wait()

	emit(map[string]interface{}{
		"type":     "review_done",
		"rankings": rankings,
	})

	return rankings, nil
}

func parseRankingResponse(output string, providerLabels map[string]string, responses []ProviderResponse) (PeerRanking, error) {
	// Try to find JSON in the output
	start := strings.Index(output, "{")
	end := strings.LastIndex(output, "}")
	if start == -1 || end == -1 || end <= start {
		return PeerRanking{}, fmt.Errorf("no JSON found in response")
	}

	jsonStr := output[start : end+1]

	var parsed struct {
		Rankings  map[string]int `json:"rankings"`
		Scores    map[string]struct {
			Accuracy     int      `json:"accuracy"`
			Completeness int      `json:"completeness"`
			Clarity      int      `json:"clarity"`
			Insight      int      `json:"insight"`
			Pros         []string `json:"pros"`
			Cons         []string `json:"cons"`
		} `json:"scores"`
		Reasoning string `json:"reasoning"`
	}

	if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil {
		return PeerRanking{}, fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Convert label rankings back to provider IDs
	labelToProvider := make(map[string]string)
	for pid, label := range providerLabels {
		labelToProvider[label] = pid
	}

	providerRankings := make(map[string]int)
	for label, rank := range parsed.Rankings {
		if pid, ok := labelToProvider[label]; ok {
			providerRankings[pid] = rank
		}
	}

	providerScores := make(map[string]DimensionScore)
	for label, score := range parsed.Scores {
		if pid, ok := labelToProvider[label]; ok {
			total := score.Accuracy + score.Completeness + score.Clarity + score.Insight
			providerScores[pid] = DimensionScore{
				Accuracy:     score.Accuracy,
				Completeness: score.Completeness,
				Clarity:      score.Clarity,
				Insight:      score.Insight,
				Total:        total,
				Pros:         score.Pros,
				Cons:         score.Cons,
			}
		}
	}

	return PeerRanking{
		Rankings:  providerRankings,
		Scores:    providerScores,
		Reasoning: parsed.Reasoning,
	}, nil
}

// Synthesize creates the final answer using the chairman model (Stage 3)
func (o *Orchestrator) Synthesize(ctx context.Context, question string, responses []ProviderResponse, rankings []PeerRanking, chairmanID string, emit EventEmitter) (string, error) {
	emit(map[string]interface{}{
		"type":        "synthesis_start",
		"chairman":    chairmanID,
		"chairman_id": chairmanID,
	})

	chairman := GetProviderByID(chairmanID)
	if chairman == nil {
		return "", fmt.Errorf("unknown chairman provider: %s", chairmanID)
	}

	// Build the synthesis prompt
	var responsesText strings.Builder
	for _, r := range responses {
		if r.Error != "" {
			continue
		}
		responsesText.WriteString(fmt.Sprintf("\n=== %s (%s) ===\n%s\n", r.Provider, r.ProviderID, r.Response))
	}

	// Summarize rankings
	var rankingsText strings.Builder
	for _, ranking := range rankings {
		ranker := GetProviderByID(ranking.RankerID)
		rankerName := ranking.RankerID
		if ranker != nil {
			rankerName = ranker.Name
		}
		rankingsText.WriteString(fmt.Sprintf("\n%s's rankings: ", rankerName))
		for pid, rank := range ranking.Rankings {
			provider := GetProviderByID(pid)
			name := pid
			if provider != nil {
				name = provider.Name
			}
			rankingsText.WriteString(fmt.Sprintf("%s=#%d ", name, rank))
		}
		if ranking.Reasoning != "" {
			rankingsText.WriteString(fmt.Sprintf("\nReasoning: %s", ranking.Reasoning))
		}
		rankingsText.WriteString("\n")
	}

	synthesisPrompt := fmt.Sprintf(`You are the chairman of an LLM council. Multiple AI models answered this question:

Question: "%s"

Their responses:
%s

Peer review rankings:
%s

Your task: Synthesize the best possible answer by combining the collective wisdom of all responses.
- Incorporate the strongest points from each response
- Resolve any disagreements thoughtfully
- Provide a clear, comprehensive final answer

Provide only the synthesized answer, no meta-commentary.`, question, responsesText.String(), rankingsText.String())

	synthesisCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

	cmd := []string{
		"opencode", "run",
		"--model", chairman.Model,
		synthesisPrompt,
	}

	output, err := o.k8sClient.ExecCommandWithOutput(synthesisCtx, o.podName, cmd)
	if err != nil {
		return "", fmt.Errorf("synthesis failed: %w", err)
	}

	synthesis := strings.TrimSpace(output)

	emit(map[string]interface{}{
		"type":         "synthesis_content",
		"chairman_id":  chairmanID,
		"chairman":     chairman.Name,
		"content":      synthesis,
	})

	return synthesis, nil
}

// SynthesizeMultiple creates synthesis from multiple chairmen in parallel (Stage 3)
func (o *Orchestrator) SynthesizeMultiple(ctx context.Context, question string, responses []ProviderResponse, rankings []PeerRanking, chairmanIDs []string, emit EventEmitter) []ChairmanSynthesis {
	var wg sync.WaitGroup
	syntheses := make([]ChairmanSynthesis, len(chairmanIDs))
	var mu sync.Mutex

	for i, chairmanID := range chairmanIDs {
		wg.Add(1)
		go func(idx int, cid string) {
			defer wg.Done()

			chairman := GetProviderByID(cid)
			chairmanName := cid
			if chairman != nil {
				chairmanName = chairman.Name
			}

			synthesis, err := o.Synthesize(ctx, question, responses, rankings, cid, emit)

			mu.Lock()
			syntheses[idx] = ChairmanSynthesis{
				ChairmanID:   cid,
				ChairmanName: chairmanName,
				Synthesis:    synthesis,
			}
			if err != nil {
				syntheses[idx].Error = err.Error()
			}
			mu.Unlock()
		}(i, chairmanID)
	}

	wg.Wait()
	return syntheses
}
