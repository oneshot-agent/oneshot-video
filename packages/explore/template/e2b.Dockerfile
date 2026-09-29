# oneshot-video: the box a submitted repo is prepared in.
#
# OneShot's sandbox agent (run-agent.ts) drives it; the camera stays outside. Sized and stocked for
# the repos people bring to a hack day: a webpack or Next build needs memory, most apps want Node
# with pnpm or yarn, many want Python, and "needs a database" is the most common reason a repo
# cannot boot — so Postgres and Redis are already running when the box starts (see start.sh).
#
# Built by ./build.sh, which copies run-agent.ts in from the one-shot repo at build time: it is
# OneShot's internal code and this repo is public, so it is never committed here.

FROM ubuntu:22.04

USER root

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

# Base tools, native-module build deps (node-gyp, better-sqlite3, bcrypt, psycopg), the two
# services, sqlite. (Chromium comes with Playwright, for check-workflow, further down.)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl wget git unzip xz-utils gnupg lsof procps psmisc jq sudo \
      build-essential pkg-config python3 python3-pip python3-venv python3-dev \
      libpq-dev libssl-dev libffi-dev \
      postgresql postgresql-contrib redis-server sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Node 22 LTS, with pnpm and yarn through corepack (the version a repo pins in packageManager wins).
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@latest --activate \
    && corepack prepare yarn@1.22.22 --activate \
    && npm config set fund false --global && npm config set update-notifier false --global

# Bun, on PATH for every user; `bunx` too, which the pi-agent template lacked.
RUN curl -fsSL https://bun.sh/install | bash \
    && cp /root/.bun/bin/bun /usr/local/bin/bun \
    && ln -sf /usr/local/bin/bun /usr/local/bin/bunx \
    && chmod +x /usr/local/bin/bun

# uv for Python projects (fetches whichever Python a repo asks for).
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh

# A demo database any app can point at: postgresql://demo:demo@localhost:5432/demo (superuser, so
# migrations and extensions work). Redis on its default port, no password.
COPY setup-db.sh /tmp/setup-db.sh
RUN bash /tmp/setup-db.sh && rm /tmp/setup-db.sh

ENV DATABASE_URL_LOCAL=postgresql://demo:demo@localhost:5432/demo \
    REDIS_URL_LOCAL=redis://localhost:6379 \
    PATH=/usr/local/bin:$PATH

# check-workflow: the camera, inside the box. The agent runs its plan through the same code the
# camera outside uses (bundled by build.sh) in the same Chromium, and fixes what fails. Playwright
# is pinned to the repo's version; its Chromium lives in /opt so `user` can run it.
RUN mkdir -p /opt/check && cd /opt/check \
    && echo '{ "private": true }' > package.json \
    && npm install --no-audit --no-fund playwright@1.61.1 \
    && PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright npx playwright install --with-deps chromium \
    && chmod -R a+rX /opt/ms-playwright /opt/check
COPY check-workflow.js /opt/check/check-workflow.js
COPY check-workflow.sh /usr/local/bin/check-workflow
RUN chmod +x /usr/local/bin/check-workflow

# Sandbox commands run as `user`, the build as root: the agent must be able to write its clone,
# its output and the app's files under /home/user.
RUN mkdir -p /home/user/output
COPY run-agent.ts /home/user/run-agent.ts
COPY start.sh /usr/local/bin/oneshot-video-start
RUN chmod +x /usr/local/bin/oneshot-video-start \
    && chmod 777 /home/user /home/user/output \
    && chmod 644 /home/user/run-agent.ts
WORKDIR /home/user
