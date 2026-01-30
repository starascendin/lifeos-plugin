package k8s

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"github.com/starascendin/claude-agent-farm/controlplane/internal/models"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
)

const (
	agentNamespace = "claude-agents"
	agentImage     = "ghcr.io/starascendin/hola-monorepo-agent:latest"
	credentialsPVC = "claude-credentials"
	agentPATH      = "/home/node/.opencode/bin:/home/node/.local/bin:/tools:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
)

// getRuntimeClassName returns the runtime class from env var, or empty string to use default
func getRuntimeClassName() string {
	return os.Getenv("AGENT_RUNTIME_CLASS")
}

// getConfigID returns the config ID to use in pod labels (prefers ConvexID over numeric ID)
func getConfigID(config *models.AgentConfig) string {
	if config.ConvexID != "" {
		return config.ConvexID
	}
	return fmt.Sprintf("%d", config.ID)
}

// waitForPodDeletion waits for a pod to be fully deleted (up to timeout)
func (c *Client) waitForPodDeletion(podName string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for pod %s to be deleted", podName)
		case <-ticker.C:
			_, err := c.clientset.CoreV1().Pods(agentNamespace).Get(context.Background(), podName, metav1.GetOptions{})
			if err != nil {
				// Pod is gone
				return nil
			}
		}
	}
}

// getCredentialVolumeMounts returns the volume mounts for Claude and OpenCode credentials
func getCredentialVolumeMounts() []corev1.VolumeMount {
	return []corev1.VolumeMount{
		{
			Name:      "claude-credentials",
			MountPath: "/home/node/.claude",
			SubPath:   ".claude",
		},
		{
			Name:      "claude-credentials",
			MountPath: "/home/node/.local/share/opencode",
			SubPath:   ".opencode-data",
		},
		{
			Name:      "claude-credentials",
			MountPath: "/home/node/.config/opencode",
			SubPath:   ".opencode-config",
		},
	}
}

type Client struct {
	clientset  *kubernetes.Clientset
	restConfig *rest.Config
}

func NewClient() (*Client, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get in-cluster config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %w", err)
	}

	return &Client{clientset: clientset, restConfig: config}, nil
}

// IsPodRunning checks if a specific pod exists and is running
func (c *Client) IsPodRunning(podName string) (bool, error) {
	pod, err := c.clientset.CoreV1().Pods(agentNamespace).Get(context.Background(), podName, metav1.GetOptions{})
	if err != nil {
		return false, err
	}
	return pod.Status.Phase == corev1.PodRunning, nil
}

// ListRunningAgents returns all agent pods
func (c *Client) ListRunningAgents() ([]models.RunningAgent, error) {
	// List ALL pods in the namespace (no label filter)
	pods, err := c.clientset.CoreV1().Pods(agentNamespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}

	var agents []models.RunningAgent
	for _, pod := range pods.Items {
		runtimeClass := ""
		if pod.Spec.RuntimeClassName != nil {
			runtimeClass = *pod.Spec.RuntimeClassName
		}

		var taskPrompt string
		for _, env := range pod.Spec.Containers[0].Env {
			if env.Name == "TASK_PROMPT" {
				taskPrompt = env.Value
				break
			}
		}

		// Determine pod type and persistence
		podType := "job"
		persistent := false
		if pod.Labels["app"] == "claude-chat" {
			podType = "chat"
			persistent = true
		} else if pod.Labels["persistent"] == "true" {
			podType = "agent"
			persistent = true
		} else if pod.Labels["app"] == "claude-agent" {
			podType = "agent"
		}

		// Check if command is "sleep infinity" (persistent)
		if len(pod.Spec.Containers) > 0 && len(pod.Spec.Containers[0].Command) >= 2 {
			if pod.Spec.Containers[0].Command[0] == "sleep" {
				persistent = true
			}
		}

		// Get config ID from label (now supports both Convex string IDs and legacy numeric IDs)
		configID := pod.Labels["config-id"]

		agent := models.RunningAgent{
			PodName:      pod.Name,
			PodType:      podType,
			Persistent:   persistent,
			ConfigID:     configID,
			ConfigName:   pod.Labels["config-name"],
			TaskPrompt:   taskPrompt,
			Status:       string(pod.Status.Phase),
			StartedAt:    pod.CreationTimestamp.Time,
			Node:         pod.Spec.NodeName,
			RuntimeClass: runtimeClass,
		}

		// Use agent-name label if config-name not set
		if agent.ConfigName == "" {
			agent.ConfigName = pod.Labels["agent-name"]
		}
		// Fallback to pod name
		if agent.ConfigName == "" {
			agent.ConfigName = pod.Name
		}

		agents = append(agents, agent)
	}

	return agents, nil
}

