package com.orija.insiderscout.data

import java.time.LocalDate
import java.time.OffsetDateTime

enum class OwnerRole { CEO, CFO, OFFICER, DIRECTOR, TEN_PERCENT, OTHER }
enum class TransactionSide { BUY, SELL }
enum class IdeaSide { LONG, WATCH, AVOID }

data class InsiderTransaction(
    val accession: String,
    val filedAt: OffsetDateTime,
    val transactionDate: LocalDate?,
    val issuerCik: String,
    val issuerName: String,
    val ticker: String?,
    val ownerName: String,
    val roles: List<OwnerRole>,
    val officerTitle: String?,
    val side: TransactionSide,
    val code: String,
    val shares: Double,
    val price: Double?,
    val value: Double?,
    val formUrl: String,
    val isDerivative: Boolean = false,
)

data class SignalFactors(
    val openMarketBuy: Double = 0.0,
    val clusterBuying: Double = 0.0,
    val roleWeight: Double = 0.0,
    val sizeConviction: Double = 0.0,
    val recency: Double = 0.0,
    val multiDayAccumulation: Double = 0.0,
    val sellPressurePenalty: Double = 0.0,
)

data class TradeTiming(
    val entryWindowStart: LocalDate,
    val entryWindowEnd: LocalDate,
    val reviewDate: LocalDate,
    val targetExitStart: LocalDate,
    val targetExitEnd: LocalDate,
    val stopReviewDays: Int,
    val rationale: String,
)

data class TradeIdea(
    val ticker: String,
    val issuerName: String,
    val issuerCik: String,
    val side: IdeaSide,
    val rankScore: Double,
    val grade: String,
    val summary: String,
    val factors: SignalFactors,
    val timing: TradeTiming,
    val transactions: List<InsiderTransaction>,
    val totalBuyValue: Double,
    val totalSellValue: Double,
    val uniqueBuyers: Int,
    val uniqueSellers: Int,
    val formUrls: List<String>,
    val caveats: List<String>,
)

data class ScanResult(
    val scannedAt: OffsetDateTime,
    val lookbackDays: Int,
    val filingsConsidered: Int,
    val ideas: List<TradeIdea>,
    val disclaimer: String,
)
