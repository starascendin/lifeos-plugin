package github

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

// Repo represents a GitHub repository
type Repo struct {
	FullName    string `json:"full_name"`
	CloneURL    string `json:"clone_url"`
	SSHURL      string `json:"ssh_url"`
	Private     bool   `json:"private"`
	Description string `json:"description"`
}

// Client is a GitHub API client with caching
type Client struct {
	httpClient *http.Client
	cache      *repoCache
}

type repoCache struct {
	mu        sync.RWMutex
	repos     []Repo
	fetchedAt time.Time
	ttl       time.Duration
}

// NewClient creates a new GitHub API client
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		cache: &repoCache{
			ttl: 5 * time.Minute,
		},
	}
}

// ListRepos fetches the user's repos from GitHub with caching
// Uses GITHUB_PAT environment variable for authentication
func (c *Client) ListRepos() ([]Repo, error) {
	pat := os.Getenv("GITHUB_PAT")
	if pat == "" {
		return nil, fmt.Errorf("GITHUB_PAT environment variable not set")
	}

	// Check cache
	c.cache.mu.RLock()
	if time.Since(c.cache.fetchedAt) < c.cache.ttl && len(c.cache.repos) > 0 {
		repos := make([]Repo, len(c.cache.repos))
		copy(repos, c.cache.repos)
		c.cache.mu.RUnlock()
		return repos, nil
	}
	c.cache.mu.RUnlock()

	// Fetch from API
	repos, err := c.fetchRepos(pat)
	if err != nil {
		return nil, err
	}

	// Update cache
	c.cache.mu.Lock()
	c.cache.repos = repos
	c.cache.fetchedAt = time.Now()
	c.cache.mu.Unlock()

	return repos, nil
}

// fetchRepos fetches up to 200 repos (2 pages) sorted by recently updated
func (c *Client) fetchRepos(pat string) ([]Repo, error) {
	var allRepos []Repo

	for page := 1; page <= 2; page++ {
		url := fmt.Sprintf("https://api.github.com/user/repos?sort=updated&direction=desc&per_page=100&page=%d", page)

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		req.Header.Set("Authorization", "Bearer "+pat)
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch repos: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
		}

		var pageRepos []struct {
			FullName    string `json:"full_name"`
			CloneURL    string `json:"clone_url"`
			SSHURL      string `json:"ssh_url"`
			Private     bool   `json:"private"`
			Description string `json:"description"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&pageRepos); err != nil {
			return nil, fmt.Errorf("failed to decode response: %w", err)
		}

		for _, r := range pageRepos {
			allRepos = append(allRepos, Repo{
				FullName:    r.FullName,
				CloneURL:    r.CloneURL,
				SSHURL:      r.SSHURL,
				Private:     r.Private,
				Description: r.Description,
			})
		}

		// If we got less than 100, we're on the last page
		if len(pageRepos) < 100 {
			break
		}
	}

	return allRepos, nil
}

// IsConfigured returns true if GITHUB_PAT is set
func (c *Client) IsConfigured() bool {
	return os.Getenv("GITHUB_PAT") != ""
}
