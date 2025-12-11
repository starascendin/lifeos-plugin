"""
YouTube Scraper using yt-dlp

Fetches playlist info, video metadata, and transcripts from YouTube.
"""

import json
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class VideoInfo:
    """Video metadata"""
    youtube_video_id: str
    title: str
    description: Optional[str]
    channel_title: Optional[str]
    duration: Optional[int]  # seconds
    thumbnail_url: Optional[str]
    published_at: Optional[str]


@dataclass
class TranscriptSegment:
    """A single transcript segment with timing"""
    start: float  # seconds
    duration: float  # seconds
    text: str


@dataclass
class Transcript:
    """Full transcript data"""
    language: str
    is_auto_generated: bool
    full_text: str
    segments: list[TranscriptSegment]


@dataclass
class PlaylistInfo:
    """Playlist metadata"""
    youtube_playlist_id: str
    title: str
    description: Optional[str]
    channel_title: Optional[str]
    video_count: int
    thumbnail_url: Optional[str]


def run_ytdlp(args: list[str]) -> dict | list | None:
    """Run yt-dlp with JSON output and return parsed result"""
    cmd = ["yt-dlp", "--dump-json", "--no-warnings"] + args

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120
        )

        if result.returncode != 0:
            print(f"yt-dlp error: {result.stderr}")
            return None

        # Handle multiple JSON objects (one per line for playlists)
        lines = result.stdout.strip().split("\n")
        if len(lines) == 1:
            return json.loads(lines[0])
        else:
            return [json.loads(line) for line in lines if line.strip()]

    except subprocess.TimeoutExpired:
        print("yt-dlp timed out")
        return None
    except json.JSONDecodeError as e:
        print(f"Failed to parse yt-dlp output: {e}")
        return None
    except FileNotFoundError:
        print("yt-dlp not found. Please install it: pip install yt-dlp")
        return None


