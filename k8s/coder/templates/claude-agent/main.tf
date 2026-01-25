terraform {
  required_providers {
    coder = {
      source  = "coder/coder"
      version = ">= 2.13"
    }
    kubernetes = {
      source = "hashicorp/kubernetes"
    }
  }
}

provider "kubernetes" {}

# GitHub token - set via TF_VAR_github_token environment variable on Coder server
variable "github_token" {
  type        = string
  description = "GitHub Personal Access Token for pushing branches and creating PRs"
  default     = ""
  sensitive   = true
}

resource "coder_ai_task" "task" {
  count  = data.coder_workspace.me.start_count
  app_id = module.claude-code[count.index].task_app_id
}

data "coder_task" "me" {}

module "claude-code" {
  count               = data.coder_workspace.me.start_count
  source              = "registry.coder.com/coder/claude-code/coder"
  version             = "4.2.1"
  agent_id            = coder_agent.main.id
  workdir             = "/home/coder/projects/${local.repo_name}"
  order               = 999
  ai_prompt           = data.coder_task.me.prompt
  system_prompt       = data.coder_parameter.system_prompt.value
  model               = data.coder_parameter.claude_model.value
  permission_mode     = "plan"
  post_install_script = data.coder_parameter.setup_script.value
}

# Workspace presets for quick repo selection
data "coder_workspace_preset" "hola_monorepo" {
  name    = "hola-monorepo"
  default = true
  parameters = {
    "github_repo"     = "https://github.com/starascendin/hola-monorepo.git"
    "custom_repo"     = ""
    "repo_branch"     = ""
    "github_token"    = var.github_token
    "system_prompt"   = <<-EOT
      -- Framing --
      You are a helpful assistant that can help with code. You are running inside a Coder Workspace and provide status updates to the user via Coder MCP. Stay on track, feel free to debug, but when the original plan fails, do not choose a different route/architecture without checking the user first.

      -- CRITICAL: Branch Protection Rules --
      NEVER develop directly on main branches (dev, staging, main). These are protected.
      NEVER merge your changes back to main branches directly.
      ALWAYS use git worktrees for all development work.

      -- Workflow: Always Start with Worktrunk --
      Before starting ANY coding task, you MUST:
      1. Navigate to the project repo directory (you are working in a cloned git repo)
      2. Use /worktrunk skill OR run: wt switch -c <descriptive-branch-name>
         - Derive a descriptive branch name from the task (e.g., "add-user-auth", "fix-login-bug")
      3. This creates an isolated worktree - do ALL your work there
      4. When done: push the branch and create a PR (NEVER merge directly)

      -- Tool Selection --
      - worktrunk (wt): ALWAYS use FIRST before any coding
      - git/gh: For pushing branches and creating PRs (use gh pr create)
      - playwright: preview changes after making them
      - desktop-commander: long-running commands only (servers, watchers)
      - Built-in tools: everything else

      -- Context --
      Read CLAUDE.md in the project root if it exists to learn more about the codebase.
    EOT
    "setup_script"    = <<-EOT
    mkdir -p /home/coder/projects
    cd $HOME/projects

    # Restore Claude credentials from shared NFS volume
    restore_claude_auth() {
      mkdir -p "$HOME/.claude"
      if [ -f /home/coder/.claude-shared/.credentials.json ]; then
        ln -sf /home/coder/.claude-shared/.credentials.json "$HOME/.claude/.credentials.json"
        echo "Linked Claude credentials from shared volume"
      fi
      if [ -f /home/coder/.claude-shared/.claude.json ]; then
        ln -sf /home/coder/.claude-shared/.claude.json "$HOME/.claude.json"
      fi
    }
    restore_claude_auth

    # MCP: Configure MCP Servers
    setup_mcp_servers() {
      local TASK_WORKDIR="/home/coder/projects/hola-monorepo"
      mkdir -p "$TASK_WORKDIR"
      cd "$TASK_WORKDIR"

      if [ -f "$HOME/.claude.json" ] && jq -e ".projects[\"$TASK_WORKDIR\"].mcpServers.playwright" "$HOME/.claude.json" >/dev/null 2>&1; then
        echo "MCP servers already configured for $TASK_WORKDIR"
      else
        echo "Adding MCP servers to $TASK_WORKDIR..."
        claude mcp add playwright -- npx @playwright/mcp@latest --headless --isolated --no-sandbox || true
        claude mcp add desktop-commander -- desktop-commander || true
        echo "MCP servers added"
      fi
      cd - >/dev/null
    }
    setup_mcp_servers
    EOT
    "preview_port"    = "3000"
    "claude_model"    = "opus"
  }
}