// StopAgent deletes an agent pod
func (c *Client) StopAgent(podName string) error {
	return c.clientset.CoreV1().Pods(agentNamespace).Delete(context.Background(), podName, metav1.DeleteOptions{})
}

// StreamLogs streams logs from a pod
func (c *Client) StreamLogs(ctx context.Context, podName string, logChan chan<- string) error {
	req := c.clientset.CoreV1().Pods(agentNamespace).GetLogs(podName, &corev1.PodLogOptions{
		Follow:     true,
		Timestamps: true,
	})

	stream, err := req.Stream(ctx)
	if err != nil {
		return fmt.Errorf("failed to open log stream: %w", err)
	}
	defer stream.Close()

	reader := bufio.NewReader(stream)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		select {
		case logChan <- line:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// GetLogs returns logs from a pod (non-streaming)
func (c *Client) GetLogs(podName string, tailLines int64) (string, error) {
	req := c.clientset.CoreV1().Pods(agentNamespace).GetLogs(podName, &corev1.PodLogOptions{
		TailLines:  &tailLines,
		Timestamps: true,
	})

	logs, err := req.Do(context.Background()).Raw()
	if err != nil {
		return "", err
	}
	return string(logs), nil
}

// ExecStreamWriter wraps an io.Writer to send output to a channel
type ExecStreamWriter struct {
	OutputChan chan<- string
}

func (w *ExecStreamWriter) Write(p []byte) (n int, err error) {
	w.OutputChan <- string(p)
	return len(p), nil
}

// ExecCommand executes a command in a pod and streams output to the channel
func (c *Client) ExecCommand(ctx context.Context, podName string, command []string, outputChan chan<- string) error {
	req := c.clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(agentNamespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Command:   command,
			Container: "agent",
			Stdout:    true,
			Stderr:    true,
			Stdin:     false,
			TTY:       false,
		}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(c.restConfig, "POST", req.URL())
	if err != nil {
		return fmt.Errorf("failed to create executor: %w", err)
	}

	streamWriter := &ExecStreamWriter{OutputChan: outputChan}

	err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdout: streamWriter,
		Stderr: streamWriter,
	})
	if err != nil {
		return fmt.Errorf("exec failed: %w", err)
	}

	return nil
}

