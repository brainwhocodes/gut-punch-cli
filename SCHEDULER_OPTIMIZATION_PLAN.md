# Gut-Punch Scheduler Optimization & CLI Colorization Plan

_Keep this checklist in version control. Tick the boxes (`[x]`) as you land each PR._

---

## 1  Diagnostics

- [ ] Capture 30 s perf trace of scheduler under load (`bun --prof`).
- [ ] Record `EXPLAIN QUERY PLAN` for due-job query.

## 2  Performance Improvements

### P0

- [x] **Idle-poll back-off** – switch 1 s loop to `setTimeout(nextRunDelta)` capped at 30 s. *(Done)*
- [x] **SQLite index** – `CREATE INDEX IF NOT EXISTS idx_scheduled_next_run ON scheduled(next_run);` *(Done)*

### P1

- [x] **Batch enqueue** – fetch N due jobs at once to cut DB chatter. *(Done)*
- [x] **In-process execution option** – scheduler can run jobs within process when `runInProcess` flag is true. *(Done)*

### P2

- [x] **Configurable worker-pool concurrency** – per-queue `concurrency` limit supported via config. *(Done)*

### P3

- [ ] **Automatic pruning of old job runs** – configure retention period for job history.

## 3  Colored Terminal Output

- [ ] Add lightweight colour lib (`colorette` or `chalk`).
- [ ] Implement `src/logger.ts` with `log(level, msg)`.
- [ ] Replace raw `console.*` calls in CLI & scheduler core with logger.
- [ ] Prefix child-job output with job-name & colour by status.
- [ ] Guard colours with `process.stdout.isTTY` (Windows compatibility).

## 4  Docs & Screenshots

- [ ] Update README with usage and coloured output screenshots.

---

### Progress Key

- [ ] Pending  
- [x] Done