data "coder_workspace_preset" "mindworks_kortex" {
  name = "mindworks-kortex-monorepo"
  parameters = {
    "github_repo"     = "https://github.com/starascendin/mindworks-kortex-monorepo.git"
    "custom_repo"     = ""
    "repo_branch"     = ""
    "github_token"    = var.github_token
    "system_prompt"   = <<-EOT
      -- Framing --
      You are a helpful assistant that can help with code. You are running inside a Coder Workspace. Stay on track, feel free to debug, but when the original plan fails, do not choose a different route/architecture without checking the user first.

      -- CRITICAL: Branch Protection Rules --
      NEVER develop directly on main branches (dev, staging, main). These are protected.
      ALWAYS use git worktrees for all development work.

      -- Workflow: Always Start with Worktrunk --
      Before starting ANY coding task, you MUST:
      1. Navigate to the project repo directory
      2. Run: wt switch -c <descriptive-branch-name>
      3. Do ALL your work in the worktree
      4. When done: push the branch and create a PR (NEVER merge directly)

      -- Context --
      Read CLAUDE.md in the project root if it exists.
    EOT
    "setup_script"    = <<-EOT
    mkdir -p /home/coder/projects
    cd $HOME/projects

    restore_claude_auth() {
      mkdir -p "$HOME/.claude"
      if [ -f /home/coder/.claude-shared/.credentials.json ]; then
        ln -sf /home/coder/.claude-shared/.credentials.json "$HOME/.claude/.credentials.json"
      fi
      if [ -f /home/coder/.claude-shared/.claude.json ]; then
        ln -sf /home/coder/.claude-shared/.claude.json "$HOME/.claude.json"
      fi
    }
    restore_claude_auth

    setup_mcp_servers() {
      local TASK_WORKDIR="/home/coder/projects/mindworks-kortex-monorepo"
      mkdir -p "$TASK_WORKDIR"
      cd "$TASK_WORKDIR"
      if ! jq -e ".projects[\"$TASK_WORKDIR\"].mcpServers.playwright" "$HOME/.claude.json" >/dev/null 2>&1; then
        claude mcp add playwright -- npx @playwright/mcp@latest --headless --isolated --no-sandbox || true
        claude mcp add desktop-commander -- desktop-commander || true
      fi
      cd - >/dev/null
    }
    setup_mcp_servers
    EOT
    "preview_port"    = "3000"
    "claude_model"    = "opus"
  }
}

# GitHub repository selection
data "coder_parameter" "github_repo" {
  name         = "github_repo"
  display_name = "GitHub Repository"
  type         = "string"
  description  = "Select a repository from your favorites"
  mutable      = false
  default      = "https://github.com/starascendin/hola-monorepo.git"

  option {
    name  = "hola-monorepo"
    value = "https://github.com/starascendin/hola-monorepo.git"
  }
  option {
    name  = "mindworks-kortex-monorepo"
    value = "https://github.com/starascendin/mindworks-kortex-monorepo.git"
  }
  option {
    name  = "Custom (use field below)"
    value = "custom"
  }
}

data "coder_parameter" "custom_repo" {
  name         = "custom_repo"
  display_name = "Custom Repository URL"
  type         = "string"
  description  = "Enter a custom Git URL (SSH or HTTPS). Only used when 'Custom' is selected above."
  mutable      = false
  default      = ""
}

data "coder_parameter" "github_token" {
  name         = "github_token"
  display_name = "GitHub Token (Secret)"
  type         = "string"
  description  = "GitHub Personal Access Token for pushing branches and creating PRs."
  mutable      = true
  default      = ""
}

data "coder_parameter" "repo_branch" {
  name         = "repo_branch"
  display_name = "Branch"
  type         = "string"
  description  = "Branch to checkout (leave empty for default branch)"
  mutable      = false
  default      = ""
}

