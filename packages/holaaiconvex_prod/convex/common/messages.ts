import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_createdAt")
      .order("asc")
      .collect();
    return messages;
  },
});

export const send = mutation({
  args: {
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    const messageId = await ctx.db.insert("messages", {
      content: args.content,
      userId: identity?.subject,
      userName: identity?.name ?? identity?.email ?? "Anonymous",
      createdAt: Date.now(),
    });

    return messageId;
  },
});
