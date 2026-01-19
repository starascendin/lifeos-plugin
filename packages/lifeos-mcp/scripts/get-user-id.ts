#!/usr/bin/env npx tsx

/**
 * Get User ID Script
 *
 * Fetches the Convex user ID by email address.
 * This is needed to configure the LIFEOS_USER_ID environment variable for the MCP server.
 *
 * Usage:
 *   npx tsx packages/lifeos-mcp/scripts/get-user-id.ts [email]
 *
 * Environment:
 *   CONVEX_URL - Convex deployment URL (defaults to dev)
 *
 * Examples:
 *   npx tsx packages/lifeos-mcp/scripts/get-user-id.ts bryanshliu@gmail.com
 *   CONVEX_URL=https://prod.convex.cloud npx tsx packages/lifeos-mcp/scripts/get-user-id.ts bryanshliu@gmail.com
 */

// Configuration
const DEFAULT_EMAIL = "bryanshliu@gmail.com";
const CONVEX_URLS = {
  dev: "https://beaming-giraffe-300.convex.cloud",
  staging: "https://exalted-shrimp-978.convex.cloud",
  prod: "https://exalted-shrimp-978.convex.cloud", // Update if different
};

async function getUserIdByEmail(email: string, convexUrl: string): Promise<string | null> {
  // Use the Convex HTTP API to query users by email
  // We'll use a public query endpoint
  const url = `${convexUrl}/api/query`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: "users:getByEmail",
        args: { email },
      }),
    });

    if (!response.ok) {
      // Try alternative: query all users and filter (less efficient but works)
      console.log("Direct query failed, trying alternative method...");
      return await getUserIdByEmailFallback(email, convexUrl);
    }

    const result = await response.json();
    if (result.value && result.value._id) {
      return result.value._id;
    }

    return null;
  } catch (error) {
    console.error("Error querying Convex:", error);
    return null;
  }
}

async function getUserIdByEmailFallback(email: string, convexUrl: string): Promise<string | null> {
  // Use tool-call endpoint with API key to get user info
  const url = `${convexUrl}/tool-call`;

  try {
    // This won't work without a valid userId, so we need another approach
    // Let's check if there's a public endpoint or use the dashboard
    console.log("\nAlternative method not available via HTTP API.");
    console.log("Please use one of these methods to find your user ID:");
    console.log("");
    console.log("1. Convex Dashboard:");
    console.log(`   - Go to ${convexUrl.replace('.convex.cloud', '.convex.dev')}`);
    console.log("   - Navigate to the 'users' table");
    console.log(`   - Find the row with email: ${email}`);
    console.log("   - Copy the _id value");
    console.log("");
    console.log("2. Convex CLI:");
    console.log('   npx convex run users:getByEmail \'{"email": "' + email + '"}\'');
    console.log("");
    return null;
  } catch (error) {
    return null;
  }
}

async function main() {
  const email = process.argv[2] || DEFAULT_EMAIL;
  const convexUrl = process.env.CONVEX_URL || CONVEX_URLS.dev;

  console.log("=".repeat(60));
  console.log("LifeOS MCP - Get User ID");
  console.log("=".repeat(60));
  console.log("");
  console.log(`Email: ${email}`);
  console.log(`Convex URL: ${convexUrl}`);
  console.log("");

  const userId = await getUserIdByEmail(email, convexUrl);

  if (userId) {
    console.log("=".repeat(60));
    console.log("SUCCESS!");
    console.log("=".repeat(60));
    console.log("");
    console.log(`User ID: ${userId}`);
    console.log("");
    console.log("Add this to your .mcp.json:");
    console.log(JSON.stringify({
      mcpServers: {
        lifeos: {
          command: "npx",
          args: ["tsx", "packages/lifeos-mcp/src/index.ts"],
          env: {
            CONVEX_URL: convexUrl,
            LIFEOS_USER_ID: userId,
          },
        },
      },
    }, null, 2));
  } else {
    console.log("Could not automatically fetch user ID.");
  }
}

main().catch(console.error);
