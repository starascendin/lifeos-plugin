// App Store category detection for macOS apps
// Reads LSApplicationCategoryType from app bundles to get official categories

use lazy_static::lazy_static;
use plist::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::RwLock;

lazy_static! {
    /// In-memory cache for category lookups to avoid repeated file I/O
    static ref CATEGORY_CACHE: RwLock<HashMap<String, String>> = RwLock::new(HashMap::new());
}

/// Official App Store category UTIs mapped to display names
/// From Apple's Launch Services documentation
const CATEGORY_UTI_MAP: &[(&str, &str)] = &[
    ("public.app-category.business", "Business"),
    ("public.app-category.developer-tools", "Developer Tools"),
    ("public.app-category.education", "Education"),
    ("public.app-category.entertainment", "Entertainment"),
    ("public.app-category.finance", "Finance"),
    ("public.app-category.games", "Games"),
    ("public.app-category.graphics-design", "Graphics & Design"),
    (
        "public.app-category.healthcare-fitness",
        "Healthcare & Fitness",
    ),
    ("public.app-category.lifestyle", "Lifestyle"),
    ("public.app-category.medical", "Medical"),
    ("public.app-category.music", "Music"),
    ("public.app-category.news", "News"),
    ("public.app-category.photography", "Photography"),
    ("public.app-category.productivity", "Productivity"),
    ("public.app-category.reference", "Reference"),
    ("public.app-category.social-networking", "Social Networking"),
    ("public.app-category.sports", "Sports"),
    ("public.app-category.travel", "Travel"),
    ("public.app-category.utilities", "Utilities"),
    ("public.app-category.video", "Video"),
    ("public.app-category.weather", "Weather"),
    // Game subcategories all map to Games
    ("public.app-category.action-games", "Games"),
    ("public.app-category.adventure-games", "Games"),
    ("public.app-category.arcade-games", "Games"),
    ("public.app-category.board-games", "Games"),
    ("public.app-category.card-games", "Games"),
    ("public.app-category.casino-games", "Games"),
    ("public.app-category.dice-games", "Games"),
    ("public.app-category.educational-games", "Games"),
    ("public.app-category.family-games", "Games"),
    ("public.app-category.kids-games", "Games"),
    ("public.app-category.music-games", "Games"),
    ("public.app-category.puzzle-games", "Games"),
    ("public.app-category.racing-games", "Games"),
    ("public.app-category.role-playing-games", "Games"),
    ("public.app-category.simulation-games", "Games"),
    ("public.app-category.sports-games", "Games"),
    ("public.app-category.strategy-games", "Games"),
    ("public.app-category.trivia-games", "Games"),
    ("public.app-category.word-games", "Games"),
];

