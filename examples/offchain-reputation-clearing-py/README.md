# Off-chain reputation clearing (Python)

Turn a real Solari Browser run into a portable receipt, settle its budget in
SQLite, and build reputation without a token or chain.

The four roles are deliberately small:

- **Seller** opens `example.com` in a recorded Solari Browser session and saves
  a screenshot plus rrweb replay.
- **Evaluator** checks the observed page and evidence.
- **Verifier** hashes the evidence and receipt so a later reader detects a
  swapped file.
- **Buyer** holds 100 cents in SQLite, releases it only on pass, and refunds it
  on failure.

Each receipt includes the Seller's updated score and the previous receipt hash,
forming a portable history. This detects evidence replacement after settlement;
it is not a signature or proof against an operator rewriting the whole history.

## Run

```bash
cd examples/offchain-reputation-clearing-py
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export SOLARI_API_KEY=slr_live_...   # https://console.getsolari.com

python main.py
python main.py                       # produces a second linked receipt
python main.py --verify runs/<run-id>/receipt.json
```

Generated evidence and the SQLite ledger stay under `runs/`, which is ignored
by Git. Copy a run directory with its `receipt.json`, `screenshot.png`, and
`replay.ndjson` to let another agent verify the receipt.

Three real Solari Browser runs, including a linked second receipt, are checked
in under [`proof/live-runs`](proof/live-runs). They contain no API key or
authentication material.

Source: [`main.py`](main.py)
