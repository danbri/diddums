# Plugin Universe metadata snapshot

Snapshot harvested from `https://plugin-universe.com/dumps/` on 2026-09-17, following the bulk-download guidance on `/services` rather than crawling the API.

The complete upstream directory structure is preserved inside `plugin-universe-dumps.tar`, including the licence partitions:

- `cc0/` — factual metadata released under CC0
- `notice/` — factual metadata whose upstream licences require preservation of notices
- `prose/` — user-authored prose, currently CC-BY-SA-4.0 in the source dump

Snapshot manifest generation time: `2026-09-17T06:25:12.345Z`.

Harvested graph payload:

- CC0: 15 graph files / 44,694 triples
- notice: 157 graph files / 20,073 triples
- prose: 1 graph file / 10 triples
- total graph files: 173
- total graph triples: 64,777

The archive also includes the upstream `MANIFEST.json`, `README.md`, `public-void.ttl`, `void.ttl`, and `notice/NOTICES.txt`: 178 files total.

Do not flatten the licence partitions when reusing the data. Consult the manifest and notices in the archive for the upstream terms and provenance.