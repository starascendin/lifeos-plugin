package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/api"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/github"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/k8s"
	"github.com/starascendin/claude-agent-farm/controlplane/internal/storage"
)

//go:embed all:dist
var frontendFS embed.FS

func main() {
	// Initialize storage
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "/data/controlplane.db"
	}

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	// Initialize Kubernetes client
	k8sClient, err := k8s.NewClient()
	if err != nil {
		log.Printf("Warning: Failed to initialize K8s client: %v", err)
		log.Printf("Running in local mode without K8s integration")
		k8sClient = nil
	}

	// Initialize GitHub client
	githubClient := github.NewClient()
	if githubClient.IsConfigured() {
		log.Printf("GitHub integration enabled (GITHUB_PAT configured)")
	} else {
		log.Printf("GitHub integration disabled (GITHUB_PAT not set)")
	}

	// Initialize API
	apiHandler := api.NewAPI(store, k8sClient, githubClient)

	// Initialize Echo
	e := echo.New()
	e.HideBanner = true

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept},
	}))

	// API Routes
	apiGroup := e.Group("/api")
	{
		// Configs
		apiGroup.GET("/configs", apiHandler.ListConfigs)
		apiGroup.GET("/configs/:id", apiHandler.GetConfig)
		apiGroup.POST("/configs", apiHandler.CreateConfig)
		apiGroup.PUT("/configs/:id", apiHandler.UpdateConfig)
		apiGroup.DELETE("/configs/:id", apiHandler.DeleteConfig)

		// Agents
		apiGroup.GET("/agents", apiHandler.ListAgents)
		apiGroup.POST("/agents/launch/:id", apiHandler.LaunchAgent)
		apiGroup.DELETE("/agents/:name", apiHandler.StopAgent)
		apiGroup.GET("/agents/:name/logs", apiHandler.GetAgentLogs)
		apiGroup.GET("/agents/:name/logs/stream", apiHandler.StreamAgentLogs)
		apiGroup.POST("/agents/cleanup", apiHandler.CleanupPods)

		// Chat
		apiGroup.GET("/chat/send", apiHandler.ChatSend)

		// MCP Servers
		apiGroup.GET("/mcp/servers", apiHandler.ListMCPServers)
		apiGroup.POST("/mcp/import-toml", apiHandler.ImportTOML)
		apiGroup.POST("/mcp/import-json", apiHandler.ImportJSON)
		apiGroup.GET("/mcp/export-toml", apiHandler.ExportTOML)
		apiGroup.POST("/mcp/convert-json", apiHandler.ConvertJSONToTOML)
		apiGroup.DELETE("/mcp/servers/:name", apiHandler.DeleteMCPServer)
		apiGroup.GET("/mcp/presets", apiHandler.GetMCPPresets)

		// MCP TOML Configs (saved configurations)
		apiGroup.GET("/mcp/configs", apiHandler.ListTomlConfigs)
		apiGroup.GET("/mcp/configs/:name", apiHandler.GetTomlConfig)
		apiGroup.POST("/mcp/configs", apiHandler.CreateTomlConfig)
		apiGroup.PUT("/mcp/configs/:name", apiHandler.UpdateTomlConfig)
		apiGroup.DELETE("/mcp/configs/:name", apiHandler.DeleteTomlConfig)
		apiGroup.POST("/mcp/configs/:name/toggle", apiHandler.ToggleTomlConfig)
		apiGroup.GET("/mcp/active-servers", apiHandler.GetActiveServers)
		apiGroup.POST("/mcp/clear-cache", apiHandler.ClearMCPCache)

		// GitHub
		apiGroup.GET("/github/repos", apiHandler.ListGitHubRepos)

		// Health
		apiGroup.GET("/health", func(c echo.Context) error {
			return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
		})
	}

	// Legacy health endpoint for k8s probes
	e.GET("/health", func(c echo.Context) error {
		return c.String(http.StatusOK, "OK")
	})

	// Serve static files from embedded frontend
	distFS, err := fs.Sub(frontendFS, "dist")
	if err != nil {
		log.Fatalf("Failed to get dist subdirectory: %v", err)
	}

	// Serve static files and handle SPA routing
	e.GET("/*", func(c echo.Context) error {
		path := c.Request().URL.Path

		// Skip API routes (already handled)
		if strings.HasPrefix(path, "/api/") {
			return echo.ErrNotFound
		}

		// Try to serve static file
		filePath := strings.TrimPrefix(path, "/")
		if filePath == "" {
			filePath = "index.html"
		}

		file, err := distFS.Open(filePath)
		if err != nil {
			// File doesn't exist - serve index.html for SPA routing
			file, err = distFS.Open("index.html")
			if err != nil {
				return echo.ErrNotFound
			}
			defer file.Close()

			stat, err := file.Stat()
			if err != nil {
				return echo.ErrInternalServerError
			}

			return c.Stream(http.StatusOK, "text/html", &fileReader{file: file, stat: stat})
		}
		defer file.Close()

		stat, err := file.Stat()
		if err != nil {
			return echo.ErrInternalServerError
		}

		// Determine content type from extension
		contentType := getContentType(filePath)
		return c.Stream(http.StatusOK, contentType, &fileReader{file: file, stat: stat})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting Claude Agent Control Plane on :%s", port)
	log.Printf("API available at /api/*")
	log.Printf("Frontend served from embedded dist/")
	e.Logger.Fatal(e.Start(":" + port))
}

// fileReader wraps fs.File to implement io.Reader for c.Stream
type fileReader struct {
	file fs.File
	stat fs.FileInfo
}

func (f *fileReader) Read(p []byte) (n int, err error) {
	return f.file.Read(p)
}

// getContentType returns the proper MIME type based on file extension
func getContentType(path string) string {
	switch {
	case strings.HasSuffix(path, ".js"):
		return "text/javascript"
	case strings.HasSuffix(path, ".mjs"):
		return "text/javascript"
	case strings.HasSuffix(path, ".css"):
		return "text/css"
	case strings.HasSuffix(path, ".html"):
		return "text/html"
	case strings.HasSuffix(path, ".json"):
		return "application/json"
	case strings.HasSuffix(path, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(path, ".png"):
		return "image/png"
	case strings.HasSuffix(path, ".jpg"), strings.HasSuffix(path, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(path, ".gif"):
		return "image/gif"
	case strings.HasSuffix(path, ".webp"):
		return "image/webp"
	case strings.HasSuffix(path, ".ico"):
		return "image/x-icon"
	case strings.HasSuffix(path, ".woff"):
		return "font/woff"
	case strings.HasSuffix(path, ".woff2"):
		return "font/woff2"
	case strings.HasSuffix(path, ".ttf"):
		return "font/ttf"
	case strings.HasSuffix(path, ".eot"):
		return "application/vnd.ms-fontobject"
	case strings.HasSuffix(path, ".wasm"):
		return "application/wasm"
	default:
		return "application/octet-stream"
	}
}
