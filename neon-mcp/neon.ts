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
        // ClickHouse creds as Function secrets, read from process.env at deploy time
        // (provide them via `.env.production` + `neonctl deploy --env .env.production`).
        // CLICKHOUSE_* is not a reserved prefix (NEON_/DATABASE_URL/OPENAI_/AWS_ are).
        env: {
          CLICKHOUSE_HOST: process.env.CLICKHOUSE_HOST!,
          CLICKHOUSE_USER: process.env.CLICKHOUSE_USER!,
          CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD!,
        },
      },
    },
  },
});
