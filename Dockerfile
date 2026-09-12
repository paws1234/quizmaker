# syntax=docker/dockerfile:1
#
# One image definition, three purposes:
#   deps   -> resolves node_modules from the lockfile
#   dev    -> `npm run dev` with the source bind-mounted (docker compose default)
#   runner -> production build served straight from .next/standalone
#
# Build a single target with:  docker build --target dev -t quize:dev .

FROM node:22-bookworm-slim AS base
# Containers on this host get AAAA answers back but have no IPv6 route, which makes
# npm/curl hang until they time out. Preferring IPv4 fixes it for every tool in the image.
RUN echo 'precedence ::ffff:0:0/96  100' >> /etc/gai.conf

ENV NEXT_TELEMETRY_DISABLED=1 \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false
WORKDIR /app

# ---------------------------------------------------------------- dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ------------------------------------------------------------------- dev image
FROM base AS dev
ARG HOST_UID=1000
ARG HOST_GID=1000
# Run as the host user so anything written into the bind-mounted source (or the
# .next volume) is owned by the developer rather than root.
RUN if [ "$HOST_GID" != "1000" ]; then groupmod -g "$HOST_GID" node; fi \
 && if [ "$HOST_UID" != "1000" ]; then usermod -u "$HOST_UID" -g "$HOST_GID" node; fi
ENV NODE_ENV=development
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .
# .next is a named volume at runtime; it must exist here, owned by node, or the
# volume is created root-owned and the dev server cannot write to it.
RUN mkdir -p /app/.next && touch /app/.next/.keep && chown -R node:node /app/.next
USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ------------------------------------------------------------ production build
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --------------------------------------------------- production runtime (slim)
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# The standalone server is self-contained: no node_modules copy required.
COPY --from=build /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
