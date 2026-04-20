# Build context: apps/web (Railway service rootDir = apps/web).
# Uses npm so the image does not depend on the monorepo root lockfile.
FROM node:20-alpine

# If Railway (or a dashboard override) runs `pnpm` while the repo root uses pnpm, the binary
# must exist. Install stays `npm install`; this only satisfies stray `pnpm` on PATH.
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID

RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["sh", "-c", "exec npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
