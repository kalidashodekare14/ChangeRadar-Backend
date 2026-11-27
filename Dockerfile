# syntax=docker/dockerfile:1
FROM node:26.13.0-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:26.13.0-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:26.13.0-bookworm-slim AS runtime-deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

FROM node:26.13.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 4000
# One image, two commands: `node dist/main.js` (API) and `node dist/worker.js` (Worker).
CMD ["node", "dist/main.js"]