data "coder_parameter" "system_prompt" {
  name         = "system_prompt"
  display_name = "System Prompt"
  type         = "string"
  form_type    = "textarea"
  description  = "System prompt for the agent"
  mutable      = false
}

data "coder_parameter" "setup_script" {
  name         = "setup_script"
  display_name = "Setup Script"
  type         = "string"
  form_type    = "textarea"
  description  = "Script to run before running the agent"
  mutable      = false
}

data "coder_parameter" "preview_port" {
  name         = "preview_port"
  display_name = "Preview Port"
  description  = "The port the web app is running to preview"
  type         = "number"
  default      = "3000"
  mutable      = false
}

data "coder_parameter" "claude_model" {
  name         = "claude_model"
  display_name = "Claude Model"
  description  = "Which Claude model to use"
  type         = "string"
  default      = "opus"
  mutable      = false

  option {
    name  = "Opus (Recommended)"
    value = "opus"
  }
  option {
    name  = "Sonnet"
    value = "sonnet"
  }
}

data "coder_provisioner" "me" {}
data "coder_workspace" "me" {}
data "coder_workspace_owner" "me" {}

locals {
  repo_url    = data.coder_parameter.github_repo.value == "custom" ? data.coder_parameter.custom_repo.value : data.coder_parameter.github_repo.value
  repo_name   = replace(basename(local.repo_url), ".git", "")
  branch_flag = data.coder_parameter.repo_branch.value != "" ? "-b ${data.coder_parameter.repo_branch.value}" : ""
}

resource "coder_agent" "main" {
  arch           = "amd64"
  os             = "linux"
  startup_script = <<-EOT
    # Prepare user home
    if [ ! -f ~/.init_done ]; then
      cp -rT /etc/skel ~ 2>/dev/null || true
      touch ~/.init_done
    fi

    # Link Claude credentials from shared NFS volume
    mkdir -p "$HOME/.claude"
    if [ -f /home/coder/.claude-shared/.credentials.json ]; then
      ln -sf /home/coder/.claude-shared/.credentials.json "$HOME/.claude/.credentials.json"
      echo "Linked Claude credentials"
    fi
    if [ -f /home/coder/.claude-shared/.claude.json ]; then
      ln -sf /home/coder/.claude-shared/.claude.json "$HOME/.claude.json"
    fi

    # Add GitHub's SSH host key
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
    ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null

    # Setup git credential helper for GitHub token
    if [ -n "$GITHUB_TOKEN" ]; then
      git config --global credential.helper 'store'
      echo "https://x-access-token:$GITHUB_TOKEN@github.com" > ~/.git-credentials
      chmod 600 ~/.git-credentials
      echo "Configured git credentials from GITHUB_TOKEN"
    fi

    # Clone the selected repository
    mkdir -p /home/coder/projects
    cd /home/coder/projects

    REPO_URL="${local.repo_url}"
    REPO_NAME="${local.repo_name}"
    BRANCH_FLAG="${local.branch_flag}"

    if [ -n "$REPO_URL" ] && [ "$REPO_URL" != "custom" ]; then
      if [ ! -d "$REPO_NAME/.git" ]; then
        echo "Cloning $REPO_URL..."
        rm -rf "$REPO_NAME" 2>/dev/null || true
        git clone $BRANCH_FLAG "$REPO_URL" "$REPO_NAME" || echo "Failed to clone repo - check GITHUB_TOKEN"
      else
        echo "Repository $REPO_NAME already exists"
        cd "$REPO_NAME"
        git fetch
        if git diff-index --quiet HEAD -- 2>/dev/null; then
          git pull || true
        fi
      fi
    fi
  EOT

  # Note: GH_TOKEN and GITHUB_TOKEN are set in the pod spec from the github-credentials secret
  # Do NOT set them here or they will override the secret values with empty strings
  env = {
    GIT_AUTHOR_NAME     = coalesce(data.coder_workspace_owner.me.full_name, data.coder_workspace_owner.me.name)
    GIT_AUTHOR_EMAIL    = data.coder_workspace_owner.me.email
    GIT_COMMITTER_NAME  = coalesce(data.coder_workspace_owner.me.full_name, data.coder_workspace_owner.me.name)
    GIT_COMMITTER_EMAIL = data.coder_workspace_owner.me.email
  }

  metadata {
    display_name = "CPU Usage"
    key          = "0_cpu_usage"
    script       = "coder stat cpu"
    interval     = 10
    timeout      = 1
  }

  metadata {
    display_name = "RAM Usage"
    key          = "1_ram_usage"
    script       = "coder stat mem"
    interval     = 10
    timeout      = 1
  }

  metadata {
    display_name = "Home Disk"
    key          = "3_home_disk"
    script       = "coder stat disk --path $${HOME}"
    interval     = 60
    timeout      = 1
  }
}

