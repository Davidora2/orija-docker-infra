package com.streamora.iptv.data.search

import com.streamora.iptv.data.model.MediaItem
import java.text.Normalizer

/**
 * Intelligent catalog title matching:
 * - Diacritics: shogun → Shōgun
 * - Prefix: sho → Shogun
 * - Typos: incepton → Inception
 * - Acronyms: got → Game of Thrones, tlou → The Last of Us
 * - Tokens + year: matrix 1999
 */
object TitleSearch {

    private val COMBINING = "\\p{InCombiningDiacriticalMarks}+".toRegex()
    private val NON_ALNUM = "[^a-z0-9]+".toRegex()
    private val YEAR = "\\b((?:19|20)\\d{2})\\b".toRegex()
    private val STOP = setOf("a", "an", "and", "the", "of", "to", "in", "on", "for", "at", "&")

    data class IndexedTitle(
        val item: MediaItem,
        val display: String,
        val norm: String,
        val compact: String,
        val tokens: List<String>,
        val significantTokens: List<String>,
        val acronym: String,
        val acronymSignificant: String,
        val year: Int?
    )

    data class ParsedQuery(
        val raw: String,
        val norm: String,
        val compact: String,
        val tokens: List<String>,
        val year: Int?
    )

    data class Ranked(
        val item: MediaItem,
        val score: Int,
        val matchedAs: String,
        val reason: String
    )

    enum class SuggestionSource { CATALOG, TMDB }

    data class SearchSuggestion(
        val title: String,
        val source: SuggestionSource,
        val year: Int? = null,
        val mediaHint: String? = null
    ) {
        val label: String
            get() = when {
                year != null -> "$title ($year)"
                else -> title
            }
    }

    fun normalize(input: String): String {
        if (input.isBlank()) return ""
        var s = input.lowercase().trim()
        s = s
            .replace('ø', 'o').replace('œ', 'o')
            .replace("æ", "ae")
            .replace('ð', 'd').replace('þ', 't')
            .replace('ł', 'l').replace('đ', 'd')
            .replace('ß', 's')
            .replace('ı', 'i')
            .replace('ʻ', '\'').replace('ʼ', '\'')
        s = Normalizer.normalize(s, Normalizer.Form.NFD)
        s = COMBINING.replace(s, "")
        return s
    }

    fun compact(input: String): String = NON_ALNUM.replace(normalize(input), "")

    fun tokensOf(input: String): List<String> =
        normalize(input)
            .split(Regex("[^a-z0-9]+"))
            .filter { it.isNotBlank() }

    fun extractYear(input: String): Int? =
        YEAR.find(normalize(input))?.groupValues?.getOrNull(1)?.toIntOrNull()

    fun acronymOf(tokens: List<String>): String =
        tokens.mapNotNull { t -> t.firstOrNull()?.toString() }.joinToString("")

    fun index(item: MediaItem): IndexedTitle {
        val display = item.name
        val norm = normalize(display)
        val toks = tokensOf(display)
        val significant = toks.filter { (it !in STOP && it.length > 1) || it.toIntOrNull() != null }
        return IndexedTitle(
            item = item,
            display = display,
            norm = norm,
            compact = compact(display),
            tokens = toks,
            significantTokens = significant.ifEmpty { toks },
            acronym = acronymOf(toks),
            acronymSignificant = acronymOf(significant.ifEmpty { toks }),
            year = extractYear(display)
        )
    }

    fun indexAll(catalog: List<MediaItem>): List<IndexedTitle> = catalog.map { index(it) }

    fun parseQuery(query: String): ParsedQuery {
        val year = extractYear(query)
        val withoutYear = if (year != null) {
            normalize(query).replace(year.toString(), " ")
        } else normalize(query)
        return ParsedQuery(
            raw = query.trim(),
            norm = normalize(withoutYear).trim(),
            compact = compact(withoutYear),
            tokens = tokensOf(withoutYear),
            year = year
        )
    }

