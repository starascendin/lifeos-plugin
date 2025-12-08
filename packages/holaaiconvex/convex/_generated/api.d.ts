/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _lib_algorithms_sm2 from "../_lib/algorithms/sm2.js";
import type * as _lib_auth from "../_lib/auth.js";
import type * as common_dev from "../common/dev.js";
import type * as common_messages from "../common/messages.js";
import type * as common_tts from "../common/tts.js";
import type * as common_users from "../common/users.js";
import type * as holaai_ai from "../holaai/ai.js";
import type * as holaai_content from "../holaai/content.js";
import type * as holaai_exercises from "../holaai/exercises.js";
import type * as holaai_progress from "../holaai/progress.js";
import type * as holaai_seed from "../holaai/seed.js";
import type * as holaai_voice from "../holaai/voice.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_lib/algorithms/sm2": typeof _lib_algorithms_sm2;
  "_lib/auth": typeof _lib_auth;
  "common/dev": typeof common_dev;
  "common/messages": typeof common_messages;
  "common/tts": typeof common_tts;
  "common/users": typeof common_users;
  "holaai/ai": typeof holaai_ai;
  "holaai/content": typeof holaai_content;
  "holaai/exercises": typeof holaai_exercises;
  "holaai/progress": typeof holaai_progress;
  "holaai/seed": typeof holaai_seed;
  "holaai/voice": typeof holaai_voice;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
