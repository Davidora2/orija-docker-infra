package com.orija.insiderscout.data

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.OffsetDateTime
import java.time.ZoneOffset

class TradeIdeaScorerTest {
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