def get_playlist_info(playlist_id: str) -> Optional[PlaylistInfo]:
    """Get playlist metadata"""
    url = f"https://www.youtube.com/playlist?list={playlist_id}"
    args = ["--flat-playlist", "--playlist-items", "0", url]

    # Use a different approach to get playlist metadata
    cmd = [
        "yt-dlp",
        "--dump-single-json",
        "--flat-playlist",
        "--no-warnings",
        url
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            print(f"Failed to get playlist info: {result.stderr}")
            return None

        data = json.loads(result.stdout)

        return PlaylistInfo(
            youtube_playlist_id=playlist_id,
            title=data.get("title", "Unknown Playlist"),
            description=data.get("description"),
            channel_title=data.get("uploader") or data.get("channel"),
            video_count=len(data.get("entries", [])),
            thumbnail_url=data.get("thumbnails", [{}])[-1].get("url") if data.get("thumbnails") else None,
        )

    except (subprocess.TimeoutExpired, json.JSONDecodeError) as e:
        print(f"Error getting playlist info: {e}")
        return None


def get_playlist_videos(playlist_id: str) -> list[VideoInfo]:
    """Get all videos in a playlist"""
    url = f"https://www.youtube.com/playlist?list={playlist_id}"

    cmd = [
        "yt-dlp",
        "--dump-single-json",
        "--flat-playlist",
        "--no-warnings",
        url
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            print(f"Failed to get playlist videos: {result.stderr}")
            return []

        data = json.loads(result.stdout)
        entries = data.get("entries", [])

        videos = []
        for entry in entries:
            if entry is None:
                continue

            video_id = entry.get("id") or entry.get("url", "").split("?v=")[-1].split("&")[0]
            if not video_id:
                continue

            videos.append(VideoInfo(
                youtube_video_id=video_id,
                title=entry.get("title", "Unknown"),
                description=entry.get("description"),
                channel_title=entry.get("uploader") or entry.get("channel"),
                duration=entry.get("duration"),
                thumbnail_url=entry.get("thumbnails", [{}])[-1].get("url") if entry.get("thumbnails") else None,
                published_at=entry.get("upload_date"),
            ))

        return videos

    except (subprocess.TimeoutExpired, json.JSONDecodeError) as e:
        print(f"Error getting playlist videos: {e}")
        return []


def get_video_info(video_id: str) -> Optional[VideoInfo]:
    """Get detailed info for a single video"""
    url = f"https://www.youtube.com/watch?v={video_id}"

    data = run_ytdlp(["--skip-download", url])
    if not data or isinstance(data, list):
        return None

    return VideoInfo(
        youtube_video_id=video_id,
        title=data.get("title", "Unknown"),
        description=data.get("description"),
        channel_title=data.get("uploader") or data.get("channel"),
        duration=data.get("duration"),
        thumbnail_url=data.get("thumbnail"),
        published_at=data.get("upload_date"),
    )


def get_transcript(video_id: str, preferred_language: str = "auto") -> Optional[Transcript]:
    """
    Download transcript/captions for a video.

    Args:
        video_id: YouTube video ID
        preferred_language: Language code (e.g., "en", "es") or "auto" for any available

    Returns:
        Transcript object or None if no transcript available
    """
    url = f"https://www.youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = Path(tmpdir) / "subtitle"

        # Build subtitle arguments
        if preferred_language == "auto":
            # Try to get any available subtitle
            sub_args = [
                "--write-subs",
                "--write-auto-subs",
                "--sub-format", "json3",
                "--skip-download",
            ]
        else:
            sub_args = [
                "--write-subs",
                "--write-auto-subs",
                "--sub-langs", preferred_language,
                "--sub-format", "json3",
                "--skip-download",
            ]

        cmd = [
            "yt-dlp",
            *sub_args,
            "-o", str(output_path),
            "--no-warnings",
            url
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

            # Find the downloaded subtitle file
            subtitle_files = list(Path(tmpdir).glob("*.json3"))
            if not subtitle_files:
                # Try .vtt format as fallback
                cmd[cmd.index("json3")] = "vtt"
                subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                subtitle_files = list(Path(tmpdir).glob("*.vtt"))

            if not subtitle_files:
                print(f"No transcript found for video {video_id}")
                return None

            subtitle_file = subtitle_files[0]
            filename = subtitle_file.name

            # Determine language and auto-generated status from filename
            # Format: subtitle.LANG.json3 or subtitle.LANG.vtt
            parts = filename.split(".")
            language = parts[-2] if len(parts) >= 3 else "unknown"
            is_auto = "-auto" in filename or "auto" in language.lower()

            # Parse the subtitle file
            if subtitle_file.suffix == ".json3":
                return _parse_json3_transcript(subtitle_file, language.replace("-auto", ""), is_auto)
            else:
                return _parse_vtt_transcript(subtitle_file, language.replace("-auto", ""), is_auto)

        except subprocess.TimeoutExpired:
            print(f"Transcript download timed out for {video_id}")
            return None
        except Exception as e:
            print(f"Error getting transcript for {video_id}: {e}")
            return None


def _parse_json3_transcript(file_path: Path, language: str, is_auto: bool) -> Optional[Transcript]:
    """Parse a YouTube JSON3 format subtitle file"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        events = data.get("events", [])
        segments = []
        full_text_parts = []

        for event in events:
            # Skip events without segment data
            if "segs" not in event:
                continue

            start_ms = event.get("tStartMs", 0)
            duration_ms = event.get("dDurationMs", 0)

            # Concatenate all segment text
            text_parts = []
            for seg in event.get("segs", []):
                text = seg.get("utf8", "")
                if text and text.strip():
                    text_parts.append(text)

            if text_parts:
                text = "".join(text_parts).strip()
                if text:
                    segments.append(TranscriptSegment(
                        start=start_ms / 1000.0,
                        duration=duration_ms / 1000.0,
                        text=text
                    ))
                    full_text_parts.append(text)

        if not segments:
            return None

        return Transcript(
            language=language,
            is_auto_generated=is_auto,
            full_text=" ".join(full_text_parts),
            segments=segments
        )

    except (json.JSONDecodeError, KeyError) as e:
        print(f"Error parsing JSON3 transcript: {e}")
        return None


def _parse_vtt_transcript(file_path: Path, language: str, is_auto: bool) -> Optional[Transcript]:
    """Parse a WebVTT format subtitle file"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        lines = content.split("\n")
        segments = []
        full_text_parts = []

        i = 0
        while i < len(lines):
            line = lines[i].strip()

            # Look for timestamp lines (00:00:00.000 --> 00:00:00.000)
            if "-->" in line:
                try:
                    times = line.split("-->")
                    start = _parse_vtt_time(times[0].strip())
                    end = _parse_vtt_time(times[1].strip().split()[0])  # Remove any position info

                    # Get the text (next lines until empty line)
                    text_lines = []
                    i += 1
                    while i < len(lines) and lines[i].strip():
                        # Remove VTT formatting tags
                        text = lines[i].strip()
                        text = _strip_vtt_tags(text)
                        if text:
                            text_lines.append(text)
                        i += 1

                    if text_lines:
                        text = " ".join(text_lines)
                        segments.append(TranscriptSegment(
                            start=start,
                            duration=end - start,
                            text=text
                        ))
                        full_text_parts.append(text)

                except (ValueError, IndexError):
                    pass

            i += 1

        if not segments:
            return None

        # Remove duplicate consecutive segments (common in auto-generated captions)
        deduped_segments = []
        deduped_text_parts = []
        prev_text = ""
        for seg in segments:
            if seg.text != prev_text:
                deduped_segments.append(seg)
                deduped_text_parts.append(seg.text)
                prev_text = seg.text

        return Transcript(
            language=language,
            is_auto_generated=is_auto,
            full_text=" ".join(deduped_text_parts),
            segments=deduped_segments
        )

    except Exception as e:
        print(f"Error parsing VTT transcript: {e}")
        return None


def _parse_vtt_time(time_str: str) -> float:
    """Parse VTT timestamp to seconds"""
    parts = time_str.split(":")
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    elif len(parts) == 2:
        m, s = parts
        return int(m) * 60 + float(s)
    else:
        return float(time_str)


def _strip_vtt_tags(text: str) -> str:
    """Remove VTT formatting tags like <c>, </c>, etc."""
    import re
    # Remove all HTML-like tags
    text = re.sub(r"<[^>]+>", "", text)
    # Remove timestamps in text
    text = re.sub(r"\d{2}:\d{2}:\d{2}\.\d{3}", "", text)
    return text.strip()
