// LiveKit token generation for Voice Agent

use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Video grant for LiveKit token
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoGrant {
    room_join: bool,
    room: String,
    can_publish: bool,
    can_subscribe: bool,
    can_update_own_metadata: bool,
}

/// LiveKit JWT claims
#[derive(Debug, Serialize, Deserialize)]
struct LiveKitClaims {
    exp: usize,        // Expiration time
    iss: String,       // API Key (issuer)
    nbf: usize,        // Not before
    sub: String,       // Participant identity (subject)
    name: String,      // Participant display name
    video: VideoGrant, // Video grants
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<String>,
}

/// Response from token generation
#[derive(Debug, Serialize, Deserialize)]
pub struct LiveKitTokenResponse {
    pub server_url: String,
    pub token: String,
    pub room_name: String,
    pub participant_identity: String,
}

/// LiveKit configuration
#[derive(Debug, Serialize, Deserialize)]
pub struct LiveKitConfig {
    pub server_url: String,
    pub is_configured: bool,
}

/// Generate a LiveKit access token
#[tauri::command]
pub async fn generate_livekit_token(
    room_name: String,
    participant_identity: Option<String>,
    participant_name: Option<String>,
) -> Result<LiveKitTokenResponse, String> {
    // Get environment variables
    let api_key = env::var("LIVEKIT_API_KEY")
        .map_err(|_| "LIVEKIT_API_KEY not set in environment".to_string())?;
    let api_secret = env::var("LIVEKIT_API_SECRET")
        .map_err(|_| "LIVEKIT_API_SECRET not set in environment".to_string())?;
    let server_url =
        env::var("LIVEKIT_URL").map_err(|_| "LIVEKIT_URL not set in environment".to_string())?;

    // Generate participant identity if not provided
    let identity = participant_identity
        .unwrap_or_else(|| format!("user-{}", &Uuid::new_v4().to_string()[..8]));

    // Use identity as name if not provided
    let name = participant_name.unwrap_or_else(|| identity.clone());

    // Calculate timestamps
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Time error: {}", e))?
        .as_secs() as usize;

    let expiration = now + (10 * 60); // 10 minutes from now

    // Create claims
    let claims = LiveKitClaims {
        exp: expiration,
        iss: api_key.clone(),
        nbf: now,
        sub: identity.clone(),
        name: name.clone(),
        video: VideoGrant {
            room_join: true,
            room: room_name.clone(),
            can_publish: true,
            can_subscribe: true,
            can_update_own_metadata: true,
        },
        metadata: None,
    };

    // Create JWT header
    let header = Header::new(Algorithm::HS256);

    // Encode the token
    let encoding_key = EncodingKey::from_secret(api_secret.as_bytes());
    let token = encode(&header, &claims, &encoding_key)
        .map_err(|e| format!("Failed to generate token: {}", e))?;

    Ok(LiveKitTokenResponse {
        server_url,
        token,
        room_name,
        participant_identity: identity,
    })
}

/// Get LiveKit configuration (server URL and status)
#[tauri::command]
pub fn get_livekit_config() -> Result<LiveKitConfig, String> {
    let server_url = env::var("LIVEKIT_URL").unwrap_or_default();
    let api_key = env::var("LIVEKIT_API_KEY").unwrap_or_default();
    let api_secret = env::var("LIVEKIT_API_SECRET").unwrap_or_default();

    let is_configured = !server_url.is_empty() && !api_key.is_empty() && !api_secret.is_empty();

    Ok(LiveKitConfig {
        server_url: if is_configured {
            server_url
        } else {
            String::new()
        },
        is_configured,
    })
}
