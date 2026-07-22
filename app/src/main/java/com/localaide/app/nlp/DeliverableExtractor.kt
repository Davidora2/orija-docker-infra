package com.localaide.app.nlp

import com.localaide.app.data.model.Deliverable
import java.util.Calendar
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern

/**
 * Fully local deliverable / action-item extraction.
 * Looks for commitment phrases, owners, and relative due dates in the transcript.
 */
class DeliverableExtractor {

    fun extract(transcript: String, nowMs: Long = System.currentTimeMillis()): List<Deliverable> {
        if (transcript.isBlank()) return emptyList()

        val sentences = splitSentences(transcript)
        val found = LinkedHashMap<String, Deliverable>()

        for (sentence in sentences) {
            val cleaned = sentence.trim().replace(Regex("\\s+"), " ")
            if (cleaned.length < 12) continue
            if (!looksLikeDeliverable(cleaned)) continue

            val title = normalizeTitle(cleaned)
            val key = title.lowercase(Locale.US)
            if (found.containsKey(key)) continue

            found[key] = Deliverable(
                id = UUID.randomUUID().toString(),
                title = title,
                owner = extractOwner(cleaned),
                dueEpochMs = extractDueDate(cleaned, nowMs),
                notes = "From meeting transcript",
                sourceSnippet = cleaned.take(220)
            )
        }

        // If language cues were sparse, fall back to bullet-like lines
        if (found.isEmpty()) {
            sentences
                .filter { it.length in 20..160 }
                .filter {
                    ACTION_WORDS.any { w -> it.contains(w, ignoreCase = true) }
                }
                .take(5)
                .forEach { line ->
                    val title = normalizeTitle(line)
                    found[title.lowercase(Locale.US)] = Deliverable(
                        id = UUID.randomUUID().toString(),
                        title = title,
                        dueEpochMs = extractDueDate(line, nowMs) ?: defaultDue(nowMs),
                        notes = "Inferred action item",
                        sourceSnippet = line.take(220)
                    )
                }
        }

        return found.values.toList()
    }

    private fun looksLikeDeliverable(text: String): Boolean {
        val lower = text.lowercase(Locale.US)
        return CUE_PATTERNS.any { it.matcher(lower).find() } ||
            ACTION_WORDS.any { lower.contains(it) && (lower.contains("by ") || lower.contains("will ") || lower.contains("need to") || lower.contains("todo") || lower.contains("action")) }
    }

