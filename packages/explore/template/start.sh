#!/bin/bash
# Runs once when the template is built; E2B snapshots the box after it, so every sandbox starts
# with Postgres and Redis already up.
ver="$(ls /usr/lib/postgresql | sort -V | tail -1)"
sudo mkdir -p /var/run/postgresql && sudo chown postgres:postgres /var/run/postgresql
pg_isready -h localhost -q || sudo pg_ctlcluster --skip-systemctl-redirect "$ver" main start || true
for _ in $(seq 1 60); do pg_isready -h localhost -q && break; sleep 0.5; done
redis-cli ping >/dev/null 2>&1 || sudo redis-server --daemonize yes --bind 127.0.0.1 --port 6379
