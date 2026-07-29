# Orija Trading Agent

Risk-controlled AI trading agent that connects to an investment platform (Alpaca paper by default, or a local simulator) and runs automated strategies.

## Important

**This does not guarantee profits.** No agent can "maximize profits quickly" in real markets. Default mode is **paper trading + dry-run** (signals only). Live brokerage trading is blocked. Use this to research automation and risk controls — not as a get-rich-quick system.

## Features

- **Paper-first**: local simulated broker, or Alpaca paper API
- **Risk gates**: max position size, cash reserve, daily loss halt, confidence floor, cooldowns
- **Strategies**: momentum, mean reversion, hybrid
- **Optional LLM**: OpenAI can refine confidence / veto speculative signals (never bypasses risk)
- **CLI + Docker**: `trade-agent` commands and `docker compose`

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Analyze one cycle (no orders)
trade-agent run --cycles 1

# Submit orders to the local paper broker
trade-agent run --cycles 1 --live-orders

# Account snapshot
trade-agent status

# Quote
trade-agent quote AAPL
```

## Connect Alpaca (paper)

1. Create a free paper account at [alpaca.markets](https://alpaca.markets)
2. Copy API keys into `.env`:

```bash
cp .env.example .env
# TRADE_ALPACA_API_KEY=...
# TRADE_ALPACA_API_SECRET=...
```

3. Set `config.yaml`:

```yaml
broker:
  provider: alpaca
  paper_mode: true
  alpaca_base_url: https://paper-api.alpaca.markets
agent:
  dry_run: true
```

4. Run:

```bash
trade-agent run --cycles 1
# When ready to place paper orders:
trade-agent run --cycles 1 --live-orders
```

## Docker

```bash
cp .env.example .env
docker compose build
docker compose run --rm trading-agent trade-agent run --cycles 1
```

## Configuration

See `config.yaml` for symbols, strategy, and risk limits. Environment variables use the `TRADE_` prefix (see `.env.example`).

## Safety model

| Guard | Behavior |
| --- | --- |
| `dry_run: true` | Compute signals only |
| `paper_mode: true` | Alpaca paper endpoint only |
| Live Alpaca | Explicitly rejected by the adapter |
| Daily loss limit | Halts the agent for the session |
| Position / cash caps | Shrinks or rejects oversized orders |

## Tests

```bash
pytest -q
```

## Disclaimer

Trading involves substantial risk of loss. Past simulated results do not predict future returns. You are solely responsible for API keys, compliance with your broker's terms, and any capital you deploy.
