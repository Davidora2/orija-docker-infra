package com.orija.insiderscout.data

import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import kotlin.math.max
import kotlin.math.min

object TradeIdeaScorer {
    const val DISCLAIMER =
        "Educational research only — not investment advice, not an offer to buy or sell securities, " +
            "and not a recommendation to trade on material non-public information. Insider Form 4 data is " +
            "public after filing. Past patterns do not predict future results. Do your own due diligence."

    private val roleWeights = mapOf(
        OwnerRole.CEO to 1.0,
        OwnerRole.CFO to 0.9,
        OwnerRole.OFFICER to 0.7,
        OwnerRole.DIRECTOR to 0.55,
        OwnerRole.TEN_PERCENT to 0.45,
        OwnerRole.OTHER to 0.25,
    )

    fun buildTradeIdeas(
        transactions: List<InsiderTransaction>,
        lookbackDays: Int,
        minBuyValue: Double = 25_000.0,
        now: OffsetDateTime = OffsetDateTime.now(ZoneOffset.UTC),
    ): ScanResult {
        val today = now.toLocalDate()
        val byIssuer = transactions.groupBy {
            (it.ticker ?: it.issuerCik.ifBlank { it.issuerName }).uppercase()
        }
        val ideas = byIssuer.values.mapNotNull { scoreIssuer(it, today, minBuyValue) }
        val sideRank = mapOf(IdeaSide.LONG to 0, IdeaSide.WATCH to 1, IdeaSide.AVOID to 2)
        val ranked = ideas.sortedWith(
            compareBy<TradeIdea> { sideRank[it.side] ?: 9 }.thenByDescending { it.rankScore }
        )
        return ScanResult(
            scannedAt = now,
            lookbackDays = lookbackDays,
            filingsConsidered = transactions.map { it.accession }.toSet().size,
            ideas = ranked,
            disclaimer = DISCLAIMER,
        )
    }

