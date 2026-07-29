package com.orija.insiderscout.data

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.OffsetDateTime
import java.time.ZoneOffset

class TradeIdeaScorerTest {
    @Test
    fun parsesAtomFeedEntries() {
        val atom = """
            <?xml version="1.0" encoding="ISO-8859-1" ?>
            <feed xmlns="http://www.w3.org/2005/Atom">
              <entry>
                <title>4 - Example Corp (0001234567) (Issuer)</title>
                <link href="https://www.sec.gov/Archives/edgar/data/1234567/000123456726000001/0001234567-26-000001-index.htm"/>
                <id>tag:www.sec.gov,2008:accession-number=0001234567-26-000001</id>
                <updated>2026-07-29T15:00:00-04:00</updated>
              </entry>
            </feed>
        """.trimIndent()
        val client = SecEdgarClient()
        val method = SecEdgarClient::class.java.getDeclaredMethod("parseAtom", String::class.java)
        method.isAccessible = true
        @Suppress("UNCHECKED_CAST")
        val entries = method.invoke(client, atom) as List<*>
        assertEquals(1, entries.size)
    }

    @Test
    fun clusterBuyRanksAsLong() {
        val filed = OffsetDateTime.of(2026, 7, 22, 15, 0, 0, 0, ZoneOffset.UTC)
        val client = SecEdgarClient()
        val ceoXml = """
            <?xml version="1.0"?>
            <ownershipDocument>
              <issuer><issuerCik>0000320193</issuerCik><issuerName>APPLE INC</issuerName><issuerTradingSymbol>AAPL</issuerTradingSymbol></issuer>
              <reportingOwner>
                <reportingOwnerId><rptOwnerName>COOK TIMOTHY D</rptOwnerName></reportingOwnerId>
                <reportingOwnerRelationship><isDirector>1</isDirector><isOfficer>1</isOfficer><officerTitle>Chief Executive Officer</officerTitle></reportingOwnerRelationship>
              </reportingOwner>
              <nonDerivativeTable>
                <nonDerivativeTransaction>
                  <transactionDate><value>2026-07-20</value></transactionDate>
                  <transactionCoding><transactionCode>P</transactionCode><transactionAcquiredDisposedCode>A</transactionAcquiredDisposedCode></transactionCoding>
                  <transactionAmounts>
                    <transactionShares><value>25000</value></transactionShares>
                    <transactionPricePerShare><value>190.50</value></transactionPricePerShare>
                  </transactionAmounts>
                </nonDerivativeTransaction>
              </nonDerivativeTable>
            </ownershipDocument>
        """.trimIndent()
        val cfoXml = ceoXml
            .replace("COOK TIMOTHY D", "MAESTRI LUCA")
            .replace("Chief Executive Officer", "Chief Financial Officer")
            .replace("25000", "12000")
            .replace("190.50", "191.00")

        val txs = client.parseOwnershipXml(ceoXml, "0001", filed, "https://example.com/1.xml") +
            client.parseOwnershipXml(cfoXml, "0002", filed, "https://example.com/2.xml")

        val result = TradeIdeaScorer.buildTradeIdeas(
            transactions = txs,
            lookbackDays = 14,
            now = OffsetDateTime.of(2026, 7, 23, 0, 0, 0, 0, ZoneOffset.UTC),
        )
        assertEquals(1, result.ideas.size)
        val idea = result.ideas.first()
        assertEquals("AAPL", idea.ticker)
        assertEquals(IdeaSide.LONG, idea.side)
        assertTrue(idea.rankScore >= 50)
        assertTrue(idea.timing.targetExitEnd > idea.timing.entryWindowEnd)
    }

    @Test
    fun ignoresAwardNoise() = runBlocking {
        val client = SecEdgarClient()
        val xml = """
            <?xml version="1.0"?>
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
                  <transactionAmounts>
                    <transactionShares><value>10000</value></transactionShares>
                    <transactionPricePerShare><value>0</value></transactionPricePerShare>
                  </transactionAmounts>
                </nonDerivativeTransaction>
              </nonDerivativeTable>
            </ownershipDocument>
        """.trimIndent()
        val txs = client.parseOwnershipXml(
            xml,
            "x",
            OffsetDateTime.now(ZoneOffset.UTC),
            "https://example.com/x.xml",
        )
        assertTrue(txs.isEmpty())
    }
}
