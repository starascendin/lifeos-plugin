import { useMutation, useQuery } from "convex/react";
import { api } from "@holaai/convex/_generated/api";
import { Id } from "@holaai/convex/_generated/dataModel";
import { useState } from "react";

export function InspirationList() {
  const [filterTagId, setFilterTagId] = useState<
    Id<"ext_insp_tags"> | undefined
  >(undefined);

  const inspirations = useQuery(api.inspiration.items.listInspirations, {
    tagId: filterTagId,
    limit: 20,
  });
  const tags = useQuery(api.inspiration.tags.listTags);
  const deleteInspiration = useMutation(
    api.inspiration.items.deleteInspiration
  );

  const handleDelete = async (itemId: Id<"ext_insp_items">) => {
    if (confirm("Delete this inspiration?")) {
      await deleteInspiration({ itemId });
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (inspirations === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tag filter */}
      {tags && tags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterTagId(undefined)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
              filterTagId === undefined
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag._id}
              onClick={() => setFilterTagId(tag._id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                filterTagId === tag._id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {tag.name} ({tag.usageCount})
            </button>
          ))}
        </div>
      )}

      {/* Inspirations list */}
      {inspirations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No inspirations saved yet.</p>
          <p className="text-gray-400 text-xs mt-1">
            Save your first page using the Save Page tab.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[350px] overflow-y-auto">
          {inspirations.map((item) => (
            <div
              key={item._id}
              className="bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                {item.favicon && (
                  <img
                    src={item.favicon}
                    alt=""
                    className="w-5 h-5 rounded flex-shrink-0 mt-0.5"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-900 text-sm hover:text-blue-600 line-clamp-1"
                  >
                    {item.title}
                  </a>
                  <p className="text-xs text-gray-500 truncate">{item.domain}</p>
                  {item.notes && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {item.notes}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {item.tags &&
                      item.tags.map(
                        (tag) =>
                          tag && (
                            <span
                              key={tag._id}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs"
                              style={tag.color ? { backgroundColor: `${tag.color}20`, color: tag.color } : undefined}
                            >
                              {tag.name}
                            </span>
                          )
                      )}
                    <span className="text-xs text-gray-400">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(item._id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
