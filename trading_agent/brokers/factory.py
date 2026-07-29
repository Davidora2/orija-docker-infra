from trading_agent.brokers.alpaca import AlpacaBroker
from trading_agent.brokers.base import Broker
from trading_agent.brokers.paper import PaperBroker
from trading_agent.config import Settings


def create_broker(settings: Settings) -> Broker:
    provider = settings.broker.provider
    if provider == "paper":
        return PaperBroker(starting_cash=settings.broker.starting_cash)
    if provider == "alpaca":
        if not settings.alpaca_api_key or not settings.alpaca_api_secret:
            raise ValueError(
                "Alpaca requires TRADE_ALPACA_API_KEY and TRADE_ALPACA_API_SECRET"
            )
        return AlpacaBroker(
            api_key=settings.alpaca_api_key,
            api_secret=settings.alpaca_api_secret,
            base_url=settings.broker.alpaca_base_url,
            paper_mode=settings.broker.paper_mode,
        )
    raise ValueError(f"Unsupported broker provider: {provider}")
