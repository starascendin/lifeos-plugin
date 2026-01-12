import { registerPlugin } from "@capacitor/core";
import type { ClerkNativePlugin } from "./definitions";

export const ClerkNative = registerPlugin<ClerkNativePlugin>("ClerkNative");

export * from "./definitions";

