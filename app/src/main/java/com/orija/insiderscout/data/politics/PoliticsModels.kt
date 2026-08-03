package com.orija.insiderscout.data.politics

import java.time.LocalDate

enum class Country(val code: String, val label: String) {
    US("US", "United States"),
    UK("UK", "United Kingdom"),
    CA("CA", "Canada"),
}

enum class DisclosureKind {
    PUBLIC_TRADE,
    PRIVATE_COMPANY,
    DIRECTORSHIP,
    SHAREHOLDING,
    EMPLOYMENT,
    PARTNERSHIP,
    OTHER,
}

enum class TradeSide { BUY, SELL, EXCHANGE, UNKNOWN }

data class ServingMember(
    val id: String,
    val name: String,
    val country: Country,
    val chamber: String?,
    val party: String?,
    val districtOrRiding: String?,
    val photoUrl: String? = null,
    val profileUrl: String? = null,
)

data class PoliticianDisclosure(
    val id: String,
    val member: ServingMember,
    val kind: DisclosureKind,
    val side: TradeSide? = null,
    val ticker: String? = null,
    val assetName: String,
    val amountRange: String? = null,
    val tradeDate: LocalDate? = null,
    val filedDate: LocalDate? = null,
    val isPrivateCompany: Boolean = false,
    val summary: String,
    val sourceUrl: String? = null,
    val sourceLabel: String = "Public filing",
)

data class PricePoint(
    val date: LocalDate,
    val close: Double,
)

data class TradePerformance(
    val disclosure: PoliticianDisclosure,
    val points: List<PricePoint>,
    val priceAtTrade: Double?,
    val priceNow: Double?,
    val returnSinceTradePct: Double?,
    val returnSinceDisclosurePct: Double?,
)
