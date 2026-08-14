# PeaceNest Housekeeping State Audit

Audit date: 2026-08-14 (Asia/Ho_Chi_Minh)

Scope: read-only PostgreSQL audit of property `PEACE_HOME` (`89ad5bdd-1587-441d-bd34-4cf203f19bba`). The query joined the approved 23-room manifest, rooms, room types, price tiers, current bookings, maintenance blocks, housekeeping tasks, users, admin memberships, and property memberships. No production data was mutated.

## Source facts

- `packages/database/src/client-room-import.ts` defines `peace-home-23-rooms-v2` with exactly 23 unique physical room codes.
- `rooms.status` is the activation axis (`ACTIVE`, `INACTIVE`, `MAINTENANCE`).
- `rooms.housekeeping_status` is the independent condition axis (`CLEAN`, `DIRTY`, `CLEANING`).
- `housekeeping_tasks` is an independent durable work queue with `ARRIVAL_PREP` and `TURNOVER` task types.
- `ARRIVAL_PREP` may coexist with a `CLEAN` room and must not imply cleaning state.

## Database facts

The approved manifest matched 23 production room rows. All 23 approved rows were `ACTIVE`, `CLEAN`, unoccupied at audit time, and without an active maintenance block. Every approved row currently has `room_number = physical_room_code`, which is the direct cause of the duplicated room label risk in the admin presentation.

| room_id   | room_number       | physical_room_code | room type/concept | tier      | rooms.status | rooms.housekeeping_status | current booking/occupancy | maintenance | non-cancelled tasks | task types/statuses              | assignee | version | verified |
| --------- | ----------------- | ------------------ | ----------------- | --------- | ------------ | ------------------------- | ------------------------- | ----------- | ------------------: | -------------------------------- | -------- | ------: | -------- |
| e8521c77… | 94BDT-HavenG03    | 94BDT-HavenG03     | Haven             | Signature | ACTIVE       | CLEAN                     | none                      | none        |                  12 | ARRIVAL_PREP: 7 DUE, 5 SCHEDULED | none     |       0 | none     |
| dd5b0f64… | 94BDT-Nami206     | 94BDT-Nami206      | Nami              | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   6 | ARRIVAL_PREP: 5 DUE, 1 SCHEDULED | none     |       0 | none     |
| afd9ad31… | 94BDT-Nami306     | 94BDT-Nami306      | Nami              | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   1 | ARRIVAL_PREP: 1 SCHEDULED        | none     |       0 | none     |
| 2afb4ec9… | 94BDT-Phù Vân 207 | 94BDT-Phù Vân 207  | Phù Vân           | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   2 | ARRIVAL_PREP: 2 DUE              | none     |       0 | none     |
| ac0bbb50… | 94BDT-Phù vân 307 | 94BDT-Phù vân 307  | Phù Vân           | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   1 | ARRIVAL_PREP: 1 DUE              | none     |       0 | none     |
| e3cb70d8… | 94BDT-Yuki104     | 94BDT-Yuki104      | Yuki              | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   1 | ARRIVAL_PREP: 1 SCHEDULED        | none     |       0 | none     |
| 6e6f28ea… | 94BDT-Rose208     | 94BDT-Rose208      | Rose              | Standard  | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| 36c2ad1a… | 94BDT-Rose308     | 94BDT-Rose308      | Rose              | Standard  | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| 49275661… | 94BDT-Sabi102     | 94BDT-Sabi102      | Sabi              | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| 942b3b84… | 94BDT-Sabi202     | 94BDT-Sabi202      | Sabi              | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| 636be953… | 94BDT-Sabi302     | 94BDT-Sabi302      | Sabi              | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| b130e6e2… | 94BDT-SabiG02     | 94BDT-SabiG02      | Sabi              | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| 36383ec5… | 94BDT-Sudal205    | 94BDT-Sudal205     | Sudal             | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| a588742b… | 94BDT-Sudal305    | 94BDT-Sudal305     | Sudal             | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| e18c2770… | 94BDT-Sunset103   | 94BDT-Sunset103    | Sunset            | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| d1cb134b… | 94BDT-Sunset203   | 94BDT-Sunset203    | Sunset            | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| 947ee4e4… | 94BDT-Sunset303   | 94BDT-Sunset303    | Sunset            | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| d9974ed4… | 94BDT-Wabi101     | 94BDT-Wabi101      | Wabi              | Signature | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| 19e83f58… | 94BDT-Wabi201     | 94BDT-Wabi201      | Wabi              | Signature | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| 220d0fc9… | 94BDT-Wabi301     | 94BDT-Wabi301      | Wabi              | Signature | ACTIVE       | CLEAN                     | none                      | —           |                   0 | —                                | —        |       — | —        |
| f9b31370… | 94BDT-WabiG01     | 94BDT-WabiG01      | Wabi              | Signature | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| 1e43698e… | 94BDT-Yuki204     | 94BDT-Yuki204      | Yuki              | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |
| 8f187b57… | 94BDT-Yuki304     | 94BDT-Yuki304      | Yuki              | Deluxe    | ACTIVE       | CLEAN                     | none                      | none        |                   0 | —                                | —        |       — | —        |

