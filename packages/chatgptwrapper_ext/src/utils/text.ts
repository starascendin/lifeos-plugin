// Strip citation markers from ChatGPT responses
const CITATION_REGEX = /[\ue200-\ue299](cite|entity|turn\d+|search\d+|news\d+)*/gi;

export function stripCitations(text: string): string {
  return text.replace(CITATION_REGEX, '');
}

// Strip antArtifact tags from Claude responses
export function stripArtifactTags(text: string): string {
  return text
    .replace(/<antArtifact[^>]*>/gi, '```')
    .replace(/<\/antArtifact>/gi, '```');
}
