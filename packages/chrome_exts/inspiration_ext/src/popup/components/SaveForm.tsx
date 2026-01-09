import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@holaai/convex/_generated/api";
import { Id } from "@holaai/convex/_generated/dataModel";

interface TabInfo {
  url: string;
  title: string;
  favicon: string;
}

export function SaveForm() {
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<Id<"ext_insp_tags">[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = useQuery(api.inspiration.tags.listTags);
  const saveInspiration = useMutation(api.inspiration.items.saveInspiration);
  const createTag = useMutation(api.inspiration.tags.createTag);
  const checkUrlExists = useQuery(
    api.inspiration.items.checkUrlExists,
    tabInfo?.url ? { url: tabInfo.url } : "skip"
  );

  // Get current tab info
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.url && tab.title) {
        setTabInfo({
          url: tab.url,
          title: tab.title,
          favicon: tab.favIconUrl || "",
        });
      }
    });
  }, []);

  const handleSave = async () => {
    if (!tabInfo) return;

    setSaving(true);
    setError(null);

    try {
      await saveInspiration({
        url: tabInfo.url,
        title: tabInfo.title,
        notes: notes || undefined,
        favicon: tabInfo.favicon || undefined,
        tagIds: selectedTags.length > 0 ? selectedTags : undefined,
      });
      setSaved(true);
      setNotes("");
      setSelectedTags([]);
    } catch (err) {
      console.error("Failed to save:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const tagId = await createTag({ name: newTagName.trim() });
      setSelectedTags([...selectedTags, tagId]);
      setNewTagName("");
    } catch (err) {
      console.error("Failed to create tag:", err);
    }
  };

  const toggleTag = (tagId: Id<"ext_insp_tags">) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((id) => id !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Saved!</h3>
        <button
          onClick={() => setSaved(false)}
          className="text-blue-600 text-sm hover:underline"
        >
          Save another
        </button>
      </div>
    );
  }

  if (!tabInfo) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const alreadyExists = checkUrlExists?.exists;

  return (
    <div className="space-y-4">
      {/* Page info */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex items-start gap-3">
          {tabInfo.favicon && (
            <img
              src={tabInfo.favicon}
              alt=""
              className="w-6 h-6 rounded flex-shrink-0 mt-0.5"
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-gray-900 text-sm truncate">
              {tabInfo.title}
            </h3>
            <p className="text-xs text-gray-500 truncate">{tabInfo.url}</p>
          </div>
        </div>
      </div>

      {alreadyExists && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-yellow-800 text-sm">
            This page is already saved in your inspirations.
          </p>
        </div>
      )}

      {/* Notes */}
      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Notes (optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why is this inspiring?"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags?.map((tag) => (
            <button
              key={tag._id}
              onClick={() => toggleTag(tag._id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedTags.includes(tag._id)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              style={
                tag.color && selectedTags.includes(tag._id)
                  ? { backgroundColor: tag.color }
                  : undefined
              }
            >
              {tag.name}
            </button>
          ))}
        </div>

        {/* Create new tag */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="New tag name"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateTag();
              }
            }}
          />
          <button
            onClick={handleCreateTag}
            disabled={!newTagName.trim()}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || alreadyExists}
        className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving..." : "Save Inspiration"}
      </button>
    </div>
  );
}