    private fun scoreIssuer(
        txs: List<InsiderTransaction>,
        today: LocalDate,
        minBuyValue: Double,
    ): TradeIdea? {
        val buys = txs.filter { it.side == TransactionSide.BUY && !it.isDerivative }
        val sells = txs.filter { it.side == TransactionSide.SELL }
        if (buys.isEmpty() && sells.isEmpty()) return null

        val totalBuy = buys.sumOf { it.value ?: 0.0 }
        val totalSell = sells.sumOf { it.value ?: 0.0 }
        val buyers = buys.map { it.ownerName }.toSet()
        val sellers = sells.map { it.ownerName }.toSet()
        val meaningfulBuys = buys.filter { (it.value ?: 0.0) >= minBuyValue * 0.2 }

        if (meaningfulBuys.isEmpty() && totalBuy < minBuyValue) {
            return if (totalSell >= minBuyValue * 2) {
                sellPressureIdea(txs, buys, sells, today)
            } else null
        }

        val latestFile = txs.maxOf { it.filedAt }.toLocalDate()
        val daysSince = max(0, today.toEpochDay() - latestFile.toEpochDay()).toInt()
        val openMarket = clamp(meaningfulBuys.size / 3.0)
        val cluster = when {
            buyers.size >= 3 -> 1.0
            buyers.size == 2 -> 0.7
            buyers.size == 1 && totalBuy >= minBuyValue -> 0.35
            else -> 0.0
        }
        val rolePool = if (meaningfulBuys.isNotEmpty()) meaningfulBuys else buys
        val role = rolePool.map { bestRoleWeight(it.roles) }.average()
        val size = clamp(totalBuy / (minBuyValue * 8.0))
        val recency = clamp(1.0 - daysSince / 14.0)
        val buyDates = buys.mapNotNull { it.transactionDate }.toSet()
        val multi = when {
            buyDates.size >= 3 -> 1.0
            buyDates.size == 2 -> 0.6
            else -> 0.0
        }
        val sellPenalty = when {
            totalSell > 0 && totalBuy > 0 -> clamp(totalSell / max(totalBuy, 1.0) / 2.0)
            totalSell > totalBuy -> 0.85
            else -> 0.0
        }

        val factors = SignalFactors(
            openMarketBuy = round3(openMarket),
            clusterBuying = round3(cluster),
            roleWeight = round3(role),
            sizeConviction = round3(size),
            recency = round3(recency),
            multiDayAccumulation = round3(multi),
            sellPressurePenalty = round3(sellPenalty),
        )
        val raw = 28 * openMarket + 22 * cluster + 18 * role + 14 * size + 10 * recency + 8 * multi - 25 * sellPenalty
        val score = round1(clamp(raw, 0.0, 100.0))
        val grade = grade(score)
        val ticker = txs.firstNotNullOfOrNull { it.ticker } ?: txs.first().issuerCik
        val side = when {
            score >= 50 && totalBuy > totalSell -> IdeaSide.LONG
            sellPenalty >= 0.6 && totalSell > totalBuy -> IdeaSide.AVOID
            else -> IdeaSide.WATCH
        }
        return TradeIdea(
            ticker = ticker,
            issuerName = txs.first().issuerName,
            issuerCik = txs.first().issuerCik,
            side = side,
            rankScore = score,
            grade = grade,
            summary = summary(side, ticker, buyers.size, totalBuy, totalSell, rolePool),
            factors = factors,
            timing = timingFor(side, latestFile, score),
            transactions = txs.sortedByDescending { it.filedAt },
            totalBuyValue = round2(totalBuy),
            totalSellValue = round2(totalSell),
            uniqueBuyers = buyers.size,
            uniqueSellers = sellers.size,
            formUrls = txs.map { it.formUrl }.distinct().sorted(),
            caveats = listOf(
                "Form 4 purchases can reflect 10b5-1 plans, tax events, or incomplete context.",
                "Prefer waiting until the filing is public and liquidity/spread look acceptable.",
                "Size positions small; this scout does not model fundamentals or catalysts.",
            ),
        )
    }

    private fun sellPressureIdea(
        txs: List<InsiderTransaction>,
        buys: List<InsiderTransaction>,
        sells: List<InsiderTransaction>,
        today: LocalDate,
    ): TradeIdea {
        val totalBuy = buys.sumOf { it.value ?: 0.0 }
        val totalSell = sells.sumOf { it.value ?: 0.0 }
        val latestFile = txs.maxOf { it.filedAt }.toLocalDate()
        val recency = clamp(1.0 - max(0, today.toEpochDay() - latestFile.toEpochDay()) / 14.0)
        val score = round1(20 + 15 * recency)
        val ticker = txs.firstNotNullOfOrNull { it.ticker } ?: txs.first().issuerCik
        return TradeIdea(
            ticker = ticker,
            issuerName = txs.first().issuerName,
            issuerCik = txs.first().issuerCik,
            side = IdeaSide.AVOID,
            rankScore = score,
            grade = grade(score),
            summary = "Elevated insider selling (\$${fmt(totalSell)}) with little open-market buying (\$${fmt(totalBuy)}). Prefer avoid / wait-for-clarity.",
            factors = SignalFactors(sellPressurePenalty = 0.9, recency = round3(recency)),
            timing = timingFor(IdeaSide.AVOID, latestFile, score),
            transactions = txs.sortedByDescending { it.filedAt },
            totalBuyValue = round2(totalBuy),
            totalSellValue = round2(totalSell),
            uniqueBuyers = buys.map { it.ownerName }.toSet().size,
            uniqueSellers = sells.map { it.ownerName }.toSet().size,
            formUrls = txs.map { it.formUrl }.distinct().sorted(),
            caveats = listOf("Insider sales are often planned and less informative than open-market buys."),
        )
    }