// GetOrCreateChatPod ensures a chat pod exists and is running, returns pod name
func (c *Client) GetOrCreateChatPod() (string, error) {
	podName := "claude-chat-pod"

	// Check if pod exists
	pod, err := c.clientset.CoreV1().Pods(agentNamespace).Get(context.Background(), podName, metav1.GetOptions{})
	if err == nil {
		// Pod exists, check if running
		if pod.Status.Phase == corev1.PodRunning {
			return podName, nil
		}
		// Pod exists but not running, delete and recreate
		_ = c.clientset.CoreV1().Pods(agentNamespace).Delete(context.Background(), podName, metav1.DeleteOptions{})
		time.Sleep(2 * time.Second)
	}

	// Create chat pod
	chatPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      podName,
			Namespace: agentNamespace,
			Labels: map[string]string{
				"app": "claude-chat",
			},
		},
		Spec: corev1.PodSpec{
			RestartPolicy: corev1.RestartPolicyNever,
			Containers: []corev1.Container{
				{
					Name:    "agent",
					Image:           agentImage,
					ImagePullPolicy: corev1.PullAlways,
					Command:         []string{"sleep", "infinity"},
					Env: func() []corev1.EnvVar {
						envs := []corev1.EnvVar{
							{Name: "HOME", Value: "/home/node"},
							{Name: "PATH", Value: agentPATH},
						}
						// LifeOS CLI env vars
						if v := os.Getenv("LIFEOS_CONVEX_URL"); v != "" {
							envs = append(envs, corev1.EnvVar{Name: "CONVEX_URL", Value: v})
						}
						if v := os.Getenv("LIFEOS_USER_ID"); v != "" {
							envs = append(envs, corev1.EnvVar{Name: "LIFEOS_USER_ID", Value: v})
						}
						if v := os.Getenv("LIFEOS_API_KEY"); v != "" {
							envs = append(envs, corev1.EnvVar{Name: "LIFEOS_API_KEY", Value: v})
						}
						return envs
					}(),
					VolumeMounts: append(getCredentialVolumeMounts(), corev1.VolumeMount{
						Name:      "mcp-config",
						MountPath: "/home/node/.mcp.json",
						SubPath:   "mcp.json",
					}),
				},
			},
			Volumes: []corev1.Volume{
				{
					Name: "claude-credentials",
					VolumeSource: corev1.VolumeSource{
						PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
							ClaimName: credentialsPVC,
						},
					},
				},
				{
					Name: "mcp-config",
					VolumeSource: corev1.VolumeSource{
						Secret: &corev1.SecretVolumeSource{
							SecretName: "mcp-config",
							Optional:   boolPtr(true),
						},
					},
				},
			},
			ImagePullSecrets: []corev1.LocalObjectReference{
				{Name: "ghcr-credentials"},
			},
		},
	}

	_, err = c.clientset.CoreV1().Pods(agentNamespace).Create(context.Background(), chatPod, metav1.CreateOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to create chat pod: %w", err)
	}

	// Wait for pod to be running
	for i := 0; i < 60; i++ {
		pod, err := c.clientset.CoreV1().Pods(agentNamespace).Get(context.Background(), podName, metav1.GetOptions{})
		if err == nil && pod.Status.Phase == corev1.PodRunning {
			return podName, nil
		}
		time.Sleep(time.Second)
	}

	return "", fmt.Errorf("timeout waiting for chat pod to start")
}

func boolPtr(b bool) *bool {
	return &b
}

