package com.orija.insiderscout.data.politics

import com.orija.insiderscout.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern

class PoliticsRepository(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .followRedirects(true)
        .build(),
    private val userAgent: String = BuildConfig.SEC_USER_AGENT,
) {
    suspend fun loadFeed(country: Country, limit: Int = 40): List<PoliticianDisclosure> =
        withContext(Dispatchers.IO) {
            when (country) {
                Country.US -> loadUsTrades(limit)
                Country.UK -> loadUkInterests(limit)
                Country.CA -> loadCanadaMembers(limit)
            }
        }

    suspend fun loadChart(ticker: String, range: String = "2y"): List<PricePoint> =
        withContext(Dispatchers.IO) {
            fetchYahooChart(ticker, range)
        }

    fun performanceFor(
        disclosure: PoliticianDisclosure,
        points: List<PricePoint>,
    ): TradePerformance {
        if (points.isEmpty()) {
            return TradePerformance(disclosure, points, null, null, null, null)
        }
        val now = points.last().close
        val tradePx = disclosure.tradeDate?.let { d -> priceOnOrAfter(points, d) }
        val filedPx = disclosure.filedDate?.let { d -> priceOnOrAfter(points, d) }
        fun ret(base: Double?): Double? =
            if (base != null && base > 0) ((now - base) / base) * 100.0 else null
        return TradePerformance(
            disclosure = disclosure,
            points = points,
            priceAtTrade = tradePx,
            priceNow = now,
            returnSinceTradePct = ret(tradePx),
            returnSinceDisclosurePct = ret(filedPx ?: tradePx),
        )
    }

    private fun priceOnOrAfter(points: List<PricePoint>, date: LocalDate): Double? {
        val hit = points.firstOrNull { !it.date.isBefore(date) } ?: points.lastOrNull()
        return hit?.close
    }

    private fun loadUsTrades(limit: Int): List<PoliticianDisclosure> {
        val body = httpGet("$CONGRESS_API/trades/recent?limit=$limit&days=120")
            ?: httpGet("$CONGRESS_API/trades?limit=$limit")
            ?: return emptyList()
        val root = JSONObject(body)
        val trades = root.optJSONArray("trades") ?: return emptyList()
        val out = mutableListOf<PoliticianDisclosure>()
        for (i in 0 until trades.length()) {
            val t = trades.getJSONObject(i)
            val memberName = t.optString("member").ifBlank { continueLabel(t) }
            val ticker = t.optString("ticker").ifBlank { null }
            val asset = t.optString("asset").ifBlank { ticker ?: "Undisclosed asset" }
            val side = when (t.optString("trade_type").lowercase(Locale.US)) {
                "buy", "purchase" -> TradeSide.BUY
                "sell", "sale" -> TradeSide.SELL
                "exchange" -> TradeSide.EXCHANGE
                else -> TradeSide.UNKNOWN
            }
            val privateLike = ticker.isNullOrBlank() ||
                asset.contains("non-public", true) ||
                asset.contains("private", true) ||
                asset.contains("[OS]", true) // other securities
            out += PoliticianDisclosure(
                id = "us-${t.optString("link").hashCode()}-$i",
                member = ServingMember(
                    id = "us-$memberName",
                    name = memberName,
                    country = Country.US,
                    chamber = t.optString("chamber").ifBlank { null },
                    party = null,
                    districtOrRiding = null,
                ),
                kind = if (privateLike) DisclosureKind.PRIVATE_COMPANY else DisclosureKind.PUBLIC_TRADE,
                side = side,
                ticker = ticker,
                assetName = asset.lines().first().take(120),
                amountRange = t.optString("amount").replace("\n", " ").ifBlank { null },
                tradeDate = parseDate(t.optString("tx_date")),
                filedDate = parseDate(t.optString("disclosed")),
                isPrivateCompany = privateLike,
                summary = buildString {
                    append(memberName)
                    append(" · ")
                    append(side.name.lowercase().replaceFirstChar { it.titlecase(Locale.US) })
                    if (!ticker.isNullOrBlank()) append(" $ticker")
                    t.optString("amount").takeIf { it.isNotBlank() }?.let { append(" · $it") }
                },
                sourceUrl = t.optString("link").ifBlank { null },
                sourceLabel = "STOCK Act PTR",
            )
        }
        return out
    }

    private fun continueLabel(t: JSONObject) = t.optString("politician").ifBlank { "Member of Congress" }

    private fun loadUkInterests(limit: Int): List<PoliticianDisclosure> {
        val search = httpGet(
            "https://members-api.parliament.uk/api/Members/Search?House=1&IsCurrentMember=true&skip=0&take=25",
        ) ?: return emptyList()
        val items = JSONObject(search).optJSONArray("items") ?: return emptyList()
        val memberIds = mutableListOf<Pair<Int, ServingMember>>()
        for (i in 0 until items.length()) {
            val v = items.getJSONObject(i).getJSONObject("value")
            val id = v.getInt("id")
            val party = v.optJSONObject("latestParty")?.optString("name")
            val ridingObj = v.optJSONObject("latestHouseMembership")
            val riding = ridingObj?.optString("membershipFrom")?.ifBlank { null }
            memberIds += id to ServingMember(
                id = "uk-$id",
                name = v.optString("nameDisplayAs"),
                country = Country.UK,
                chamber = "House of Commons",
                party = party,
                districtOrRiding = riding,
                photoUrl = v.optString("thumbnailUrl").ifBlank { null },
                profileUrl = "https://members.parliament.uk/member/$id",
            )
        }

        val out = mutableListOf<PoliticianDisclosure>()
        // Sequential to respect Parliament API; take first N private-company-ish interests.
        for ((id, member) in memberIds) {
            if (out.size >= limit) break
            val raw = httpGet("https://members-api.parliament.uk/api/Members/$id/RegisteredInterests")
                ?: continue
            val cats = JSONObject(raw).optJSONArray("value") ?: continue
            for (c in 0 until cats.length()) {
                val cat = cats.getJSONObject(c)
                val catName = cat.optString("name")
                val interests = cat.optJSONArray("interests") ?: continue
                val kind = classifyUkCategory(catName)
                val privateish = kind != DisclosureKind.OTHER ||
                    catName.contains("share", true) ||
                    catName.contains("direct", true) ||
                    catName.contains("compan", true)
                if (!privateish && kind == DisclosureKind.OTHER) continue
                for (j in 0 until interests.length()) {
                    if (out.size >= limit) break
                    val interest = interests.getJSONObject(j)
                    val text = interest.optString("interest").trim()
                    if (text.isBlank()) continue
                    val company = extractCompanyName(text)
                    out += PoliticianDisclosure(
                        id = "uk-$id-${interest.optInt("id")}",
                        member = member,
                        kind = kind,
                        ticker = null,
                        assetName = company ?: text.lineSequence().first().take(100),
                        amountRange = null,
                        tradeDate = null,
                        filedDate = null,
                        isPrivateCompany = true,
                        summary = "${member.name} · $catName",
                        sourceUrl = member.profileUrl,
                        sourceLabel = "UK Register of Members' Financial Interests",
                    )
                }
            }
        }
        return out.take(limit)
    }

    private fun loadCanadaMembers(limit: Int): List<PoliticianDisclosure> {
        val body = httpGet("https://api.openparliament.ca/politicians/?format=json&limit=$limit")
            ?: return emptyList()
        val objects = JSONObject(body).optJSONArray("objects") ?: return emptyList()
        val out = mutableListOf<PoliticianDisclosure>()
        for (i in 0 until objects.length()) {
            val o = objects.getJSONObject(i)
            val name = o.optString("name")
            val url = o.optString("url")
            val party = o.optJSONObject("current_party")
                ?.optJSONObject("short_name")
                ?.optString("en")
            val riding = o.optJSONObject("current_riding")
            val ridingName = riding?.optJSONObject("name")?.optString("en")
            val province = riding?.optString("province")
            val image = o.optString("image").ifBlank { null }?.let {
                if (it.startsWith("http")) it else "https://api.openparliament.ca$it"
            }
            val commons = "https://www.ourcommons.ca"
            val member = ServingMember(
                id = "ca-$url",
                name = name,
                country = Country.CA,
                chamber = "House of Commons",
                party = party,
                districtOrRiding = listOfNotNull(ridingName, province).joinToString(", ").ifBlank { null },
                photoUrl = image,
                profileUrl = if (url.startsWith("http")) url else "https://openparliament.ca$url",
            )
            // Canada does not publish STOCK Act-style trade feeds; surface serving members with
            // deep links to the Conflict of Interest public registry and Commons profile.
            out += PoliticianDisclosure(
                id = "ca-registry-$i",
                member = member,
                kind = DisclosureKind.PRIVATE_COMPANY,
                ticker = null,
                assetName = "Public registry disclosures (assets, controlled assets, private interests)",
                amountRange = null,
                tradeDate = null,
                filedDate = null,
                isPrivateCompany = true,
                summary = "$name · serving MP — review Conflict of Interest & Ethics Commissioner filings for private-company holdings",
                sourceUrl = "https://ciec-ccie.parl.gc.ca/en/public-registries/Pages/default.aspx",
                sourceLabel = "Canada Conflict of Interest public registry",
            )
            // Also keep a commons profile disclosure pointer.
            out += PoliticianDisclosure(
                id = "ca-profile-$i",
                member = member,
                kind = DisclosureKind.OTHER,
                assetName = "Member profile & affiliations",
                isPrivateCompany = false,
                summary = "$name · ${party ?: "MP"} · ${member.districtOrRiding ?: "Canada"}",
                sourceUrl = member.profileUrl ?: commons,
                sourceLabel = "OpenParliament / Commons",
            )
            if (out.size >= limit) break
        }
        return out.take(limit)
    }

    private fun fetchYahooChart(ticker: String, range: String): List<PricePoint> {
        val symbol = ticker.trim().uppercase(Locale.US)
        if (symbol.isBlank() || symbol == "N/A" || symbol == "--") return emptyList()
        val url =
            "https://query2.finance.yahoo.com/v8/finance/chart/$symbol?interval=1d&range=$range"
        val body = httpGet(url, browserish = true) ?: return emptyList()
        val result = JSONObject(body)
            .optJSONObject("chart")
            ?.optJSONArray("result")
            ?.optJSONObject(0)
            ?: return emptyList()
        val timestamps = result.optJSONArray("timestamp") ?: return emptyList()
        val closes = result.optJSONObject("indicators")
            ?.optJSONArray("quote")
            ?.optJSONObject(0)
            ?.optJSONArray("close")
            ?: return emptyList()
        val out = mutableListOf<PricePoint>()
        for (i in 0 until minOf(timestamps.length(), closes.length())) {
            if (closes.isNull(i)) continue
            val epoch = timestamps.getLong(i)
            val close = closes.getDouble(i)
            if (close <= 0) continue
            out += PricePoint(
                date = Instant.ofEpochSecond(epoch).atZone(ZoneOffset.UTC).toLocalDate(),
                close = close,
            )
        }
        return out
    }

    private fun httpGet(url: String, browserish: Boolean = false): String? {
        repeat(3) { attempt ->
            try {
                val req = Request.Builder()
                    .url(url)
                    .header("User-Agent", if (browserish) BROWSER_UA else userAgent)
                    .header("Accept", "application/json, text/plain, */*")
                    .build()
                client.newCall(req).execute().use { resp ->
                    if (resp.code == 429 || resp.code == 503) {
                        Thread.sleep(400L * (attempt + 1))
                        return@use
                    }
                    if (!resp.isSuccessful) return null
                    return resp.body?.string()
                }
            } catch (_: Exception) {
                Thread.sleep(300L * (attempt + 1))
            }
        }
        return null
    }

    private fun parseDate(raw: String?): LocalDate? {
        if (raw.isNullOrBlank()) return null
        val v = raw.trim().take(10)
        return runCatching { LocalDate.parse(v) }.getOrNull()
            ?: runCatching {
                LocalDate.parse(v, DateTimeFormatter.ofPattern("M/d/yyyy"))
            }.getOrNull()
    }

    private fun classifyUkCategory(name: String): DisclosureKind {
        val n = name.lowercase(Locale.UK)
        return when {
            "shareholding" in n || "shareholdings" in n -> DisclosureKind.SHAREHOLDING
            "directorship" in n || "director" in n -> DisclosureKind.DIRECTORSHIP
            "employment" in n || "remunerated" in n -> DisclosureKind.EMPLOYMENT
            "partnership" in n || "partner" in n -> DisclosureKind.PARTNERSHIP
            "compan" in n -> DisclosureKind.PRIVATE_COMPANY
            else -> DisclosureKind.OTHER
        }
    }

    private fun extractCompanyName(text: String): String? {
        val patterns = listOf(
            Pattern.compile("Name of company or organisation:\\s*(.+)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("Payer:\\s*(.+)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("Director,?\\s*(.+?)\\s*\\(", Pattern.CASE_INSENSITIVE),
            Pattern.compile("Partner[^\\n]*Payer:\\s*(.+)", Pattern.CASE_INSENSITIVE),
        )
        for (p in patterns) {
            val m = p.matcher(text)
            if (m.find()) return m.group(1)?.trim()?.lineSequence()?.first()?.take(100)
        }
        return null
    }

    companion object {
        private const val CONGRESS_API = "https://congressinfor-production.up.railway.app"
        private const val BROWSER_UA =
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    }
}