    fun searchIndexed(index: List<IndexedTitle>, query: String, limit: Int = 80): List<Ranked> {
        val q = parseQuery(query)
        if (q.compact.length < 2 && q.tokens.isEmpty()) return emptyList()

        val out = ArrayList<Ranked>(minOf(index.size, limit * 3))
        for (row in index) {
            val hit = score(q, row) ?: continue
            out += hit
        }
        return out
            .sortedWith(compareByDescending<Ranked> { it.score }.thenBy { it.item.name.lowercase() })
            .distinctBy { "${it.item.type}-${it.item.id}" }
            .take(limit)
    }

    fun search(catalog: List<MediaItem>, query: String, limit: Int = 80): List<Ranked> =
        searchIndexed(indexAll(catalog), query, limit)

    fun catalogSuggestions(index: List<IndexedTitle>, query: String, limit: Int = 8): List<SearchSuggestion> {
        return searchIndexed(index, query, limit = 40)
            .map {
                SearchSuggestion(
                    title = it.item.name,
                    source = SuggestionSource.CATALOG,
                    year = indexYear(it.item.name)
                )
            }
            .distinctBy { normalize(it.title) }
            .filter { !it.title.equals(query.trim(), ignoreCase = true) }
            .take(limit)
    }

    private fun indexYear(name: String): Int? = extractYear(name)

    private fun score(q: ParsedQuery, row: IndexedTitle): Ranked? {
        var best: Pair<Int, String>? = null

        fun consider(score: Int, reason: String) {
            val adjusted = score + yearBonus(q.year, row.year, reason)
            if (best == null || adjusted > best!!.first) best = adjusted to reason
        }

        // Exact / prefix / contains on compact + normalized forms
        if (q.compact.isNotEmpty()) {
            when {
                row.compact == q.compact -> consider(100, "exact")
                row.compact.startsWith(q.compact) -> consider(94, "prefix")
                row.norm.startsWith(q.norm) -> consider(92, "prefix-norm")
                row.tokens.any { it.startsWith(q.compact) || it.startsWith(q.norm) } -> consider(90, "token-prefix")
                row.compact.contains(q.compact) -> consider(82, "contains")
                row.norm.contains(q.norm) -> consider(80, "contains-norm")
            }
        }

        // Acronyms: got, tlou, lotr
        if (q.compact.length in 2..8 && q.tokens.size <= 1) {
            when {
                row.acronym == q.compact -> consider(98, "acronym")
                row.acronymSignificant == q.compact -> consider(96, "acronym-significant")
                row.acronym.startsWith(q.compact) && q.compact.length >= 2 -> consider(88, "acronym-prefix")
                row.acronymSignificant.startsWith(q.compact) -> consider(86, "acronym-sig-prefix")
            }
        }

        // Token matching (any order): "matrix reloaded", "last us"
        if (q.tokens.isNotEmpty()) {
            val tokenScore = tokenMatchScore(q.tokens, row)
            if (tokenScore != null) consider(tokenScore, "tokens")
        }

        // Typo / fuzzy tolerance against compact title and individual tokens
        if (q.compact.length >= 4) {
            val distCap = maxDist(q.compact)
            if (levenshteinAtMost(q.compact, row.compact, distCap)) {
                consider(72, "typo-title")
            } else {
                // Compare to each token and to leading compact window
                for (tok in row.tokens) {
                    if (tok.length >= 4 && levenshteinAtMost(q.compact, tok, distCap)) {
                        consider(68, "typo-token")
                        break
                    }
                }
                val windowHit = fuzzyWindow(q.compact, row.compact, distCap)
                if (windowHit) consider(64, "typo-window")
            }
        } else if (q.compact.length == 3) {
            // short typo: allow distance 1 vs tokens / compact
            if (levenshteinAtMost(q.compact, row.compact, 1) ||
                row.tokens.any { it.length >= 3 && levenshteinAtMost(q.compact, it, 1) }
            ) {
                consider(66, "typo-short")
            }
        }

        // Soft subsequence for progressive typing beyond strict prefix
        if (q.compact.length >= 3 && isSubsequence(q.compact, row.compact)) {
            consider(58, "subsequence")
        }

        // If user supplied a year and nothing else matched but year matches a token title containing that year
        if (best == null && q.year != null && row.year == q.year && q.tokens.isEmpty()) {
            consider(40, "year-only")
        }

        // Require year agreement when query includes a year (soft filter)
        val hit = best ?: return null
        if (q.year != null && row.year != null && row.year != q.year) {
            // Keep only if the textual match is very strong; otherwise drop
            if (hit.first < 90) return null
        }
        // If query has year but title has no year, still allow strong text matches
        return Ranked(row.item, hit.first, row.display, hit.second)
    }

