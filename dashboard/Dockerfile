# ---- build ----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Copy manifests first so dependency install caches independently of source.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci

COPY tsconfig.base.json ./
COPY server ./server
COPY web ./web
RUN npm run build

# Re-resolve to production dependencies only, so devDependencies (tsx,
# typescript, vite) never reach the runtime image.
RUN npm ci --omit=dev --workspace=server

# ---- runtime --------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The server resolves the SPA at ../web relative to its own compiled output,
# so dist/ and web/ must sit as siblings under /app.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/package.json ./package.json
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/web/dist ./web

# Read-only container state and read-only config discovery; the dashboard never
# needs to write anything, so it runs unprivileged.
USER node

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.DASHBOARD_PORT||8090)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
