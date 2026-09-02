# Live proof

Four directories from live Solari Browser runs. Three passed and released the
budget; the fourth failed evaluation and refunded it. Each receipt points to the
preceding receipt's SHA-256 hash, so the four form one chain.

| Run | Task | Decision | Budget | Score after |
| --- | --- | --- | --- | --- |
| `10881631` | homepage | pass | released | 1.000 |
| `132b8bac` | homepage | pass | released | 1.000 |
| `162b5aec` | homepage | pass | released | 1.000 |
| `1d317dc5` | pricing | **fail** | **refunded** | 0.750 |

The first three ran on September 1, 2026 against `https://example.com/`, before
the task contract carried a name; their `task` object has no `name` field.

## The refunded run

`1d317dc5` is the one worth reading. The Seller was asked for
`https://example.com/pricing`, a page that does not exist. Nothing failed in a
way an orchestrator would notice:

- the navigation resolved and the session recorded normally,
- the Seller returned a 17 KB screenshot and a 6-event rrweb replay,
- no exception was raised, and the run exited its own loop cleanly.

A "did the agent finish?" check pays for this. The receipt shows why this one
did not:

```json
"evaluator": {
  "checks": {
    "url": true,
    "title": false,
    "heading": false,
    "screenshot_nonempty": true,
    "replay_nonempty": true
  },
  "passed": false
}
```

The evidence checks pass and the page checks fail. The Seller delivered a real
recorded run of the wrong page — `Example Domain` where the task asked for
`Pricing` — so the Evaluator refused and the Buyer's 100 cents went back. The
Seller's score moved from `1.000` to `0.750`, and the next receipt in the chain
carries that number.

Each directory contains:

- `receipt.json` — task contract, observation, evaluation, settlement,
  reputation, and evidence hashes
- `screenshot.png` — the captured browser page
- `replay.ndjson` — the downloaded rrweb session replay

Verify any directory from the example root:

```bash
python main.py --verify proof/live-runs/<run-id>/receipt.json
```

The committed proof was scanned for API-key, authorization, bearer-token,
cookie, and token strings before publication. A Solari session ID is retained
in each receipt for provider traceability; it is not an API credential.
