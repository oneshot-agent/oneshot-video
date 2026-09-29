/**
 * E2B v2 template build: the Dockerfile beside this file, 4 vCPU / 8 GB, Postgres and Redis
 * started (and snapshotted running) by start.sh. Run through ./build.sh, which prepares .build/.
 */
import { defaultBuildLogger, Template } from "e2b";

const dir = import.meta.dirname;
const template = Template({ fileContextPath: dir })
  .fromDockerfile(`${dir}/e2b.Dockerfile`)
  .setStartCmd(
    "/usr/local/bin/oneshot-video-start",
    "pg_isready -h localhost -q && redis-cli ping",
  );

const info = await Template.build(template, "oneshot-video", {
  cpuCount: Number(process.env["CPU_COUNT"] ?? 4),
  memoryMB: Number(process.env["MEMORY_MB"] ?? 8192),
  minFreeDiskMb: Number(process.env["MIN_FREE_DISK_MB"] ?? 8192),
  onBuildLogs: defaultBuildLogger(),
});
console.log(`built ${info.name} · ${info.templateId} · build ${info.buildId ?? ""}`);