/// Manual overrides for apps that don't have LSApplicationCategoryType
/// or where we want a specific categorization
const MANUAL_CATEGORY_MAP: &[(&str, &str)] = &[
    // Browsers -> Productivity (as Apple categorizes Safari)
    ("com.apple.Safari", "Productivity"),
    ("com.google.Chrome", "Productivity"),
    ("org.mozilla.firefox", "Productivity"),
    ("com.brave.Browser", "Productivity"),
    ("com.microsoft.edgemac", "Productivity"),
    ("company.thebrowser.Browser", "Productivity"), // Arc
    // Development tools
    ("com.todesktop.230313mzl4w4u92", "Developer Tools"), // Cursor
    ("dev.warp.Warp-Stable", "Developer Tools"),
    ("com.googlecode.iterm2", "Developer Tools"),
    ("com.apple.Terminal", "Developer Tools"),
    ("io.alacritty", "Developer Tools"),
    ("com.github.wez.wezterm", "Developer Tools"),
    ("net.kovidgoyal.kitty", "Developer Tools"),
    ("com.sublimetext.4", "Developer Tools"),
    ("com.sublimetext.3", "Developer Tools"),
    ("com.visualstudio.code.oss", "Developer Tools"),
    ("com.microsoft.VSCodeInsiders", "Developer Tools"),
    ("com.docker.docker", "Developer Tools"),
    ("com.postmanlabs.mac", "Developer Tools"),
    ("com.insomnia.app", "Developer Tools"),
    ("com.tinyapp.TablePlus", "Developer Tools"),
    ("com.sequel-pro.sequel-pro", "Developer Tools"),
    ("com.github.GitHubClient", "Developer Tools"),
    ("com.sourcetreeapp.SourceTree", "Developer Tools"),
    ("com.todesktop.230313mzl4w4u92", "Developer Tools"), // Cursor
    ("abnerworks.Typora", "Developer Tools"),
    // AI assistants -> Productivity
    ("com.anthropic.claudefordesktop", "Productivity"),
    ("com.openai.chat", "Productivity"),
    // Communication/Social apps
    ("com.slack.Slack", "Social Networking"),
    ("com.tinyspeck.slackmacgap", "Social Networking"),
    ("com.hnc.Discord", "Social Networking"),
    ("us.zoom.xos", "Social Networking"),
    ("com.microsoft.teams", "Social Networking"),
    ("com.microsoft.teams2", "Social Networking"),
    ("com.apple.FaceTime", "Social Networking"),
    ("com.apple.MobileSMS", "Social Networking"),
    ("net.whatsapp.WhatsApp", "Social Networking"),
    ("com.facebook.Messenger", "Social Networking"),
    ("org.telegram.desktop", "Social Networking"),
    ("com.skype.skype", "Social Networking"),
    // Productivity apps
    ("com.apple.Notes", "Productivity"),
    ("com.apple.reminders", "Productivity"),
    ("com.apple.iCal", "Productivity"),
    ("notion.id", "Productivity"),
    ("md.obsidian", "Productivity"),
    ("com.culturedcode.ThingsMac", "Productivity"),
    ("com.culturedcode.ThingsMac3", "Productivity"),
    ("com.todoist.mac.Todoist", "Productivity"),
    ("com.linear", "Productivity"),
    ("com.linear.Linear", "Productivity"),
    ("com.agiletortoise.Drafts-OSX", "Productivity"),
    ("com.reederapp.5.macOS", "Productivity"),
    ("com.apple.iWork.Pages", "Productivity"),
    ("com.apple.iWork.Numbers", "Productivity"),
    ("com.apple.iWork.Keynote", "Productivity"),
    ("com.microsoft.Word", "Productivity"),
    ("com.microsoft.Excel", "Productivity"),
    ("com.microsoft.Powerpoint", "Productivity"),
    // Email
    ("com.apple.mail", "Productivity"),
    ("com.microsoft.Outlook", "Productivity"),
    ("com.google.Gmail", "Productivity"),
    ("com.readdle.smartemail-Mac", "Productivity"), // Spark
    ("com.mimestream.Mimestream", "Productivity"),
    // Entertainment
    ("com.spotify.client", "Music"),
    ("com.apple.Music", "Music"),
    ("com.apple.TV", "Entertainment"),
    ("com.netflix.Netflix", "Entertainment"),
    ("com.apple.podcasts", "Entertainment"),
    ("tv.plex.player", "Entertainment"),
    ("com.amazon.aiv.AIVApp", "Entertainment"), // Prime Video
    ("com.disneystreaming.disneyplus", "Entertainment"),
    ("com.hbo.hbonow", "Entertainment"),
    // System utilities
    ("com.apple.finder", "Utilities"),
    ("com.apple.systempreferences", "Utilities"),
    ("com.apple.SystemPreferences", "Utilities"),
    ("com.apple.ActivityMonitor", "Utilities"),
    ("com.apple.Preview", "Utilities"),
    ("com.apple.TextEdit", "Utilities"),
    ("com.apple.AppStore", "Utilities"),
    ("com.apple.ScreenSharing", "Utilities"),
    ("com.raycast.macos", "Utilities"),
    ("com.alfredapp.Alfred", "Utilities"),
    ("com.1password.1password", "Utilities"),
    ("com.agilebits.onepassword7", "Utilities"),
    ("com.lastpass.LastPass", "Utilities"),
    ("com.bitwarden.desktop", "Utilities"),
    ("com.apple.KeyboardSetupAssistant", "Utilities"),
    // Graphics & Design
    ("com.figma.Desktop", "Graphics & Design"),
    ("com.bohemiancoding.sketch3", "Graphics & Design"),
    ("com.adobe.Photoshop", "Graphics & Design"),
    ("com.adobe.Illustrator", "Graphics & Design"),
    ("com.adobe.InDesign", "Graphics & Design"),
    ("com.adobe.PremierePro", "Graphics & Design"),
    ("com.adobe.AfterEffects", "Graphics & Design"),
    ("com.pixelmatorteam.pixelmator", "Graphics & Design"),
    ("com.pixelmatorteam.pixelmator.x", "Graphics & Design"),
    ("com.affinity.designer", "Graphics & Design"),
    ("com.affinity.photo", "Graphics & Design"),
    ("com.affinity.publisher", "Graphics & Design"),
    // Finance
    ("com.apple.stocks", "Finance"),
    ("com.personalcapital.pcMacBanking", "Finance"),
    ("com.mint.macMint", "Finance"),
];

