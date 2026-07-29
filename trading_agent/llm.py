from __future__ import annotations

import json
from typing import Any

import httpx

from trading_agent.models import Bar, Signal, SignalAction


class LLMAnalyst:
    """Optional OpenAI-compatible analyst that can bias confidence, never bypass risk."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini", timeout: float = 45.0):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def refine(self, signal: Signal, bars: list[Bar]) -> Signal:
        if signal.action == SignalAction.HOLD or not bars:
            return signal

        closes = [round(bar.close, 2) for bar in bars[-10:]]
        prompt = {
            "symbol": signal.symbol,
            "proposed_action": signal.action.value,
            "strategy_reason": signal.reason,
            "recent_closes": closes,
            "instruction": (
                "You are a cautious trading risk analyst. Reply ONLY with JSON: "
                '{"approve": bool, "confidence_delta": float between -0.2 and 0.2, '
                '"note": string}. Disapprove speculative momentum chasing.'
            ),
        }
        try:
            response = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {
                            "role": "system",
                            "content": "Return strict JSON only.",
                        },
                        {"role": "user", "content": json.dumps(prompt)},
                    ],
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            payload: dict[str, Any] = json.loads(content)
        except Exception as exc:  # noqa: BLE001 — LLM is optional enrichment
            return signal.model_copy(update={"reason": f"{signal.reason} (llm unavailable: {exc})"})

        approve = bool(payload.get("approve", True))
        delta = float(payload.get("confidence_delta", 0.0))
        delta = max(-0.2, min(0.2, delta))
        note = str(payload.get("note", ""))

        if not approve:
            return Signal(
                symbol=signal.symbol,
                action=SignalAction.HOLD,
                confidence=max(signal.confidence + delta, 0.0),
                reason=f"LLM veto: {note or signal.reason}",
                strategy=signal.strategy,
            )

        return signal.model_copy(
            update={
                "confidence": max(0.0, min(1.0, signal.confidence + delta)),
                "reason": f"{signal.reason} | LLM: {note}" if note else signal.reason,
            }
        )
