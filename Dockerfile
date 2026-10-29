FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN chown node:node /app
COPY --chown=node:node . .
USER node
RUN npm ci && npm run db:generate

# Next.js evaluates the frontend API rewrite during its build.
ARG BACKEND_URL=http://backend:3001
ENV BACKEND_URL=${BACKEND_URL}
RUN DATABASE_URL=postgresql://clearhold:build-only@db:5432/clearhold npm run build

EXPOSE 3000 3001