/// Bundle ID patterns for fallback categorization
/// These use prefix/contains matching for broader coverage
const PATTERN_CATEGORY_MAP: &[(&str, &str)] = &[
    // JetBrains IDEs
    ("com.jetbrains", "Developer Tools"),
    // Adobe Creative apps
    ("com.adobe", "Graphics & Design"),
    // Apple developer tools
    ("com.apple.dt.", "Developer Tools"),
    // Apple system
    ("com.apple.preference", "Utilities"),
];

/// Get the app bundle path from bundle ID using mdfind (Spotlight)
/// This is more reliable than trying to use objc bindings
fn get_app_bundle_path(bundle_id: &str) -> Option<PathBuf> {
    // Use mdfind to search Spotlight for app bundles
    let output = Command::new("mdfind")
        .args([
            &format!("kMDItemCFBundleIdentifier == '{}'", bundle_id),
            "-onlyin",
            "/Applications",
        ])
        .output()
        .ok()?;

    if output.status.success() {
        let path_str = String::from_utf8_lossy(&output.stdout);
        let first_path = path_str.lines().next()?;
        if !first_path.is_empty() {
            return Some(PathBuf::from(first_path));
        }
    }

    // Try system applications
    let output = Command::new("mdfind")
        .args([
            &format!("kMDItemCFBundleIdentifier == '{}'", bundle_id),
            "-onlyin",
            "/System/Applications",
        ])
        .output()
        .ok()?;

    if output.status.success() {
        let path_str = String::from_utf8_lossy(&output.stdout);
        let first_path = path_str.lines().next()?;
        if !first_path.is_empty() {
            return Some(PathBuf::from(first_path));
        }
    }

    // Try user Applications folder
    if let Some(home) = dirs::home_dir() {
        let output = Command::new("mdfind")
            .args([
                &format!("kMDItemCFBundleIdentifier == '{}'", bundle_id),
                "-onlyin",
                &home.join("Applications").to_string_lossy(),
            ])
            .output()
            .ok()?;

        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout);
            let first_path = path_str.lines().next()?;
            if !first_path.is_empty() {
                return Some(PathBuf::from(first_path));
            }
        }
    }

    None
}

