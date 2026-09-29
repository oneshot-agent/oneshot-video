#!/bin/bash
# Build-time: the demo role and database every sandbox starts with.
# postgresql://demo:demo@localhost:5432/demo, a superuser so migrations and extensions work.
# The build VM runs systemd, which may start the cluster on its own; readiness (pg_isready) is
# the only test that counts.
set -euo pipefail
ver="$(ls /usr/lib/postgresql | sort -V | tail -1)"
mkdir -p /var/run/postgresql && chown postgres:postgres /var/run/postgresql
# Loopback only, so no TLS: the snakeoil cert it defaults to is not installed.
sed -i "s/^ssl = on/ssl = off/" "/etc/postgresql/$ver/main/postgresql.conf"
# systemd may bring the unit up by itself; start only if nothing answers, and let a lost race go.
pg_isready -q || pg_ctlcluster --skip-systemctl-redirect "$ver" main start || true
for _ in $(seq 1 60); do pg_isready -q && break; sleep 0.5; done
pg_isready || { tail -30 "/var/log/postgresql/postgresql-$ver-main.log"; exit 1; }
su postgres -c "psql -v ON_ERROR_STOP=1" <<'SQL'
CREATE ROLE demo WITH LOGIN SUPERUSER PASSWORD 'demo';
CREATE DATABASE demo OWNER demo;
SQL
pg_ctlcluster --skip-systemctl-redirect "$ver" main stop || true
