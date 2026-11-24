# Painel Comafe — Next.js (standalone) + Prisma 7 + PostgreSQL
# Easypanel: App › Fonte = este repositório › Build = Dockerfile › Porta 3000.
# As variáveis de ambiente (DATABASE_URL, REDIS_URL, BETTER_AUTH_*, KOMMO_*, META_*...) ficam na aba Ambiente do Easypanel.

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependências (o postinstall roda "prisma generate", que precisa do schema)
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm ci

# Build da aplicação
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate && npm run build

# Imagem final
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# As migrações do banco NÃO rodam aqui: aplique com "npm run db:deploy" antes de publicar uma versão nova.
CMD ["node", "server.js"]
