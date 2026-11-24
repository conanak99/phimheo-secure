FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source, public assets, and private video storage
COPY . .

# SITE_URL is used by astro.config.mjs at build time for `site` and `security.allowedDomains`
ARG SITE_URL
ENV SITE_URL=${SITE_URL}

RUN npm run build

# Ensure non-root user owns runtime files
RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321

CMD ["sh", "-c", "./node_modules/.bin/drizzle-kit push --force && ./node_modules/.bin/tsx scripts/bootstrap-db.ts && exec node ./dist/server/entry.mjs"]
