#!/bin/sh
# check-workflow [plan.json] [--base http://localhost:PORT] — see check-workflow.ts.
export PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
exec bun /opt/check/check-workflow.js "$@"