// GetOrCreateCouncilPod ensures a council pod exists and is running, returns pod name
func (c *Client) GetOrCreateCouncilPod() (string, error) {
	podName := "claude-council-pod"

	// Check if pod exists
	pod, err := c.clientset.CoreV1().Pods(agentNamespace).Get(context.Background(), podName, metav1.GetOptions{})
	if err == nil {
		// Pod exists, check if running
		if pod.Status.Phase == corev1.PodRunning {
			return podName, nil
		}
		// Pod exists but not running (Failed, Succeeded, Pending, or Terminating), delete and wait
		_ = c.clientset.CoreV1().Pods(agentNamespace).Delete(context.Background(), podName, metav1.DeleteOptions{})
		if err := c.waitForPodDeletion(podName, 30*time.Second); err != nil {
			// Force delete if normal delete times out
			gracePeriod := int64(0)
			_ = c.clientset.CoreV1().Pods(agentNamespace).Delete(context.Background(), podName, metav1.DeleteOptions{
				GracePeriodSeconds: &gracePeriod,
			})
			// Wait a bit more after force delete
			_ = c.waitForPodDeletion(podName, 10*time.Second)
		}
	}

	// Create council pod
	councilPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      podName,
			Namespace: agentNamespace,
			Labels: map[string]string{
				"app": "claude-council",
			},
		},
		Spec: corev1.PodSpec{
			RestartPolicy: corev1.RestartPolicyNever,
			Containers: []corev1.Container{
				{
					Name:    "agent",
					Image:           agentImage,
					ImagePullPolicy: corev1.PullAlways,
					Command:         []string{"sleep", "infinity"},
					Env: func() []corev1.EnvVar {
						envs := []corev1.EnvVar{
							{Name: "HOME", Value: "/home/node"},
							{Name: "PATH", Value: agentPATH},
						}
						// LifeOS CLI env vars
						if v := os.Getenv("LIFEOS_CONVEX_URL"); v != "" {
							envs = append(envs, corev1.EnvVar{Name: "CONVEX_URL", Value: v})
						}
						if v := os.Getenv("LIFEOS_USER_ID"); v != "" {
							envs = append(envs, corev1.EnvVar{Name: "LIFEOS_USER_ID", Value: v})
						}
						if v := os.Getenv("LIFEOS_API_KEY"); v != "" {
							envs = append(envs, corev1.EnvVar{Name: "LIFEOS_API_KEY", Value: v})
						}
						return envs
					}(),
					VolumeMounts: append(getCredentialVolumeMounts(), corev1.VolumeMount{
						Name:      "mcp-config",
						MountPath: "/home/node/.mcp.json",
						SubPath:   "mcp.json",
					}),
				},
			},
			Volumes: []corev1.Volume{
				{
					Name: "claude-credentials",
					VolumeSource: corev1.VolumeSource{
						PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
							ClaimName: credentialsPVC,
						},
					},
				},
				{
					Name: "mcp-config",
					VolumeSource: corev1.VolumeSource{
						Secret: &corev1.SecretVolumeSource{
							SecretName: "mcp-config",
							Optional:   boolPtr(true),
						},
					},
				},
			},
			ImagePullSecrets: []corev1.LocalObjectReference{
				{Name: "ghcr-credentials"},
			},
		},
	}

	_, err = c.clientset.CoreV1().Pods(agentNamespace).Create(context.Background(), councilPod, metav1.CreateOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to create council pod: %w", err)
	}

	// Wait for pod to be running
	for i := 0; i < 60; i++ {
		pod, err := c.clientset.CoreV1().Pods(agentNamespace).Get(context.Background(), podName, metav1.GetOptions{})
		if err == nil && pod.Status.Phase == corev1.PodRunning {
			return podName, nil
		}
		time.Sleep(time.Second)
	}

	return "", fmt.Errorf("timeout waiting for council pod to start")
}

// computeConfigSignature creates a hash of the config parameters that affect pod behavior
// This is used to detect when a pod needs to be recreated due to config changes
func computeConfigSignature(config *models.AgentConfig, mcpJSON []byte, skillInstallCommands []string) string {
	// Build a string of all config values that matter for the pod
	sigParts := []string{
		fmt.Sprintf("mcps=%s", config.EnabledMCPs),
		fmt.Sprintf("skills=%s", config.EnabledSkills),
		fmt.Sprintf("system=%s", config.SystemPrompt),
		fmt.Sprintf("maxturns=%d", config.MaxTurns),
		fmt.Sprintf("tools=%s", config.AllowedTools),
		fmt.Sprintf("cpu=%s", config.CPULimit),
		fmt.Sprintf("mem=%s", config.MemoryLimit),
		fmt.Sprintf("mcpjson_len=%d", len(mcpJSON)),
		fmt.Sprintf("skillcmds=%d", len(skillInstallCommands)),
	}
	sigString := strings.Join(sigParts, ";")

	// Hash it to keep the annotation value short
	hash := sha256.Sum256([]byte(sigString))
	return hex.EncodeToString(hash[:8]) // First 8 bytes = 16 hex chars
}

