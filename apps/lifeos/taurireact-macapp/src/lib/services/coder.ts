/**
 * Coder Agent Service
 *
 * Provides integration with Coder CLI for delegating issues to AI agents.
 * Only available in Tauri desktop app (requires local CLI authentication).
 */

import { invoke } from "@tauri-apps/api/core";

// Check if running in Tauri environment
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/** Represents a Coder template */
export interface CoderTemplate {
  name: string;
  display_name: string;
}

/** Represents a Coder workspace preset */
export interface CoderPreset {
  name: string;
  template: string;
}

/** Result of delegating to a Coder agent */
export interface DelegateResult {
  success: boolean;
  task_id?: string;
  error?: string;
}

/**
 * Check if Coder delegation is available
 * Only available in Tauri desktop app
 */
export function isCoderAvailable(): boolean {
  return isTauri;
}

/**
 * Get list of available Coder templates
 */
export async function getCoderTemplates(): Promise<CoderTemplate[]> {
  if (!isTauri) {
    console.warn("Coder templates only available in Tauri app");
    return [];
  }

  try {
    return await invoke<CoderTemplate[]>("get_coder_templates");
  } catch (error) {
    console.error("Failed to get Coder templates:", error);
    throw error;
  }
}

/**
 * Get list of available presets for a template
 */
export async function getCoderPresets(template: string): Promise<CoderPreset[]> {
  if (!isTauri) {
    console.warn("Coder presets only available in Tauri app");
    return [];
  }

  try {
    return await invoke<CoderPreset[]>("get_coder_presets", { template });
  } catch (error) {
    console.error("Failed to get Coder presets:", error);
    throw error;
  }
}

/** Parameters for delegating an issue to Coder */
export interface DelegateToCoderParams {
  template: string;
  preset: string;
  issueIdentifier: string;
  issueTitle: string;
  issueDescription?: string;
  issueStatus: string;
  issuePriority: string;
}

/**
 * Delegate an issue to a Coder agent
 */
export async function delegateToCoder(
  params: DelegateToCoderParams
): Promise<DelegateResult> {
  if (!isTauri) {
    return {
      success: false,
      error: "Coder delegation only available in Tauri desktop app",
    };
  }

  try {
    return await invoke<DelegateResult>("delegate_to_coder", {
      template: params.template,
      preset: params.preset,
      issue_identifier: params.issueIdentifier,
      issue_title: params.issueTitle,
      issue_description: params.issueDescription,
      issue_status: params.issueStatus,
      issue_priority: params.issuePriority,
    });
  } catch (error) {
    console.error("Failed to delegate to Coder:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
