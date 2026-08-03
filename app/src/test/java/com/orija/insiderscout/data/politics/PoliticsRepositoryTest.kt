package com.orija.insiderscout.data.politics

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class PoliticsRepositoryTest {
    @Test
    fun performanceUsesTradeAnchor() {
        val repo = PoliticsRepository()
        val disclosure = PoliticianDisclosure(
            id = "t1",
            member = ServingMember("1", "Test Member", Country.US, "House", "D", "NY"),
            kind = DisclosureKind.PUBLIC_TRADE,
            side = TradeSide.BUY,
            ticker = "NGD",
            assetName = "New Gold",
            amountRange = "$1,001 - $15,000",
            tradeDate = LocalDate.of(2024, 3, 21),
            filedDate = LocalDate.of(2024, 4, 1),
            summary = "test",
        )
        val points = listOf(
            PricePoint(LocalDate.of(2024, 3, 20), 1.50),
            PricePoint(LocalDate.of(2024, 3, 21), 1.63),
            PricePoint(LocalDate.of(2024, 6, 1), 3.00),
            PricePoint(LocalDate.of(2025, 1, 1), 9.08),
        )
        val perf = repo.performanceFor(disclosure, points)
        assertEquals(1.63, perf.priceAtTrade!!, 0.001)
        assertEquals(9.08, perf.priceNow!!, 0.001)
        assertTrue(perf.returnSinceTradePct!! > 400.0)
    }
}