// GetOrCreateAgentPod ensures a persistent agent pod exists and is running for the given config
// mcpJSON and skillInstallCommands are optional - if provided, they configure the pod's MCP servers and skills
func (c *Client) GetOrCreateAgentPod(config *models.AgentConfig, mcpJSON []byte, skillInstallCommands []string) (string, error) {
	podName := fmt.Sprintf("agent-%s-pod", config.Name)

	// Compute config signature to detect config changes
	configSignature := computeConfigSignature(config, mcpJSON, skillInstallCommands)
	log.Printf("[GetOrCreateAgentPod] Pod %s: computed config signature=%s", podName, configSignature)

	// Check if pod exists
	pod, err := c.clientset.CoreV1().Pods(agentNamespace).Get(context.Background(), podName, metav1.GetOptions{})
	if err == nil {
		// Pod exists, check if running
		if pod.Status.Phase == corev1.PodRunning {
			// Check if config has changed by comparing signatures
			existingSignature := ""
			if pod.Annotations != nil {
				existingSignature = pod.Annotations["claude-agent/config-signature"]
			}
			log.Printf("[GetOrCreateAgentPod] Pod %s exists and running: existingSignature=%s, newSignature=%s",
				podName, existingSignature, configSignature)

			if existingSignature == configSignature {
				// Same config, reuse the pod
				log.Printf("[GetOrCreateAgentPod] Pod %s: config unchanged, reusing existing pod", podName)
				return podName, nil
			}

			// Config changed! Delete and recreate
			log.Printf("[GetOrCreateAgentPod] Pod %s: config changed, deleting and recreating pod", podName)
		}

		// Pod exists but not running OR config changed - delete and wait
		_ = c.clientset.CoreV1().Pods(agentNamespace).Delete(context.Background(), podName, metav1.DeleteOptions{})
		// Also clean up any existing MCP ConfigMap for this pod
		_ = c.DeleteMCPConfigMap(podName)
		if err := c.waitForPodDeletion(podName, 30*time.Second); err != nil {
			// Force delete if normal delete times out
			gracePeriod := int64(0)
			_ = c.clientset.CoreV1().Pods(agentNamespace).Delete(context.Background(), podName, metav1.DeleteOptions{
				GracePeriodSeconds: &gracePeriod,
			})
			_ = c.waitForPodDeletion(podName, 10*time.Second)
		}
	}

	// Create MCP ConfigMap if MCP JSON is provided
	hasMCP := len(mcpJSON) > 0 && string(mcpJSON) != "{\"mcpServers\":{}}"
	if hasMCP {
		if err := c.CreateMCPConfigMap(podName, mcpJSON); err != nil {
			return "", fmt.Errorf("failed to create MCP ConfigMap: %w", err)
		}
	}

	// Build env vars
	envVars := []corev1.EnvVar{
		{Name: "HOME", Value: "/home/node"},
		{Name: "PATH", Value: agentPATH},
		{Name: "AGENT_NAME", Value: config.Name},
		{Name: "SYSTEM_PROMPT", Value: config.SystemPrompt},
		{Name: "MAX_TURNS", Value: fmt.Sprintf("%d", config.MaxTurns)},
		{Name: "ALLOWED_TOOLS", Value: config.AllowedTools},
	}

	// Add GitHub PAT if available
	envVars = append(envVars, corev1.EnvVar{
		Name: "GITHUB_PAT",
		ValueFrom: &corev1.EnvVarSource{
			SecretKeyRef: &corev1.SecretKeySelector{
				LocalObjectReference: corev1.LocalObjectReference{Name: "github-credentials"},
				Key:                  "GITHUB_PAT",
				Optional:             boolPtr(true),
			},
		},
	})

	// LifeOS CLI env vars
	if v := os.Getenv("LIFEOS_CONVEX_URL"); v != "" {
		envVars = append(envVars, corev1.EnvVar{Name: "CONVEX_URL", Value: v})
	}
	if v := os.Getenv("LIFEOS_USER_ID"); v != "" {
		envVars = append(envVars, corev1.EnvVar{Name: "LIFEOS_USER_ID", Value: v})
	}
	if v := os.Getenv("LIFEOS_API_KEY"); v != "" {
		envVars = append(envVars, corev1.EnvVar{Name: "LIFEOS_API_KEY", Value: v})
	}

	// Add skill install commands (newline-separated shell commands to run)
	if len(skillInstallCommands) > 0 {
		envVars = append(envVars, corev1.EnvVar{
			Name:  "SKILL_INSTALL_COMMANDS",
			Value: strings.Join(skillInstallCommands, "\n"),
		})
	}

	// Build volume mounts - start with credential mounts
	volumeMounts := getCredentialVolumeMounts()

	// Build volumes
	volumes := []corev1.Volume{
		{
			Name: "claude-credentials",
			VolumeSource: corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
					ClaimName: credentialsPVC,
					ReadOnly:  false,
				},
			},
		},
	}

	// Only add MCP volume mount when MCPs are configured
	if hasMCP {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "mcp-config",
			MountPath: "/home/node/.mcp.json",
			SubPath:   "mcp.json",
		})
		configMapName := fmt.Sprintf("mcp-%s", podName)
		volumes = append(volumes, corev1.Volume{
			Name: "mcp-config",
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: configMapName,
					},
				},
			},
		})
	}

	// Create agent pod with sleep infinity (persistent)
	agentPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      podName,
			Namespace: agentNamespace,
			Labels: map[string]string{
				"app":        "claude-agent",
				"agent-name": config.Name,
				"config-id":  getConfigID(config),
				"persistent": "true",
				"has-mcp":    fmt.Sprintf("%t", hasMCP),
			},
			Annotations: map[string]string{
				"claude-agent/config-signature": configSignature,
			},
		},
		Spec: corev1.PodSpec{
			RestartPolicy: corev1.RestartPolicyNever,
			Containers: []corev1.Container{
				{
					Name:    "agent",
					Image:           agentImage,
					ImagePullPolicy: corev1.PullAlways,
					Command:         []string{"/bin/bash", "-c"},
					Args: []string{`
if [ -n "${SKILL_INSTALL_COMMANDS:-}" ]; then
    echo "Installing Claude skills..."
    while IFS= read -r cmd; do
        if [ -n "$cmd" ]; then
            echo "Running: $cmd"
            eval "$cmd" || echo "Warning: skill installation failed: $cmd"
        fi
    done <<< "$SKILL_INSTALL_COMMANDS"
    echo "Skills installation complete."
fi
exec sleep infinity
`},
					Env: envVars,
					Resources: corev1.ResourceRequirements{
						Limits: corev1.ResourceList{
							corev1.ResourceCPU:    resource.MustParse(config.CPULimit),
							corev1.ResourceMemory: resource.MustParse(config.MemoryLimit),
						},
						Requests: corev1.ResourceList{
							corev1.ResourceCPU:    resource.MustParse("500m"),
							corev1.ResourceMemory: resource.MustParse("1Gi"),
						},
					},
					VolumeMounts: volumeMounts,
				},
			},
			Volumes: volumes,
			ImagePullSecrets: []corev1.LocalObjectReference{
				{Name: "ghcr-credentials"},
			},
		},
	}

	// Set runtime class if configured
	if runtimeClass := getRuntimeClassName(); runtimeClass != "" {
		agentPod.Spec.RuntimeClassName = &runtimeClass
	}

	_, err = c.clientset.CoreV1().Pods(agentNamespace).Create(context.Background(), agentPod, metav1.CreateOptions{})
	if err != nil {
		// Clean up ConfigMap if pod creation failed
		if hasMCP {
			_ = c.DeleteMCPConfigMap(podName)
		}
		return "", fmt.Errorf("failed to create agent pod: %w", err)
	}

	// Wait for pod to be running
	for i := 0; i < 60; i++ {
		pod, err := c.clientset.CoreV1().Pods(agentNamespace).Get(context.Background(), podName, metav1.GetOptions{})
		if err == nil && pod.Status.Phase == corev1.PodRunning {
			return podName, nil
		}
		time.Sleep(time.Second)
	}

	return "", fmt.Errorf("timeout waiting for agent pod to start")
}

