from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from sec_insider_scout.config import Settings
from sec_insider_scout.models import TransactionSide
from sec_insider_scout.scorer import build_trade_ideas
from sec_insider_scout.sec_client import SecEdgarClient

FIXTURES = Path(__file__).parent / "fixtures"


def _parse(name: str, accession: str):
    xml = (FIXTURES / name).read_text()
    client = SecEdgarClient(Settings())
    return client.parse_ownership_xml(
        xml,
        accession=accession,
        filed_at=datetime(2026, 7, 22, 15, 0, tzinfo=timezone.utc),
        form_url=f"https://www.sec.gov/Archives/example/{name}",
    )


def test_parse_ceo_open_market_buy():
    txs = _parse("form4_ceo_buy.xml", "0001")
    assert len(txs) == 1
    tx = txs[0]
    assert tx.ticker == "AAPL"
    assert tx.side == TransactionSide.BUY
    assert tx.code == "P"
    assert tx.shares == 25000
    assert tx.value == 25000 * 190.5
    assert "ceo" in [r.value for r in tx.roles]


def test_cluster_buy_ranks_as_long():
    txs = _parse("form4_ceo_buy.xml", "0001") + _parse("form4_cfo_buy.xml", "0002")
    settings = Settings(lookback_days=14, min_buy_value=25_000)
    result = build_trade_ideas(txs, settings=settings, now=datetime(2026, 7, 23, tzinfo=timezone.utc))
    assert result.filings_considered == 2
    assert len(result.ideas) == 1
    idea = result.ideas[0]
    assert idea.ticker == "AAPL"
    assert idea.side == "long"
    assert idea.grade in {"A", "B", "C"}
    assert idea.unique_buyers == 2
    assert idea.timing.entry_window_start.isoformat() == "2026-07-22"
    assert idea.timing.target_exit_end > idea.timing.entry_window_end
    assert "not investment advice" in result.disclaimer.lower()


def test_ignores_option_award_noise():
    xml = """<?xml version="1.0"?>
    <ownershipDocument>
      <issuer><issuerCik>1</issuerCik><issuerName>X</issuerName><issuerTradingSymbol>XYZ</issuerTradingSymbol></issuer>
      <reportingOwner>
        <reportingOwnerId><rptOwnerName>Someone</rptOwnerName></reportingOwnerId>
        <reportingOwnerRelationship><isOfficer>1</isOfficer><officerTitle>VP</officerTitle></reportingOwnerRelationship>
      </reportingOwner>
      <nonDerivativeTable>
        <nonDerivativeTransaction>
          <transactionDate><value>2026-07-20</value></transactionDate>
          <transactionCoding><transactionCode>A</transactionCode><transactionAcquiredDisposedCode>A</transactionAcquiredDisposedCode></transactionCoding>
          <transactionAmounts><transactionShares><value>10000</value></transactionShares><transactionPricePerShare><value>0</value></transactionPricePerShare></transactionAmounts>
          <postTransactionAmounts><sharesOwnedFollowingTransaction><value>10000</value></sharesOwnedFollowingTransaction></postTransactionAmounts>
          <ownershipNature><directOrIndirectOwnership><value>D</value></directOrIndirectOwnership></ownershipNature>
        </nonDerivativeTransaction>
      </nonDerivativeTable>
    </ownershipDocument>
    """
    client = SecEdgarClient(Settings())
    txs = client.parse_ownership_xml(
        xml,
        accession="x",
        filed_at=datetime(2026, 7, 22, tzinfo=timezone.utc),
        form_url="https://example.com/x.xml",
    )
    assert txs == []