    private fun yearBonus(queryYear: Int?, titleYear: Int?, reason: String): Int {
        if (queryYear == null) return 0
        return when {
            titleYear == queryYear -> 8
            titleYear == null && reason.startsWith("exact") -> 0
            else -> 0
        }
    }

    private fun tokenMatchScore(qTokens: List<String>, row: IndexedTitle): Int? {
        if (qTokens.isEmpty()) return null
        var matched = 0
        var fuzzyMatched = 0
        for (qt in qTokens) {
            val exact = row.tokens.any { it == qt || it.startsWith(qt) }
            if (exact) {
                matched++
                continue
            }
            val fuzzy = qt.length >= 4 && row.tokens.any {
                levenshteinAtMost(qt, it, maxDist(qt))
            }
            if (fuzzy) fuzzyMatched++
        }
        val total = matched + fuzzyMatched
        if (total == 0) return null
        val coverage = total.toDouble() / qTokens.size
        return when {
            coverage >= 1.0 && fuzzyMatched == 0 -> 91
            coverage >= 1.0 -> 84
            coverage >= 0.66 && matched >= 1 -> 76
            coverage >= 0.5 && qTokens.size == 2 && matched >= 1 -> 70
            else -> null
        }
    }

    private fun maxDist(q: String): Int = when {
        q.length <= 4 -> 1
        q.length <= 8 -> 2
        else -> 3
    }

    private fun isSubsequence(needle: String, hay: String): Boolean {
        var i = 0
        for (c in hay) {
            if (i < needle.length && c == needle[i]) i++
            if (i == needle.length) return true
        }
        return false
    }

    private fun fuzzyWindow(query: String, hay: String, maxDist: Int): Boolean {
        if (hay.isEmpty()) return false
        if (levenshteinAtMost(query, hay, maxDist)) return true
        val minLen = (query.length - maxDist).coerceAtLeast(1)
        val maxLen = query.length + maxDist
        var start = 0
        while (start < hay.length && start <= 64) {
            for (len in minLen..maxLen) {
                if (start + len > hay.length) break
                if (levenshteinAtMost(query, hay.substring(start, start + len), maxDist)) return true
            }
            start++
        }
        return false
    }

    private fun levenshteinAtMost(a: String, b: String, maxDist: Int): Boolean {
        if (kotlin.math.abs(a.length - b.length) > maxDist) return false
        if (a == b) return true
        val m = a.length
        val n = b.length
        var prev = IntArray(n + 1) { it }
        var cur = IntArray(n + 1)
        for (i in 1..m) {
            cur[0] = i
            var rowMin = cur[0]
            val ca = a[i - 1]
            for (j in 1..n) {
                val cost = if (ca == b[j - 1]) 0 else 1
                cur[j] = minOf(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
                if (cur[j] < rowMin) rowMin = cur[j]
            }
            if (rowMin > maxDist) return false
            val tmp = prev
            prev = cur
            cur = tmp
        }
        return prev[n] <= maxDist
    }
}
