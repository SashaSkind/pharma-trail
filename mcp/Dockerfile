# Hosted, read-only ClickHouse MCP endpoint for Pharma Trail.
# Runs the official `mcp-clickhouse` stdio server and bridges it to Streamable HTTP
# (the transport modern Claude clients use) via supergateway at /mcp.
#
# Connects to ClickHouse as the read-only `webapp` user (creds passed as env at deploy,
# never baked into the image). Listens on $PORT (Cloud Run / Fly / Railway compatible).

FROM node:20-slim

# Python + pip for the MCP server; node is already present for supergateway.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-venv python3-pip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install the official ClickHouse MCP server into an isolated venv.
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
RUN pip install --no-cache-dir mcp-clickhouse

# Pre-warm supergateway so cold starts are fast.
RUN npm install -g supergateway

# Defaults (override CLICKHOUSE_* at deploy; keep secrets out of the image).
ENV PORT=8080 \
    CLICKHOUSE_PORT=8443 \
    CLICKHOUSE_SECURE=true \
    CLICKHOUSE_DATABASE=rx \
    CLICKHOUSE_ALLOW_WRITE_ACCESS=false \
    CLICKHOUSE_ALLOW_DROP=false

EXPOSE 8080

# stdio mcp-clickhouse  ->  Streamable HTTP at /mcp  (+ /healthz, CORS for browser clients)
CMD ["sh","-c","supergateway --stdio mcp-clickhouse --outputTransport streamableHttp --streamableHttpPath /mcp --stateful --cors --healthEndpoint /healthz --port ${PORT}"]
