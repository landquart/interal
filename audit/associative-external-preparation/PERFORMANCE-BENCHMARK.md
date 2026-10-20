# Performance benchmark

**Measured on the entire pinned corpus and entire available v5 inventory; bounded queue materialization is reported separately.** Inputs are actual locked sources and Git-verified observations. No synthetic production rows or invented frequencies were used.

| Operation | Scope | Seconds | Peak process RSS, KiB |
|---|---|---:|---:|
| Fresh corpus build + physical-row audits + global catalog | 13 partitions, first root | 2023.462 | at most 33,260 per partition worker |
| Independent corpus replay | 13 fresh partitions, second root | 2016.728 | recorded per worker in REPLAY-PARTITIONS |
| Checksum-verified unchanged corpus reuse | 13 reused, 0 rebuilt | 25.34 | bounded streaming |
| Source index final continuation | resumes recorded checkpoints, completes all partitions | 797.113 | 87636 |
| Full resumed index audit | every compressed non-inflection payload | 395.261 | 34156 |
| Unchanged completed source index reuse | 0 reprocessed source rows | 33.748 | 24228 |
| v5 inventory + frequency projection | 1,792 shards, 2,456,543 families, 10,078,319 seeds, 4,924,281 frequency observations | 2142.141 | 163156 |
| Unchanged v5 projection reuse | 1,792 reused shards, 0 processed | 14.327 | 25568 |

The source index was built across actual interruptions and a disk-budget pause; the final-continuation duration is **not an uninterrupted cold-build baseline**. Prior checkpoints/logs remain evidence of recovery, not a fabricated single-run timing. Full index: **8,639,414,272 bytes**, project projection: **3,831,169,024 bytes**. The SQLite source cache is explicitly limited to 64 MiB during WAL ingestion and 8 MiB for queries; temporary operations are disk-backed. The largest decoded v5 shard was 13,804,721 bytes against a 64 MiB ceiling. No complete source graph is materialized in Python RAM.

Full-inventory lookup/arithmetic workload (counts retain multiplicity; no identity merge):

| Families | Seed observations scanned | Native lexical hits | Directed productive arc occurrences | Seconds |
|---:|---:|---:|---:|---:|
| 10 | 1,249 | 1,440 | 157 | 24.793 |
| 100 | 21,064 | 23,770 | 3,743 | 4.702 |
| 1,000 | 110,744 | 168,195 | 27,583 | 4.872 |
| 2,456,543 | 10,078,319 | 9,112,946 | 1,417,722 | 48.234 |

Building disk summaries took 24.758 seconds. The benchmark process peak RSS was 36304 KiB. These are concurrent-workload observations with changing cache warmth, not isolated repeated timing distributions. Small-stage exact-hit counts were independently checked against direct native-identity joins. These are aggregate workload counts, not candidate acceptance or full path/queue exports.

Actual bounded paths, grouping, frequency payload reads and test queue persistence, up to one real eligible seed per family:

| Families examined | Seed queries | Frequency reads | Paths | Review questions | Truncated queries | Seconds |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 9 | 9 | 11 | 11 | 0 | 0.189 |
| 100 | 87 | 87 | 113 | 113 | 0 | 1.355 |
| 1,000 | 921 | 921 | 1123 | 1123 | 0 | 8.493 |

Families without a productive seed are explicitly counted in `PAYLOAD-STAGES.json`. Every selected traversal has finite depth/path/expansion limits and reports truncation. Questions retain all native alternatives and discovery paths; no source-local identity is inferred from spelling. A further 100-real-seed test and prior-decision retention check are in `BENCHMARK.json`. Re-running unchanged benchmark queues is covered by the real `internet → internetico` source/frequency regression.

The full-index guarded pilot processed 115 actual source observations for the existing seven named families, reading 222 frequency observations and producing 56 review questions. The finite selected graph retains 8 unresolved claims explicitly. Its separate bound-event counters are `{'family_selection': 0, 'frequency_lookup': 0, 'native_lookup': 362, 'path_traversal': 0, 'per_language_selection': 39}`; overlapping cap events are not an exact count of skipped lexical analyses. All pilot limits and the legacy aggregate's narrower scope are recorded in the receipt. Unchanged queue export bytes agree and no repeat question needs re-review. Existing manual/negative family guards remain in force. See `GUARDED-PILOT.json`.

Limits: the approved v6 catalog contains only 19 families and the existing operational pilot permits seven at once; millions of v5 inventory families are not reviewed v6 gold. Full operational path/queue expansion across all inventory families was **not** materialized. New-source replacement still requires a new versioned index; unchanged source partitions/shards are reused. The measured quotas support bounded jobs, not an assertion that every possible lexical analysis fits one unlimited job. No membership or formula write occurred.
