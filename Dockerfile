FROM oven/bun:1.4.2

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

COPY . .

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/bunilite.sqlite
EXPOSE 3000
CMD ["bun", "run", "start"]