module "code-server" {
  count    = data.coder_workspace.me.start_count
  folder   = "/home/coder/projects"
  source   = "registry.coder.com/coder/code-server/coder"
  version  = "~> 1.0"
  agent_id = coder_agent.main.id
  order    = 1

  settings = {
    "workbench.colorTheme" : "Default Dark Modern"
  }
}

resource "coder_app" "preview" {
  agent_id     = coder_agent.main.id
  slug         = "preview"
  display_name = "Preview"
  icon         = "${data.coder_workspace.me.access_url}/emojis/1f50e.png"
  url          = "http://localhost:${data.coder_parameter.preview_port.value}"
  share        = "authenticated"
  subdomain    = true
  open_in      = "tab"
  order        = 0
}

# Kubernetes Pod
resource "kubernetes_pod" "workspace" {
  count = data.coder_workspace.me.start_count

  metadata {
    name      = "coder-${lower(data.coder_workspace_owner.me.name)}-${lower(data.coder_workspace.me.name)}"
    namespace = "coder"
    labels = {
      "app.kubernetes.io/name"     = "coder-workspace"
      "app.kubernetes.io/instance" = "coder-workspace-${lower(data.coder_workspace_owner.me.name)}-${lower(data.coder_workspace.me.name)}"
      "coder.owner"                = data.coder_workspace_owner.me.name
      "coder.workspace"            = data.coder_workspace.me.name
    }
  }

  spec {
    security_context {
      run_as_user = 1000
      fs_group    = 1000
    }

    container {
      name              = "workspace"
      image             = "ghcr.io/starascendin/coder-claude:latest"
      image_pull_policy = "Always"
      command           = ["sh", "-c", coder_agent.main.init_script]

      security_context {
        run_as_user = 1000
      }

      env {
        name  = "CODER_AGENT_TOKEN"
        value = coder_agent.main.token
      }

      # GitHub token from secret (fallback to parameter if set)
      env {
        name = "GH_TOKEN"
        value_from {
          secret_key_ref {
            name     = "github-credentials"
            key      = "GITHUB_PAT"
            optional = true
          }
        }
      }

      env {
        name = "GITHUB_TOKEN"
        value_from {
          secret_key_ref {
            name     = "github-credentials"
            key      = "GITHUB_PAT"
            optional = true
          }
        }
      }

      resources {
        requests = {
          cpu    = "500m"
          memory = "2Gi"
        }
        limits = {
          cpu    = "4"
          memory = "8Gi"
        }
      }

      # Home directory (persistent per workspace)
      volume_mount {
        name       = "home"
        mount_path = "/home/coder"
      }

      # Shared Claude credentials (NFS)
      volume_mount {
        name       = "claude-shared"
        mount_path = "/home/coder/.claude-shared"
      }
    }

    volume {
      name = "home"
      persistent_volume_claim {
        claim_name = kubernetes_persistent_volume_claim.home[count.index].metadata[0].name
      }
    }

    volume {
      name = "claude-shared"
      persistent_volume_claim {
        claim_name = "claude-credentials"
      }
    }

    image_pull_secrets {
      name = "ghcr-credentials"
    }
  }
}

# Persistent home directory per workspace
resource "kubernetes_persistent_volume_claim" "home" {
  count = data.coder_workspace.me.start_count

  metadata {
    name      = "coder-${lower(data.coder_workspace_owner.me.name)}-${lower(data.coder_workspace.me.name)}-home"
    namespace = "coder"
    labels = {
      "coder.owner"     = data.coder_workspace_owner.me.name
      "coder.workspace" = data.coder_workspace.me.name
    }
  }

  wait_until_bound = false

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "20Gi"
      }
    }
  }
}
