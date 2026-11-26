FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY client/package*.json client/
COPY server/package*.json server/
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts && npm --prefix server prune --omit=dev && npm --prefix client prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=4100 DATABASE_PATH=/app/server/data/snapshots
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/server/data/snapshots && chown -R node:node /app/server/data
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:4100/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","scripts/production.mjs"]
