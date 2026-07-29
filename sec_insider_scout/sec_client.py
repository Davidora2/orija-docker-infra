from __future__ import annotations

import asyncio
import logging
import re
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import httpx

from .config import Settings, get_settings
from .models import InsiderTransaction, OwnerRole, TransactionSide

logger = logging.getLogger(__name__)

SEC_ATOM = (
    "https://www.sec.gov/cgi-bin/browse-edgar"
    "?action=getcurrent&type=4&company=&dateb=&owner=only"
    "&start={start}&count={count}&output=atom"
)
SEC_ARCHIVES = "https://www.sec.gov/Archives/edgar/data"


def _local(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _text(node: ET.Element | None) -> str | None:
    if node is None or node.text is None:
        return None
    value = node.text.strip()
    return value or None


def _find_text(parent: ET.Element, *paths: str) -> str | None:
    for path in paths:
        node = parent.find(path)
        if node is None:
            # try without namespaces by walking
            parts = path.split("/")
            cur: ET.Element | None = parent
            for part in parts:
                if cur is None:
                    break
                cur = next((c for c in cur if _local(c.tag) == part), None)
            if cur is not None and cur.text and cur.text.strip():
                return cur.text.strip()
            continue
        if node.text and node.text.strip():
            return node.text.strip()
    return None


def _parse_float(raw: str | None) -> float | None:
    if raw is None:
        return None
    cleaned = raw.replace(",", "").replace("$", "").strip()
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_date(raw: str | None) -> date | None:
    if not raw:
        return None
    raw = raw.strip()[:10]
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None


def _classify_roles(
    *,
    is_director: bool,
    is_officer: bool,
    is_ten_percent: bool,
    title: str | None,
) -> list[OwnerRole]:
    roles: list[OwnerRole] = []
    title_l = (title or "").lower()
    if is_officer:
        if any(tok in title_l for tok in ("chief executive", "ceo", "co-ceo")):
            roles.append(OwnerRole.CEO)
        elif any(tok in title_l for tok in ("chief financial", "cfo")):
            roles.append(OwnerRole.CFO)
        else:
            roles.append(OwnerRole.OFFICER)
    if is_director:
        roles.append(OwnerRole.DIRECTOR)
    if is_ten_percent:
        roles.append(OwnerRole.TEN_PERCENT)
    if not roles:
        roles.append(OwnerRole.OTHER)
    return roles


def _side_from_code(code: str, acquired_disposed: str | None) -> TransactionSide | None:
    code = (code or "").upper().strip()
    ad = (acquired_disposed or "").upper().strip()
    # Open-market and intentional buys/sells we care about.
    buy_codes = {"P"}
    sell_codes = {"S"}
    if code in buy_codes or (code == "P" and ad == "A"):
        return TransactionSide.BUY
    if code in sell_codes or (code == "S" and ad == "D"):
        return TransactionSide.SELL
    # Awards, gifts, option exercises are usually noise for this scout.
    return None


class SecEdgarClient:
    """Fetches recent Form 4 filings and parses ownership XML."""

    def __init__(self, settings: Settings | None = None, client: httpx.AsyncClient | None = None):
        self.settings = settings or get_settings()
        self._client = client
        self._owns_client = client is None

    async def __aenter__(self) -> SecEdgarClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                headers={
                    "User-Agent": self.settings.sec_user_agent,
                    "Accept-Encoding": "gzip, deflate",
                },
                timeout=self.settings.request_timeout_seconds,
                follow_redirects=True,
            )
        return self

    async def __aexit__(self, *args: Any) -> None:
        if self._owns_client and self._client is not None:
            await self._client.aclose()

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError("SecEdgarClient must be used as an async context manager")
        return self._client

    async def _get(self, url: str, *, retries: int = 3) -> httpx.Response:
        last_exc: Exception | None = None
        for attempt in range(retries):
            try:
                resp = await self.client.get(url)
                if resp.status_code in {429, 503}:
                    await asyncio.sleep(0.8 * (attempt + 1))
                    continue
                return resp
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_exc = exc
                await asyncio.sleep(0.8 * (attempt + 1))
        if last_exc:
            raise last_exc
        raise RuntimeError(f"Failed to GET {url}")

    async def fetch_recent_transactions(
        self,
        *,
        lookback_days: int | None = None,
        max_filings: int | None = None,
    ) -> list[InsiderTransaction]:
        lookback_days = lookback_days or self.settings.lookback_days
        max_filings = max_filings or self.settings.max_filings
        cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)

        entries = await self._fetch_unique_filings(max_filings=max_filings, cutoff=cutoff)

        transactions: list[InsiderTransaction] = []
        sem = asyncio.Semaphore(3)

        async def _one(entry: dict[str, Any]) -> list[InsiderTransaction]:
            async with sem:
                try:
                    return await self._parse_filing(entry)
                except Exception as exc:  # noqa: BLE001 — keep scan resilient
                    logger.warning("Failed to parse %s: %s", entry.get("accession"), exc)
                    return []

        batches = await asyncio.gather(*[_one(e) for e in entries])
        for batch in batches:
            transactions.extend(batch)
        return transactions

    async def _fetch_unique_filings(
        self,
        *,
        max_filings: int,
        cutoff: datetime,
    ) -> list[dict[str, Any]]:
        """Page the current Form 4 Atom feed and keep one row per accession."""
        by_accession: dict[str, dict[str, Any]] = {}
        start = 0
        page_size = 100
        for _ in range(6):
            page = await self._fetch_atom_entries(start=start, count=page_size)
            if not page:
                break
            oldest_on_page = min(e["filed_at"] for e in page)
            for entry in page:
                if entry["filed_at"] < cutoff:
                    continue
                acc = entry["accession"]
                prefer = "(Issuer)" in entry["title"]
                if acc not in by_accession or prefer:
                    by_accession[acc] = entry
            if len(by_accession) >= max_filings or oldest_on_page < cutoff:
                break
            start += page_size
            await asyncio.sleep(0.2)

        ranked = sorted(by_accession.values(), key=lambda e: e["filed_at"], reverse=True)
        return ranked[:max_filings]

    async def _fetch_atom_entries(self, *, start: int, count: int) -> list[dict[str, Any]]:
        url = SEC_ATOM.format(start=start, count=count)
        resp = await self._get(url)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
        entries: list[dict[str, Any]] = []
        for entry in root:
            if _local(entry.tag) != "entry":
                continue
            title = ""
            link = ""
            updated = ""
            summary = ""
            accession = ""
            for child in entry:
                name = _local(child.tag)
                if name == "title" and child.text:
                    title = child.text.strip()
                elif name == "link":
                    link = child.attrib.get("href", link)
                elif name == "updated" and child.text:
                    updated = child.text.strip()
                elif name == "summary" and child.text:
                    summary = child.text.strip()
                elif name == "id" and child.text:
                    m = re.search(r"accession-number=([\d-]+)", child.text)
                    if m:
                        accession = m.group(1)
            if not accession:
                m = re.search(r"/(\d{10}-\d{2}-\d{6})", link)
                if m:
                    accession = m.group(1)
            filed_at = self._parse_updated(updated)
            if not link or not filed_at:
                continue
            entries.append(
                {
                    "title": title,
                    "index_url": link,
                    "filed_at": filed_at,
                    "summary": summary,
                    "accession": accession or link,
                }
            )
        return entries

    @staticmethod
    def _parse_updated(raw: str) -> datetime | None:
        if not raw:
            return None
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            try:
                dt = parsedate_to_datetime(raw)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc)
            except (TypeError, ValueError):
                return None

    async def _parse_filing(self, entry: dict[str, Any]) -> list[InsiderTransaction]:
        index_url = entry["index_url"]
        # HTML index is reliable; *-index.xml is frequently 404 for Form 4.
        resp = await self._get(index_url)
        resp.raise_for_status()
        ownership_url = self._ownership_url_from_html(resp.text, index_url)
        if not ownership_url:
            return []

        doc = await self._get(ownership_url)
        doc.raise_for_status()
        return self.parse_ownership_xml(
            doc.text,
            accession=str(entry["accession"]),
            filed_at=entry["filed_at"],
            form_url=ownership_url,
        )

    def _ownership_url_from_html(self, html: str, index_url: str) -> str | None:
        base = index_url.rsplit("/", 1)[0]
        matches = re.findall(r'href="([^"]+\.xml)"', html, flags=re.I)
        candidates: list[str] = []
        for href in matches:
            if "xsl" in href.lower():
                continue
            if href.startswith("http"):
                candidates.append(href)
            elif href.startswith("/"):
                candidates.append("https://www.sec.gov" + href)
            else:
                candidates.append(f"{base}/{href.split('/')[-1]}")
        # Prefer ownership/primary docs over odd ancillary XML.
        def rank(url: str) -> tuple[int, str]:
            name = url.rsplit("/", 1)[-1].lower()
            score = 0
            if "primary" in name or "form4" in name or "ownership" in name or "rdgdoc" in name:
                score -= 10
            if name.endswith(".xml"):
                score -= 1
            return (score, name)

        candidates.sort(key=rank)
        return candidates[0] if candidates else None

    def parse_ownership_xml(
        self,
        xml_text: str,
        *,
        accession: str,
        filed_at: datetime,
        form_url: str,
    ) -> list[InsiderTransaction]:
        # Strip BOM / processing instructions noise
        xml_text = xml_text.lstrip("\ufeff")
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            # Some filings wrap HTML; try to extract XML island
            m = re.search(r"(<\?xml[\s\S]+</ownershipDocument>)", xml_text, re.I)
            if not m:
                raise
            root = ET.fromstring(m.group(1))

        issuer_cik = _find_text(root, "issuer/issuerCik") or ""
        issuer_name = _find_text(root, "issuer/issuerName") or "Unknown issuer"
        ticker = _find_text(root, "issuer/issuerTradingSymbol")

        owner_name = _find_text(root, "reportingOwner/reportingOwnerId/rptOwnerName") or "Unknown"
        owner_cik = _find_text(root, "reportingOwner/reportingOwnerId/rptOwnerCik")
        rel = next((c for c in root.iter() if _local(c.tag) == "reportingOwnerRelationship"), None)
        is_director = (_find_text(rel, "isDirector") if rel is not None else None) in {"1", "true", "True"}
        is_officer = (_find_text(rel, "isOfficer") if rel is not None else None) in {"1", "true", "True"}
        is_ten = (_find_text(rel, "isTenPercentOwner") if rel is not None else None) in {"1", "true", "True"}
        title = _find_text(rel, "officerTitle") if rel is not None else None
        roles = _classify_roles(
            is_director=bool(is_director),
            is_officer=bool(is_officer),
            is_ten_percent=bool(is_ten),
            title=title,
        )

        results: list[InsiderTransaction] = []
        for table_name, is_derivative in (("nonDerivativeTransaction", False), ("derivativeTransaction", True)):
            for tx in root.iter():
                if _local(tx.tag) != table_name:
                    continue
                code = _find_text(tx, "transactionCoding/transactionCode") or ""
                ad = _find_text(tx, "transactionCoding/transactionAcquiredDisposedCode")
                side = _side_from_code(code, ad)
                if side is None:
                    continue
                shares = _parse_float(_find_text(tx, "transactionAmounts/transactionShares/value"))
                price = _parse_float(_find_text(tx, "transactionAmounts/transactionPricePerShare/value"))
                if shares is None or shares <= 0:
                    continue
                value = shares * price if price is not None else None
                owned_after = _parse_float(
                    _find_text(tx, "postTransactionAmounts/sharesOwnedFollowingTransaction/value")
                )
                direct = (_find_text(tx, "ownershipNature/directOrIndirectOwnership/value") or "D").upper() == "D"
                tx_date = _parse_date(_find_text(tx, "transactionDate/value"))
                results.append(
                    InsiderTransaction(
                        accession=accession,
                        filed_at=filed_at,
                        transaction_date=tx_date,
                        issuer_cik=issuer_cik.lstrip("0") or issuer_cik,
                        issuer_name=issuer_name,
                        ticker=(ticker or "").upper() or None,
                        owner_name=owner_name,
                        owner_cik=owner_cik,
                        roles=roles,
                        officer_title=title,
                        side=side,
                        code=code.upper(),
                        shares=shares,
                        price=price,
                        value=value,
                        shares_owned_after=owned_after,
                        is_direct=direct,
                        form_url=form_url,
                        is_derivative=is_derivative,
                    )
                )
        return results