// CreateMCPConfigMap creates a ConfigMap with MCP configuration for a pod
func (c *Client) CreateMCPConfigMap(podName string, mcpJSON []byte) error {
	configMapName := fmt.Sprintf("mcp-%s", podName)

	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      configMapName,
			Namespace: agentNamespace,
			Labels: map[string]string{
				"app":      "claude-agent",
				"mcp-for":  podName,
			},
		},
		Data: map[string]string{
			"mcp.json": string(mcpJSON),
		},
	}

	_, err := c.clientset.CoreV1().ConfigMaps(agentNamespace).Create(context.Background(), configMap, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create MCP ConfigMap: %w", err)
	}

	return nil
}

// DeleteMCPConfigMap deletes the MCP ConfigMap for a pod
func (c *Client) DeleteMCPConfigMap(podName string) error {
	configMapName := fmt.Sprintf("mcp-%s", podName)
	return c.clientset.CoreV1().ConfigMaps(agentNamespace).Delete(context.Background(), configMapName, metav1.DeleteOptions{})
}

// StopAgentWithCleanup deletes an agent pod and its MCP ConfigMap
func (c *Client) StopAgentWithCleanup(podName string) error {
	// Try to delete MCP ConfigMap (ignore errors if it doesn't exist)
	_ = c.DeleteMCPConfigMap(podName)

	// Delete the pod
	return c.clientset.CoreV1().Pods(agentNamespace).Delete(context.Background(), podName, metav1.DeleteOptions{})
}

