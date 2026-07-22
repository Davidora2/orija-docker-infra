package com.streamora.iptv.data.search

import com.streamora.iptv.data.model.MediaItem
import java.text.Normalizer

/**
 * Accent-insensitive + fuzzy title matching so "Shogun" finds "Shōgun",
 * "resume" finds "Résumé", etc. Also builds autocomplete suggestions.
 */
object TitleSearch {

    private val COMBINING = "\\p{InCombiningDiacriticalMarks}+".toRegex()
    private val NON_ALNUM = "[^a-z0-9]+".toRegex()

    /** Fold accents / special letters into plain ASCII-ish form. */
    fun normalize(input: String): String {
        if (input.isBlank()) return ""
        var s = input.lowercase().trim()
        // Common letter folds before NFD
        s = s
            .replace('ø', 'o').replace('œ', 'o')
            .replace("æ", "ae")
            .replace('ð', 'd').replace('þ', 't')
            .replace('ł', 'l').replace('đ', 'd')
            .replace('ß', 's')
            .replace('ı', 'i')
            .replace('ʻ', '\'').replace('ʼ', '\'')
        // Macros / macrons and other diacritics: Shōgun -> Shogun
        s = Normalizer.normalize(s, Normalizer.Form.NFD)
        s = COMBINING.replace(s, "")
        // Keep letters/digits/spaces for readable compare; also a compact key
        return s
    }

    /** Compact key with only a-z0-9 for containment checks. */
    fun compact(input: String): String =
        NON_ALNUM.replace(normalize(input), "")

    data class Ranked(
        val item: MediaItem,
        val score: Int,
        val matchedAs: String
    )

    /**
     * Ranked search. Higher score = better.
     * 100 exact compact, 90 prefix, 80 contains, 60 fuzzy subsequence, 40 edit-distance-ish.
     */
    fun search(catalog: List<MediaItem>, query: String, limit: Int = 80): List<Ranked> {
        val qNorm = normalize(query)
        val qCompact = compact(query)
        if (qCompact.length < 2 && qNorm.length < 2) return emptyList()

        val out = ArrayList<Ranked>(limit * 2)
        for (item in catalog) {
            val name = item.name
            val nNorm = normalize(name)
            val nCompact = compact(name)
            val score = scoreMatch(qNorm, qCompact, nNorm, nCompact) ?: continue
            out += Ranked(item, score, name)
        }
        return out
            .sortedWith(compareByDescending<Ranked> { it.score }.thenBy { it.item.name.lowercase() })
            .distinctBy { "${it.item.type}-${it.item.id}" }
            .take(limit)
    }

    /** Autocomplete title suggestions (display the real catalog spelling). */
    fun suggestions(catalog: List<MediaItem>, query: String, limit: Int = 8): List<String> {
        return search(catalog, query, limit = 40)
            .map { it.item.name }
            .distinctBy { normalize(it) }
            .take(limit)
    }

    private fun scoreMatch(
        qNorm: String,
        qCompact: String,
        nNorm: String,
        nCompact: String
    ): Int? {
        if (qCompact.isNotEmpty()) {
            when {
                nCompact == qCompact -> return 100
                nCompact.startsWith(qCompact) -> return 92
                nNorm.startsWith(qNorm) -> return 90
                nCompact.contains(qCompact) -> return 80
                nNorm.contains(qNorm) -> return 78
                isSubsequence(qCompact, nCompact) && qCompact.length >= 3 -> return 60
                qCompact.length in 3..12 && withinEditDistance(qCompact, nCompact, maxDist(qCompact)) -> return 45
            }
        } else if (qNorm.isNotEmpty()) {
            when {
                nNorm == qNorm -> return 100
                nNorm.startsWith(qNorm) -> return 90
                nNorm.contains(qNorm) -> return 78
            }
        }
        return null
    }

    private fun maxDist(q: String): Int = when {
        q.length <= 4 -> 1
        q.length <= 8 -> 2
        else -> 3
    }

    /** True if all chars of [needle] appear in order inside [hay]. */
    private fun isSubsequence(needle: String, hay: String): Boolean {
        var i = 0
        for (c in hay) {
            if (i < needle.length && c == needle[i]) i++
            if (i == needle.length) return true
        }
        return false
    }

    /** Bounded Levenshtein against any window / whole string prefix of similar length. */
    private fun withinEditDistance(query: String, hayCompact: String, maxDist: Int): Boolean {
        if (hayCompact.isEmpty()) return false
        // Compare against full compact title and against sliding windows near query length
        if (levenshteinAtMost(query, hayCompact, maxDist)) return true
        if (hayCompact.length <= query.length + maxDist) return false
        val window = (query.length - maxDist).coerceAtLeast(1)..(query.length + maxDist)
        var start = 0
        while (start < hayCompact.length) {
            for (len in window) {
                if (start + len > hayCompact.length) break
                if (levenshteinAtMost(query, hayCompact.substring(start, start + len), maxDist)) return true
            }
            start++
            // cheap early bail for long titles
            if (start > 48) break
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
                cur[j] = minOf(
                    prev[j] + 1,
                    cur[j - 1] + 1,
                    prev[j - 1] + cost
                )
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
