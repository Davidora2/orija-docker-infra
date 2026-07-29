package com.orija.insiderscout.data

import com.orija.insiderscout.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.StringReader
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern

class SecEdgarClient(
    private val userAgent: String = BuildConfig.SEC_USER_AGENT,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .build(),
) {
    suspend fun fetchRecentTransactions(
        lookbackDays: Int = 14,
        maxFilings: Int = 40,
    ): List<InsiderTransaction> = withContext(Dispatchers.IO) {
        val cutoff = OffsetDateTime.now(ZoneOffset.UTC).minusDays(lookbackDays.toLong())
        val entries = fetchUniqueFilings(maxFilings = maxFilings, cutoff = cutoff)
        val semaphore = Semaphore(3)
        coroutineScope {
            entries.map { entry ->
                async {
                    semaphore.withPermit {
                        runCatching { parseFiling(entry) }.getOrDefault(emptyList())
                    }
                }
            }.awaitAll().flatten()
        }
    }

    private suspend fun fetchUniqueFilings(
        maxFilings: Int,
        cutoff: OffsetDateTime,
    ): List<AtomEntry> {
        val byAccession = linkedMapOf<String, AtomEntry>()
        var start = 0
        repeat(5) {
            val page = fetchAtomEntries(start = start, count = 100)
            if (page.isEmpty()) return@repeat
            val oldest = page.minOf { it.filedAt }
            for (entry in page) {
                if (entry.filedAt.isBefore(cutoff)) continue
                val prefer = entry.title.contains("(Issuer)")
                val existing = byAccession[entry.accession]
                if (existing == null || prefer) {
                    byAccession[entry.accession] = entry
                }
            }
            if (byAccession.size >= maxFilings || oldest.isBefore(cutoff)) return@repeat
            start += 100
            delay(200)
        }
        return byAccession.values
            .sortedByDescending { it.filedAt }
            .take(maxFilings)
    }

    private fun fetchAtomEntries(start: Int, count: Int): List<AtomEntry> {
        val url =
            "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&company=&dateb=&owner=only&start=$start&count=$count&output=atom"
        val body = httpGet(url) ?: return emptyList()
        return parseAtom(body)
    }

    private fun parseAtom(xml: String): List<AtomEntry> {
        val factory = XmlPullParserFactory.newInstance()
        factory.isNamespaceAware = true
        val parser = factory.newPullParser()
        parser.setInput(StringReader(xml))
        val entries = mutableListOf<AtomEntry>()
        var event = parser.eventType
        var inEntry = false
        var title = ""
        var link = ""
        var updated = ""
        var id = ""
        while (event != XmlPullParser.END_DOCUMENT) {
            val name = parser.name
            when (event) {
                XmlPullParser.START_TAG -> {
                    if (local(name) == "entry") {
                        inEntry = true
                        title = ""; link = ""; updated = ""; id = ""
                    } else if (inEntry) {
                        when (local(name)) {
                            "title" -> title = parser.nextText().trim()
                            "updated" -> updated = parser.nextText().trim()
                            "id" -> id = parser.nextText().trim()
                            "link" -> {
                                val href = parser.getAttributeValue(null, "href")
                                if (!href.isNullOrBlank()) link = href
                            }
                        }
                    }
                }
                XmlPullParser.END_TAG -> {
                    if (local(name) == "entry" && inEntry) {
                        inEntry = false
                        val accession = extractAccession(id, link) ?: link
                        val filedAt = parseUpdated(updated)
                        if (link.isNotBlank() && filedAt != null) {
                            entries += AtomEntry(title, link, filedAt, accession)
                        }
                    }
                }
            }
            event = parser.next()
        }
        return entries
    }

    private fun parseFiling(entry: AtomEntry): List<InsiderTransaction> {
        val indexHtml = httpGet(entry.indexUrl) ?: return emptyList()
        val ownershipUrl = ownershipUrlFromHtml(indexHtml, entry.indexUrl) ?: return emptyList()
        val xml = httpGet(ownershipUrl) ?: return emptyList()
        return parseOwnershipXml(
            xml = xml,
            accession = entry.accession,
            filedAt = entry.filedAt,
            formUrl = ownershipUrl,
        )
    }

    fun parseOwnershipXml(
        xml: String,
        accession: String,
        filedAt: OffsetDateTime,
        formUrl: String,
    ): List<InsiderTransaction> {
        val cleaned = xml.trimStart('\uFEFF')
        val issuerCik = tagValue(cleaned, "issuerCik").orEmpty().trimStart('0')
        val issuerName = tagValue(cleaned, "issuerName") ?: "Unknown issuer"
        val ticker = tagValue(cleaned, "issuerTradingSymbol")?.uppercase()
        val ownerName = tagValue(cleaned, "rptOwnerName") ?: "Unknown"
        val isDirector = tagValue(cleaned, "isDirector") in truthy
        val isOfficer = tagValue(cleaned, "isOfficer") in truthy
        val isTen = tagValue(cleaned, "isTenPercentOwner") in truthy
        val title = tagValue(cleaned, "officerTitle")
        val roles = classifyRoles(isDirector, isOfficer, isTen, title)

        val results = mutableListOf<InsiderTransaction>()
        results += extractTransactions(
            xml = cleaned,
            tableTag = "nonDerivativeTransaction",
            isDerivative = false,
            accession = accession,
            filedAt = filedAt,
            formUrl = formUrl,
            issuerCik = issuerCik,
            issuerName = issuerName,
            ticker = ticker,
            ownerName = ownerName,
            roles = roles,
            officerTitle = title,
        )
        results += extractTransactions(
            xml = cleaned,
            tableTag = "derivativeTransaction",
            isDerivative = true,
            accession = accession,
            filedAt = filedAt,
            formUrl = formUrl,
            issuerCik = issuerCik,
            issuerName = issuerName,
            ticker = ticker,
            ownerName = ownerName,
            roles = roles,
            officerTitle = title,
        )
        return results
    }

    private fun extractTransactions(
        xml: String,
        tableTag: String,
        isDerivative: Boolean,
        accession: String,
        filedAt: OffsetDateTime,
        formUrl: String,
        issuerCik: String,
        issuerName: String,
        ticker: String?,
        ownerName: String,
        roles: List<OwnerRole>,
        officerTitle: String?,
    ): List<InsiderTransaction> {
        val blocks = extractBlocks(xml, tableTag)
        val out = mutableListOf<InsiderTransaction>()
        for (block in blocks) {
            val code = tagValue(block, "transactionCode")?.uppercase().orEmpty()
            val ad = tagValue(block, "transactionAcquiredDisposedCode")
            val side = sideFromCode(code, ad) ?: continue
            val shares = parseDouble(nestedValue(block, "transactionShares")) ?: continue
            if (shares <= 0) continue
            val price = parseDouble(nestedValue(block, "transactionPricePerShare"))
            val value = if (price != null) shares * price else null
            val txDate = parseDate(nestedValue(block, "transactionDate") ?: tagValue(block, "transactionDate"))
            out += InsiderTransaction(
                accession = accession,
                filedAt = filedAt,
                transactionDate = txDate,
                issuerCik = issuerCik,
                issuerName = issuerName,
                ticker = ticker,
                ownerName = ownerName,
                roles = roles,
                officerTitle = officerTitle,
                side = side,
                code = code,
                shares = shares,
                price = price,
                value = value,
                formUrl = formUrl,
                isDerivative = isDerivative,
            )
        }
        return out
    }

    private fun httpGet(url: String): String? {
        repeat(3) { attempt ->
            try {
                val req = Request.Builder()
                    .url(url)
                    .header("User-Agent", userAgent)
                    .header("Accept-Encoding", "gzip")
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
                Thread.sleep(400L * (attempt + 1))
            }
        }
        return null
    }

    private data class AtomEntry(
        val title: String,
        val indexUrl: String,
        val filedAt: OffsetDateTime,
        val accession: String,
    )

    companion object {
        private val truthy = setOf("1", "true", "True")
        private val accessionPattern = Pattern.compile("accession-number=([\\d-]+)")
        private val accessionInPath = Pattern.compile("/(\\d{10}-\\d{2}-\\d{6})")
        private val hrefXml = Pattern.compile("href=\"([^\"]+\\.xml)\"", Pattern.CASE_INSENSITIVE)

        private fun local(name: String?): String =
            name?.substringAfterLast('}', name)?.substringAfterLast(':') ?: ""

        private fun extractAccession(id: String, link: String): String? {
            val m1 = accessionPattern.matcher(id)
            if (m1.find()) return m1.group(1)
            val m2 = accessionInPath.matcher(link)
            if (m2.find()) return m2.group(1)
            return null
        }

        private fun parseUpdated(raw: String): OffsetDateTime? {
            if (raw.isBlank()) return null
            return runCatching {
                OffsetDateTime.parse(raw.replace("Z", "+00:00"))
            }.getOrNull()
        }

        private fun ownershipUrlFromHtml(html: String, indexUrl: String): String? {
            val base = indexUrl.substringBeforeLast('/')
            val matcher = hrefXml.matcher(html)
            val candidates = mutableListOf<String>()
            while (matcher.find()) {
                val href = matcher.group(1) ?: continue
                if (href.contains("xsl", ignoreCase = true)) continue
                candidates += when {
                    href.startsWith("http") -> href
                    href.startsWith("/") -> "https://www.sec.gov$href"
                    else -> "$base/${href.substringAfterLast('/')}"
                }
            }
            return candidates.minWithOrNull(
                compareBy<String> { url ->
                    val name = url.substringAfterLast('/').lowercase()
                    when {
                        "primary" in name || "form4" in name || "ownership" in name || "rdgdoc" in name -> 0
                        else -> 1
                    }
                }.thenBy { it }
            )
        }

        private fun classifyRoles(
            isDirector: Boolean,
            isOfficer: Boolean,
            isTen: Boolean,
            title: String?,
        ): List<OwnerRole> {
            val roles = mutableListOf<OwnerRole>()
            val titleL = title.orEmpty().lowercase()
            if (isOfficer) {
                roles += when {
                    "chief executive" in titleL || titleL.contains("ceo") -> OwnerRole.CEO
                    "chief financial" in titleL || titleL.contains("cfo") -> OwnerRole.CFO
                    else -> OwnerRole.OFFICER
                }
            }
            if (isDirector) roles += OwnerRole.DIRECTOR
            if (isTen) roles += OwnerRole.TEN_PERCENT
            if (roles.isEmpty()) roles += OwnerRole.OTHER
            return roles
        }

        private fun sideFromCode(code: String, ad: String?): TransactionSide? = when (code) {
            "P" -> TransactionSide.BUY
            "S" -> TransactionSide.SELL
            else -> null
        }

        private fun parseDouble(raw: String?): Double? =
            raw?.replace(",", "")?.replace("$", "")?.trim()?.toDoubleOrNull()

        private fun parseDate(raw: String?): LocalDate? {
            val v = raw?.trim()?.take(10) ?: return null
            return runCatching { LocalDate.parse(v) }.getOrNull()
        }

        private fun tagValue(block: String, tag: String): String? {
            val pattern = Pattern.compile("<$tag(?:\\s[^>]*)?>([^<]*)</$tag>", Pattern.CASE_INSENSITIVE)
            val m = pattern.matcher(block)
            return if (m.find()) m.group(1)?.trim() else null
        }

        private fun nestedValue(block: String, tag: String): String? {
            val pattern = Pattern.compile(
                "<$tag(?:\\s[^>]*)?>\\s*<value(?:\\s[^>]*)?>([^<]*)</value>",
                Pattern.CASE_INSENSITIVE or Pattern.DOTALL,
            )
            val m = pattern.matcher(block)
            return if (m.find()) m.group(1)?.trim() else tagValue(block, tag)
        }

        private fun extractBlocks(xml: String, tag: String): List<String> {
            val pattern = Pattern.compile(
                "<$tag(?:\\s[^>]*)?>([\\s\\S]*?)</$tag>",
                Pattern.CASE_INSENSITIVE,
            )
            val m = pattern.matcher(xml)
            val out = mutableListOf<String>()
            while (m.find()) {
                val block = m.group(0)
                if (block != null) out += block
            }
            return out
        }
    }
}
