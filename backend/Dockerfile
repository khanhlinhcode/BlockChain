FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src ./src
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

RUN addgroup -S certchain && adduser -S certchain -G certchain

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
RUN mkdir -p /app/uploads && chown -R certchain:certchain /app

USER certchain
EXPOSE 5000
CMD ["node", "src/app.js"]