/// Read LSApplicationCategoryType from an app's Info.plist
fn read_category_from_plist(app_path: &Path) -> Option<String> {
    let plist_path = app_path.join("Contents").join("Info.plist");

    if !plist_path.exists() {
        return None;
    }

    let plist_value = Value::from_file(&plist_path).ok()?;
    let dict = plist_value.as_dictionary()?;
    let category_uti = dict.get("LSApplicationCategoryType")?.as_string()?;

    // Convert UTI to display name
    for (uti, display_name) in CATEGORY_UTI_MAP {
        if category_uti == *uti {
            return Some(display_name.to_string());
        }
    }

    // If UTI doesn't match our known list, try to extract a readable name
    // e.g., "public.app-category.developer-tools" -> "Developer Tools"
    if category_uti.starts_with("public.app-category.") {
        let raw_category = category_uti.strip_prefix("public.app-category.")?;
        let formatted = raw_category
            .split('-')
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => first.to_uppercase().chain(chars).collect(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ");
        return Some(formatted);
    }

    None
}

/// Check manual override map for exact bundle ID match
fn get_manual_category(bundle_id: &str) -> Option<String> {
    for (id, category) in MANUAL_CATEGORY_MAP {
        if bundle_id == *id {
            return Some(category.to_string());
        }
    }
    None
}

/// Check pattern-based categorization using prefix/contains matching
fn get_pattern_category(bundle_id: &str) -> Option<String> {
    for (pattern, category) in PATTERN_CATEGORY_MAP {
        if bundle_id.starts_with(pattern) || bundle_id.contains(pattern) {
            return Some(category.to_string());
        }
    }
    None
}

/// Main entry point: Get category for a bundle ID
/// Uses a fallback chain: Cache -> Manual -> Info.plist -> Pattern -> "Uncategorized"
pub fn get_app_category(bundle_id: &str) -> String {
    // 1. Check cache first
    {
        if let Ok(cache) = CATEGORY_CACHE.read() {
            if let Some(category) = cache.get(bundle_id) {
                return category.clone();
            }
        }
    }

    // 2. Try manual override first (most accurate for known apps)
    let category = get_manual_category(bundle_id)
        // 3. Try to get from Info.plist
        .or_else(|| {
            get_app_bundle_path(bundle_id).and_then(|app_path| read_category_from_plist(&app_path))
        })
        // 4. Try pattern matching
        .or_else(|| get_pattern_category(bundle_id))
        // 5. Default to Uncategorized
        .unwrap_or_else(|| "Uncategorized".to_string());

    // Cache the result
    {
        if let Ok(mut cache) = CATEGORY_CACHE.write() {
            cache.insert(bundle_id.to_string(), category.clone());
        }
    }

    category
}

/// Clear the category cache (useful after migration or for testing)
pub fn clear_category_cache() {
    if let Ok(mut cache) = CATEGORY_CACHE.write() {
        cache.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manual_category_lookup() {
        assert_eq!(
            get_manual_category("com.apple.Safari"),
            Some("Productivity".to_string())
        );
        assert_eq!(
            get_manual_category("com.todesktop.230313mzl4w4u92"),
            Some("Developer Tools".to_string())
        );
        assert_eq!(get_manual_category("unknown.app"), None);
    }

    #[test]
    fn test_pattern_category_lookup() {
        assert_eq!(
            get_pattern_category("com.jetbrains.intellij"),
            Some("Developer Tools".to_string())
        );
        assert_eq!(
            get_pattern_category("com.adobe.Photoshop"),
            Some("Graphics & Design".to_string())
        );
        assert_eq!(get_pattern_category("unknown.app"), None);
    }

    #[test]
    fn test_get_app_category() {
        // Known manual mappings
        assert_eq!(get_app_category("com.apple.Safari"), "Productivity");
        assert_eq!(get_app_category("com.slack.Slack"), "Social Networking");

        // Pattern-based
        assert_eq!(get_app_category("com.jetbrains.pycharm"), "Developer Tools");

        // Unknown should be Uncategorized
        // Note: This might return something else if the app is installed and has a plist
    }
}
