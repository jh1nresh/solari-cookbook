# Live proof

These three directories came from consecutive live Solari Browser runs on
September 1, 2026. Every Evaluator decision passed, every 100-cent budget was
released, and the second and third receipts point to the preceding receipt's
SHA-256 hash.

Each directory contains:

- `receipt.json` — task observation, evaluation, settlement, reputation, and
  evidence hashes
- `screenshot.png` — the captured browser page
- `replay.ndjson` — the downloaded rrweb session replay

Verify any directory from the example root:

```bash
python main.py --verify proof/live-runs/<run-id>/receipt.json
```

The committed proof was scanned for API-key, authorization, bearer-token,
cookie, and token strings before publication. A Solari session ID is retained
in each receipt for provider traceability; it is not an API credential.