There were 23 non-cancelled tasks, all `ARRIVAL_PREP`; no `TURNOVER` task existed. The 12 historical `DUE` ARRIVAL_PREP tasks had due times between 2026-08-05 and 2026-08-13 while their linked bookings were already past; they are stale work, but they do not authorize a dirty-room display.

The property contains 34 room rows total, including 11 non-manifest legacy/extra rows. The approved 23 physical codes themselves are unique. All 23 approved room numbers equal their physical codes.

## Derived facts and defects

| Check                                                          |                                             Result | Classification                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------: | ------------------------------------------------------------------------------------------------------ |
| Approved Peace Home physical rooms                             |                                                 23 | DB_FACT                                                                                                |
| Total Peace Home room rows                                     |                                                 34 | DB_FACT                                                                                                |
| Duplicate approved physical codes                              |                                                  0 | DB_FACT                                                                                                |
| Approved room numbers equal physical codes                     |                                                 23 | DEFECT: presentation/import data quality; repair requires a governed forward migration, not ad-hoc SQL |
| CLEAN room + active TURNOVER                                   |                                                  0 | DB_FACT                                                                                                |
| DIRTY room without appropriate TURNOVER                        |                                                  0 | DB_FACT                                                                                                |
| CLEANING room without IN_PROGRESS TURNOVER                     |                                                  0 | DB_FACT                                                                                                |
| IN_PROGRESS TURNOVER while room != CLEANING                    |                                                  0 | DB_FACT                                                                                                |
| DONE TURNOVER while room DIRTY/CLEANING                        |                                                  0 | DB_FACT                                                                                                |
| Duplicate active TURNOVER work                                 |                                                  0 | DB_FACT                                                                                                |
| Assigned task to inactive/non-housekeeping/wrong-property user | 0 assigned rows; all existing tasks are unassigned | DB_FACT                                                                                                |
| Task property != room property                                 |                             0 (foreign-key scoped) | DB_FACT                                                                                                |
| Stale ARRIVAL_PREP                                             |               12 DUE tasks linked to past bookings | DEFECT                                                                                                 |
| CLEAN rooms with ARRIVAL_PREP present                          |                                            6 rooms | DB_FACT; current implementation incorrectly turns this into a cleaning display                         |
| ARRIVAL_PREP causing dirty display                             |                                                  6 | DEFECT in `deriveRoomDisplayGroup()`                                                                   |
| Inventory exactly approved 23 in DB                            |                    no; 11 extra legacy rows remain | DEFECT; no production repair performed                                                                 |

The current source condition `activeHousekeepingTask !== null` is therefore proven unsafe: it maps six CLEAN rooms carrying ARRIVAL_PREP work to a cleaning group. The source also exposes only one active task and mutates room-level housekeeping endpoints by selecting an arbitrary TURNOVER, which is not task-first and cannot safely address the 23 durable tasks independently.

## Required repair boundary

This audit is evidence only. No production row was updated, cancelled, archived, or reassigned. The implementation must fix source semantics, add governed task-addressed mutations and audit events, and produce a forward repair plan for the 11 legacy room rows, 23 room-number/physical-code duplications, and 12 stale ARRIVAL_PREP tasks before any production data repair is considered.
