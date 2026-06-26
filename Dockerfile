# SendAPI hosted MCP server (streamable HTTP) — deploy behind https://mcp.sendapi.co
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 8080
# PORT and SENDAPI_BASE_URL can be overridden at runtime. No API key here:
# callers authenticate per request with their own SendAPI key.
CMD ["node", "dist/http.js"]
