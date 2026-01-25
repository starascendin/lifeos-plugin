terraform {
  required_providers {
    coder = {
      source = "coder/coder"
    }
    kubernetes = {
      source = "hashicorp/kubernetes"
    }
  }
}

provider "coder" {}
provider "kubernetes" {}

data "coder_workspace" "me" {}
data "coder_workspace_owner" "me" {}

resource "coder_agent" "main" {
  os   = "linux"
  arch = "amd64"
  dir  = "/home/coder"

  startup_script = <<-EOT
    #!/bin/bash
    set -e

    # Install Claude Code CLI
    if ! command -v claude &> /dev/null && [ ! -f ~/.local/bin/claude ]; then
      curl -fsSL https://claude.ai/install.sh -o /tmp/install.sh
      bash /tmp/install.sh
      rm /tmp/install.sh
    fi

    # Add to PATH
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

    # Link shared credentials
    mkdir -p ~/.claude
    if [ -f /home/coder/.claude-shared/.credentials.json ]; then
      ln -sf /home/coder/.claude-shared/.credentials.json ~/.claude/.credentials.json
    fi

    echo "Ready! Run 'source ~/.bashrc && claude -p \"hello\"' to test."
  EOT
}

resource "kubernetes_pod" "main" {
  count = data.coder_workspace.me.start_count

  metadata {
    name      = "coder-${lower(data.coder_workspace_owner.me.name)}-${lower(data.coder_workspace.me.name)}"
    namespace = "coder"
    labels = {
      "app.kubernetes.io/name"     = "coder-workspace"
      "app.kubernetes.io/instance" = "coder-workspace-${lower(data.coder_workspace_owner.me.name)}-${lower(data.coder_workspace.me.name)}"
    }
  }

  spec {
    container {
      name              = "dev"
      image             = "codercom/enterprise-base:ubuntu"
      image_pull_policy = "Always"
      command           = ["sh", "-c", coder_agent.main.init_script]

      env {
        name  = "CODER_AGENT_TOKEN"
        value = coder_agent.main.token
      }

      resources {
        requests = {
          cpu    = "500m"
          memory = "1Gi"
        }
        limits = {
          cpu    = "2"
          memory = "4Gi"
        }
      }

      # Shared Claude credentials (read/write) - all workspaces share this
      volume_mount {
        name       = "claude-shared"
        mount_path = "/home/coder/.claude-shared"
      }

      # Home directory
      volume_mount {
        name       = "home"
        mount_path = "/home/coder"
        sub_path   = data.coder_workspace.me.name
      }
    }

    volume {
      name = "claude-shared"
      persistent_volume_claim {
        claim_name = "claude-credentials"
      }
    }

    volume {
      name = "home"
      empty_dir {}
    }
  }
}
