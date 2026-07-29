from __future__ import annotations

from abc import ABC, abstractmethod

from trading_agent.models import Account, Order, Quote, Side


class Broker(ABC):
    """Broker interface for paper and live adapters."""

    @abstractmethod
    def get_account(self) -> Account:
        raise NotImplementedError

    @abstractmethod
    def get_quote(self, symbol: str) -> Quote:
        raise NotImplementedError

    @abstractmethod
    def submit_order(self, symbol: str, side: Side, qty: float, reason: str = "") -> Order:
        raise NotImplementedError

    @abstractmethod
    def cancel_open_orders(self) -> int:
        raise NotImplementedError

    @property
    @abstractmethod
    def name(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def is_paper(self) -> bool:
        raise NotImplementedError