    private fun normalizeTitle(raw: String): String {
        var t = raw
            .replace(Regex("(?i)^(okay|ok|so|alright|um|uh)[,\\s]+"), "")
            .replace(Regex("(?i)^(action item|todo|deliverable)\\s*[:\\-]\\s*"), "")
            .trim()
        // Prefer clause after commitment verbs
        val m = Pattern.compile(
            "(?i)(?:will|should|need to|needs to|going to|gonna|please|let'?s)\\s+(.+)",
            Pattern.DOTALL
        ).matcher(t)
        if (m.find()) t = m.group(1) ?: t
        t = t.trim().trimEnd('.', '!', '?', ',')
        if (t.length > 90) t = t.take(87).trimEnd() + "…"
        return t.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.US) else it.toString() }
    }

    private fun extractOwner(text: String): String? {
        val m = OWNER_PATTERN.matcher(text)
        return if (m.find()) m.group(1)?.trim()?.replaceFirstChar { it.titlecase(Locale.US) } else null
    }

    private fun extractDueDate(text: String, nowMs: Long): Long? {
        val lower = text.lowercase(Locale.US)
        val cal = Calendar.getInstance().apply { timeInMillis = nowMs }

        when {
            lower.contains("today") -> return endOfDay(cal)
            lower.contains("tomorrow") -> {
                cal.add(Calendar.DAY_OF_YEAR, 1)
                return endOfDay(cal)
            }
            lower.contains("end of week") || lower.contains("this friday") || lower.contains("by friday") -> {
                while (cal.get(Calendar.DAY_OF_WEEK) != Calendar.FRIDAY) {
                    cal.add(Calendar.DAY_OF_YEAR, 1)
                }
                return endOfDay(cal)
            }
            lower.contains("next week") -> {
                cal.add(Calendar.DAY_OF_YEAR, 7)
                return endOfDay(cal)
            }
            lower.contains("next month") -> {
                cal.add(Calendar.MONTH, 1)
                return endOfDay(cal)
            }
        }

        val inDays = Pattern.compile("\\bin\\s+(\\d+)\\s+days?\\b").matcher(lower)
        if (inDays.find()) {
            val days = inDays.group(1)?.toIntOrNull() ?: return null
            cal.add(Calendar.DAY_OF_YEAR, days)
            return endOfDay(cal)
        }

        val byDay = Pattern.compile(
            "\\bby\\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b"
        ).matcher(lower)
        if (byDay.find()) {
            val dayName = byDay.group(1) ?: return null
            val target = dayNameToCal(dayName)
            while (cal.get(Calendar.DAY_OF_WEEK) != target) {
                cal.add(Calendar.DAY_OF_YEAR, 1)
            }
            return endOfDay(cal)
        }

        // Explicit "due <month> <day>"
        val dated = Pattern.compile(
            "\\b(?:due|by)\\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+(\\d{1,2})\\b",
            Pattern.CASE_INSENSITIVE
        ).matcher(text)
        if (dated.find()) {
            val monthName = dated.group(1)?.lowercase(Locale.US) ?: return null
            val day = dated.group(2)?.toIntOrNull() ?: return null
            val month = monthNameToIndex(monthName)
            cal.set(Calendar.MONTH, month)
            cal.set(Calendar.DAY_OF_MONTH, day.coerceIn(1, 28))
            if (cal.timeInMillis < nowMs) cal.add(Calendar.YEAR, 1)
            return endOfDay(cal)
        }

        return null
    }

    private fun defaultDue(nowMs: Long): Long =
        nowMs + TimeUnit.DAYS.toMillis(3)

    private fun endOfDay(cal: Calendar): Long {
        cal.set(Calendar.HOUR_OF_DAY, 17)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    private fun dayNameToCal(name: String): Int = when (name.lowercase(Locale.US)) {
        "monday" -> Calendar.MONDAY
        "tuesday" -> Calendar.TUESDAY
        "wednesday" -> Calendar.WEDNESDAY
        "thursday" -> Calendar.THURSDAY
        "friday" -> Calendar.FRIDAY
        "saturday" -> Calendar.SATURDAY
        else -> Calendar.SUNDAY
    }

    private fun monthNameToIndex(name: String): Int = when {
        name.startsWith("jan") -> Calendar.JANUARY
        name.startsWith("feb") -> Calendar.FEBRUARY
        name.startsWith("mar") -> Calendar.MARCH
        name.startsWith("apr") -> Calendar.APRIL
        name.startsWith("may") -> Calendar.MAY
        name.startsWith("jun") -> Calendar.JUNE
        name.startsWith("jul") -> Calendar.JULY
        name.startsWith("aug") -> Calendar.AUGUST
        name.startsWith("sep") -> Calendar.SEPTEMBER
        name.startsWith("oct") -> Calendar.OCTOBER
        name.startsWith("nov") -> Calendar.NOVEMBER
        else -> Calendar.DECEMBER
    }

    private fun splitSentences(text: String): List<String> {
        return text
            .split(Regex("(?<=[.!?\\n])\\s+|\\n+"))
            .map { it.trim() }
            .filter { it.isNotEmpty() }
    }

    companion object {
        private val ACTION_WORDS = listOf(
            "deliver", "ship", "send", "finish", "complete", "prepare", "draft",
            "schedule", "follow up", "follow-up", "review", "update", "share",
            "create", "build", "fix", "submit", "action item", "todo", "assign"
        )

        private val CUE_PATTERNS = listOf(
            Pattern.compile("\\baction item\\b"),
            Pattern.compile("\\bdeliverable\\b"),
            Pattern.compile("\\btodo\\b"),
            Pattern.compile("\\bwill\\s+\\w+"),
            Pattern.compile("\\bneed(?:s)?\\s+to\\b"),
            Pattern.compile("\\bplease\\s+\\w+"),
            Pattern.compile("\\blet'?s\\s+\\w+"),
            Pattern.compile("\\bassigned to\\b"),
            Pattern.compile("\\bdue\\b"),
            Pattern.compile("\\bby\\s+(monday|tuesday|wednesday|thursday|friday|end of|next)\\b")
        )

        private val OWNER_PATTERN = Pattern.compile(
            "(?i)\\b(?:assigned to|owner is|for)\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)"
        )
    }
}
