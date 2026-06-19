// Neon Functions infra-as-code. `neonctl deploy` reads this and deploys each function.
// Requires Functions preview access + the @neondatabase/config package (provided in the preview;
// `neonctl bootstrap` wires it up). Functions are AWS us-east-2, new projects only during preview.
import { defineConfig } from "@neondatabase/config/v1";

export default defineConfig({
  preview: {
    functions: {
      mcp: {
        name: "Pharma Trail MCP",
        source: "./functions/mcp.ts",
      },
    },
  },
});