    private fun timingFor(side: IdeaSide, filedOn: LocalDate, score: Double): TradeTiming {
        val (entryEnd, review, exitStart, exitEnd, stopDays, rationale) = when {
            score >= 70 -> TimingParts(
                filedOn.plusDays(5),
                filedOn.plusDays(21),
                filedOn.plusDays(30),
                filedOn.plusDays(90),
                15,
                "Higher-conviction signal: consider entries within ~1 week of the public filing, reassess around 3 weeks, and plan a 1–3 month exit window unless thesis strengthens.",
            )
            score >= 50 -> TimingParts(
                filedOn.plusDays(7),
                filedOn.plusDays(28),
                filedOn.plusDays(45),
                filedOn.plusDays(120),
                20,
                "Moderate signal: allow up to a week after filing, review near one month, and target a 1.5–4 month hold with tight invalidation.",
            )
            else -> TimingParts(
                filedOn.plusDays(3),
                filedOn.plusDays(14),
                filedOn.plusDays(21),
                filedOn.plusDays(60),
                10,
                "Low conviction or sell-pressure name: keep any risk tiny, revisit within two weeks, and default to standing down.",
            )
        }
        return if (side == IdeaSide.AVOID) {
            TradeTiming(
                entryWindowStart = filedOn,
                entryWindowEnd = filedOn,
                reviewDate = filedOn.plusDays(14),
                targetExitStart = filedOn,
                targetExitEnd = filedOn,
                stopReviewDays = stopDays,
                rationale = "Net insider selling / weak buy quality — no long entry suggested. Revisit only if fresh open-market buying appears.",
            )
        } else {
            TradeTiming(
                entryWindowStart = filedOn,
                entryWindowEnd = entryEnd,
                reviewDate = review,
                targetExitStart = exitStart,
                targetExitEnd = exitEnd,
                stopReviewDays = stopDays,
                rationale = rationale,
            )
        }
    }

    private data class TimingParts(
        val entryEnd: LocalDate,
        val review: LocalDate,
        val exitStart: LocalDate,
        val exitEnd: LocalDate,
        val stopDays: Int,
        val rationale: String,
    )

    private fun summary(
        side: IdeaSide,
        ticker: String,
        buyers: Int,
        totalBuy: Double,
        totalSell: Double,
        roles: List<InsiderTransaction>,
    ): String {
        val topRole = when {
            roles.any { OwnerRole.CEO in it.roles } -> "CEO"
            roles.any { OwnerRole.CFO in it.roles } -> "CFO"
            roles.any { OwnerRole.OFFICER in it.roles } -> roles.first { OwnerRole.OFFICER in it.roles }.officerTitle ?: "officer"
            roles.any { OwnerRole.DIRECTOR in it.roles } -> "director"
            else -> "insider"
        }
        val action = when (side) {
            IdeaSide.LONG -> "Candidate long"
            IdeaSide.WATCH -> "Watchlist only"
            IdeaSide.AVOID -> "Avoid / stand aside"
        }
        return "$action on $ticker: $buyers buyer(s) including $topRole, \$${fmt(totalBuy)} open-market buys vs \$${fmt(totalSell)} sells in the scan window."
    }

    private fun bestRoleWeight(roles: List<OwnerRole>): Double =
        roles.maxOfOrNull { roleWeights[it] ?: 0.25 } ?: 0.25

    private fun grade(score: Double): String = when {
        score >= 80 -> "A"
        score >= 65 -> "B"
        score >= 50 -> "C"
        score >= 35 -> "D"
        else -> "F"
    }

    private fun clamp(x: Double, lo: Double = 0.0, hi: Double = 1.0) = min(hi, max(lo, x))
    private fun round3(x: Double) = kotlin.math.round(x * 1000.0) / 1000.0
    private fun round1(x: Double) = kotlin.math.round(x * 10.0) / 10.0
    private fun round2(x: Double) = kotlin.math.round(x * 100.0) / 100.0
    private fun fmt(x: Double) = "%,.0f".format(x)
}
