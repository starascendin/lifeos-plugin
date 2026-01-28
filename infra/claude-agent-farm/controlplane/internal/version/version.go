package version

// Version information - set via ldflags at build time
var (
	// Version is the semantic version (e.g., "1.0.0")
	Version = "dev"
	// BuildTime is the build timestamp
	BuildTime = "unknown"
)
