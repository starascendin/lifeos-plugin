use serde::{Deserialize, Serialize};
use yt_transcript_rs::YouTubeTranscriptApi;

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub start: f64,
    pub duration: f64,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptResult {
    pub language: String,
    pub is_auto_generated: bool,
    pub transcript: String,
    pub segments: Vec<TranscriptSegment>,
}

#[tauri::command]
pub async fn fetch_youtube_transcript(video_id: String) -> Result<TranscriptResult, String> {
    // Create API client
    let api = YouTubeTranscriptApi::new(None, None, None)
        .map_err(|e| format!("Failed to create YouTube API client: {}", e))?;

    // Try to fetch English transcript first, then fall back to any available
    let languages = vec!["en", "en-US", "en-GB"];

    let transcript = match api.fetch_transcript(&video_id, &languages, false).await {
        Ok(t) => t,
        Err(_) => {
            // Try without language preference
            api.fetch_transcript(&video_id, &[], false)
                .await
                .map_err(|e| format!("Failed to fetch transcript: {}", e))?
        }
    };

    // Convert to our format
    let segments: Vec<TranscriptSegment> = transcript
        .parts()
        .iter()
        .map(|part| TranscriptSegment {
            start: part.start,
            duration: part.duration,
            text: part.text.clone(),
        })
        .collect();

    let full_text = segments.iter().map(|s| s.text.as_str()).collect::<Vec<_>>().join(" ");

    // Determine language from the transcript
    let language = transcript.language().to_string();
    let is_auto_generated = transcript.is_generated();

    Ok(TranscriptResult {
        language,
        is_auto_generated,
        transcript: full_text,
        segments,
    })
}