// ExecCommandWithOutput executes a command in a pod and returns the full output (not streamed)
func (c *Client) ExecCommandWithOutput(ctx context.Context, podName string, command []string) (string, error) {
	req := c.clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(agentNamespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Command:   command,
			Container: "agent",
			Stdout:    true,
			Stderr:    true,
			Stdin:     false,
			TTY:       false,
		}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(c.restConfig, "POST", req.URL())
	if err != nil {
		return "", fmt.Errorf("failed to create executor: %w", err)
	}

	var stdout, stderr strings.Builder
	err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
	})
	if err != nil {
		return "", fmt.Errorf("exec failed: %w (stderr: %s)", err, stderr.String())
	}

	// Combine stdout and stderr, prioritizing stdout
	output := stdout.String()
	if output == "" && stderr.String() != "" {
		output = stderr.String()
	}

	return output, nil
}

// ExecCommandWithStdin executes a command in a pod with stdin input and returns the output
// This is useful for passing large prompts that would exceed command-line argument limits
func (c *Client) ExecCommandWithStdin(ctx context.Context, podName string, command []string, stdin string) (string, error) {
	req := c.clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(agentNamespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Command:   command,
			Container: "agent",
			Stdout:    true,
			Stderr:    true,
			Stdin:     true,
			TTY:       false,
		}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(c.restConfig, "POST", req.URL())
	if err != nil {
		return "", fmt.Errorf("failed to create executor: %w", err)
	}

	var stdout, stderr strings.Builder
	stdinReader := strings.NewReader(stdin)
	err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:  stdinReader,
		Stdout: &stdout,
		Stderr: &stderr,
	})
	if err != nil {
		return "", fmt.Errorf("exec failed: %w (stderr: %s)", err, stderr.String())
	}

	// Combine stdout and stderr, prioritizing stdout
	output := stdout.String()
	if output == "" && stderr.String() != "" {
		output = stderr.String()
	}

	return output, nil
}

// ExecInPod executes a command in a running pod
func (c *Client) ExecInPod(podName, namespace string, command []string) error {
	req := c.clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: "agent",
			Command:   command,
			Stdin:     false,
			Stdout:    true,
			Stderr:    true,
			TTY:       false,
		}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(c.restConfig, "POST", req.URL())
	if err != nil {
		return fmt.Errorf("failed to create executor: %w", err)
	}

	err = exec.StreamWithContext(context.Background(), remotecommand.StreamOptions{
		Stdout: io.Discard,
		Stderr: io.Discard,
	})
	if err != nil {
		return fmt.Errorf("failed to execute command: %w", err)
	}

	return nil
}
