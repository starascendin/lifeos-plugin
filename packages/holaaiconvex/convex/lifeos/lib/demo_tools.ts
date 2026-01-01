/**
 * Demo Tools Library
 * Simple demonstration tools for the AI Agent Convex feature
 */
import { createTool } from "@convex-dev/agent";
import { z } from "zod";

// ==================== WEATHER TOOL ====================

export const getWeatherTool = createTool({
  description: "Get the current weather for a city. Returns temperature, condition, and humidity.",
  args: z.object({
    city: z.string().describe("The city name to get weather for (e.g., 'New York', 'London', 'Tokyo')"),
  }),
  handler: async (_ctx, { city }) => {
    // Simulated weather data (in production, this would call a real API)
    const conditions = ["sunny", "partly cloudy", "cloudy", "rainy", "snowy", "windy"] as const;
    const temperature = Math.floor(Math.random() * 35) + 5; // 5-40°C
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const humidity = Math.floor(Math.random() * 50) + 30; // 30-80%

    return {
      city,
      temperature,
      temperatureUnit: "°C",
      condition,
      humidity,
      humidityUnit: "%",
      note: "This is simulated weather data for demonstration purposes",
    };
  },
});

// ==================== TIME TOOL ====================

export const getTimeTool = createTool({
  description: "Get the current time and date in a specific timezone.",
  args: z.object({
    timezone: z
      .string()
      .optional()
      .describe(
        "IANA timezone string (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo'). Defaults to UTC."
      ),
  }),
  handler: async (_ctx, { timezone }) => {
    const tz = timezone || "UTC";
    const now = new Date();

    try {
      const time = now.toLocaleTimeString("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const date = now.toLocaleDateString("en-US", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      return {
        timezone: tz,
        time,
        date,
        timestamp: now.toISOString(),
      };
    } catch {
      return {
        timezone: tz,
        error: `Invalid timezone: ${tz}`,
        validExample: "America/New_York, Europe/London, Asia/Tokyo, UTC",
      };
    }
  },
});

// ==================== CALCULATE TOOL ====================

export const calculateTool = createTool({
  description:
    "Perform a mathematical calculation. Supports basic arithmetic: addition (+), subtraction (-), multiplication (*), division (/), parentheses, and decimals.",
  args: z.object({
    expression: z
      .string()
      .describe("The mathematical expression to evaluate (e.g., '2 + 2', '(10 * 5) / 2', '3.14 * 2')"),
  }),
  handler: async (_ctx, { expression }) => {
    // Sanitize: only allow numbers, operators, parentheses, decimals, and spaces
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, "");

    if (sanitized !== expression.replace(/\s/g, "").replace(/[0-9+\-*/().]/g, "")) {
      return {
        expression,
        success: false,
        error: "Expression contains invalid characters. Only numbers and basic operators (+, -, *, /, parentheses) are allowed.",
      };
    }

    try {
      // Use Function constructor for safe evaluation of math expressions
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const result = Function(`"use strict"; return (${sanitized})`)();

      if (typeof result !== "number" || !isFinite(result)) {
        return {
          expression,
          success: false,
          error: "Result is not a valid number (possibly division by zero or overflow)",
        };
      }

      return {
        expression,
        result,
        success: true,
      };
    } catch (e) {
      return {
        expression,
        success: false,
        error: `Invalid expression: ${e instanceof Error ? e.message : "Unknown error"}`,
      };
    }
  },
});

// ==================== ALL TOOLS EXPORT ====================

export const demoTools = {
  get_weather: getWeatherTool,
  get_time: getTimeTool,
  calculate: calculateTool,
};
