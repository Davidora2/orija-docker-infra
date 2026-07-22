package com.localaide.app.nlp

import com.localaide.app.data.model.Deliverable
import com.localaide.app.data.model.PriorityPlan
import com.localaide.app.data.model.Sensitivity
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min

/**
 * On-device priority reasoner.
 *
 * Walks an explicit multi-factor reasoning chain for each deliverable:
 *  1) deadline urgency
 *  2) sensitivity / blast-radius language
 *  3) blocker / dependency signals
 *  4) external commitment (customer / legal / exec)
 * then scores and ranks what to complete first.
 *
 * No network. Deterministic, explainable "reasoning model" suitable for offline use.
 */
class PriorityReasoner {

    fun prioritize(
        deliverables: List<Deliverable>,
        transcript: String = "",
        nowMs: Long = System.currentTimeMillis()
    ): PriorityPlan {
        if (deliverables.isEmpty()) {
            return PriorityPlan(
                ranked = emptyList(),
                overallReasoning = "No deliverables to rank.",
                doFirstId = null,
                doFirstBlurb = "Nothing to prioritize yet."
            )
        }

        val context = transcript.lowercase(Locale.US)
        val scored = deliverables.map { item ->
            reasonAbout(item, context, nowMs)
        }.sortedWith(
            compareByDescending<Scored> { it.score }
                .thenBy { it.dueEpochMs ?: Long.MAX_VALUE }
                .thenByDescending { it.sensitivity.rank }
        )

        val ranked = scored.mapIndexed { index, s ->
            s.deliverable.copy(
                sensitivity = s.sensitivity,
                priorityScore = s.score,
                priorityRank = index + 1,
                reasoningSteps = s.steps,
                recommendationSummary = s.summary
            )
        }

        val top = ranked.first()
        val overall = buildOverallReasoning(ranked)

        return PriorityPlan(
            ranked = ranked,
            overallReasoning = overall,
            doFirstId = top.id,
            doFirstBlurb = "Do first: ${top.title} — ${top.recommendationSummary}"
        )
    }

    private fun reasonAbout(item: Deliverable, meetingContext: String, nowMs: Long): Scored {
        val text = listOf(item.title, item.notes, item.sourceSnippet)
            .joinToString(" ")
            .lowercase(Locale.US)
        val steps = mutableListOf<String>()

        // Step 1 — deadline
        val (deadlineScore, deadlineNote) = scoreDeadline(item.dueEpochMs, nowMs)
        steps += "Deadline: $deadlineNote (urgency ${fmt(deadlineScore)})"

        // Step 2 — sensitivity lexicon
        val (sensitivity, sensScore, sensNote) = scoreSensitivity(text, meetingContext)
        steps += "Sensitivity: $sensNote → ${sensitivity.label} (weight ${fmt(sensScore)})"

        // Step 3 — blocker / unlocks-others
        val (blockerScore, blockerNote) = scoreBlocker(text)
        steps += "Dependencies: $blockerNote (weight ${fmt(blockerScore)})"

        // Step 4 — external commitment pressure
        val (externalScore, externalNote) = scoreExternalPressure(text)
        steps += "External pressure: $externalNote (weight ${fmt(externalScore)})"

        // Weighted combine (deadline + sensitivity dominate)
        val score =
            deadlineScore * 0.40 +
                sensScore * 0.30 +
                blockerScore * 0.18 +
                externalScore * 0.12

        steps += "Combined priority score: ${"%.1f".format(Locale.US, score)} / 100"

        val summary = buildSummary(item, sensitivity, deadlineNote, blockerScore, externalScore, score)
        steps += "Recommendation: $summary"

        return Scored(
            deliverable = item,
            score = score,
            sensitivity = sensitivity,
            dueEpochMs = item.dueEpochMs,
            steps = steps,
            summary = summary
        )
    }

    private fun scoreDeadline(dueEpochMs: Long?, nowMs: Long): Pair<Double, String> {
        if (dueEpochMs == null) {
            return 35.0 to "no explicit deadline (assume medium urgency)"
        }
        val hours = (dueEpochMs - nowMs).toDouble() / TimeUnit.HOURS.toMillis(1)
        return when {
            hours < 0 -> 100.0 to "overdue by ${formatDuration(-hours)}"
            hours <= 8 -> 95.0 to "due within ${formatDuration(hours)} (same day)"
            hours <= 24 -> 88.0 to "due within 24 hours"
            hours <= 48 -> 78.0 to "due within 2 days"
            hours <= 72 -> 68.0 to "due within 3 days"
            hours <= 168 -> 55.0 to "due this week (${formatDuration(hours)})"
            hours <= 336 -> 42.0 to "due within 2 weeks"
            else -> {
                // Soft decay for far deadlines
                val decay = 40.0 * exp(-hours / (24.0 * 30.0))
                max(18.0, decay) to "due later (${formatDuration(hours)})"
            }
        }
    }

    private fun scoreSensitivity(text: String, meetingContext: String): Triple<Sensitivity, Double, String> {
        val blob = "$text $meetingContext"
        val hits = mutableListOf<String>()

        fun hit(label: String, vararg needles: String): Boolean {
            val found = needles.any { blob.contains(it) }
            if (found) hits += label
            return found
        }

        val critical = hit(
            "critical/compliance",
            "p0", "sev0", "sev-0", "critical", "outage", "security breach", "data breach",
            "legal", "compliance", "regulator", "lawsuit", "hipaa", "gdpr", "pci"
        ) || hit("confidential", "confidential", "secret", "classified", "do not share", "privileged")

        val high = hit(
            "high-stakes",
            "blocker", "blocking", "p1", "sev1", "urgent", "asap", "immediately",
            "customer escalation", "executive", "board", "launch blocker", "production"
        ) || hit("customer-facing", "customer", "client", "demo tomorrow", "go-live", "golive")

        val medium = hit(
            "material impact",
            "important", "priority", "stakeholder", "revenue", "contract", "sla", "deadline"
        )

        val sensitivity = when {
            critical -> Sensitivity.CRITICAL
            high -> Sensitivity.HIGH
            medium -> Sensitivity.MEDIUM
            else -> Sensitivity.LOW
        }

        val score = when (sensitivity) {
            Sensitivity.CRITICAL -> 100.0
            Sensitivity.HIGH -> 78.0
            Sensitivity.MEDIUM -> 52.0
            Sensitivity.LOW -> 28.0
        }

        val note = if (hits.isEmpty()) {
            "no strong sensitivity cues; treat as routine"
        } else {
            "signals: ${hits.distinct().joinToString(", ")}"
        }
        return Triple(sensitivity, score, note)
    }

    private fun scoreBlocker(text: String): Pair<Double, String> {
        val cues = listOf(
            "blocker", "blocking", "blocked on", "depends on", "dependency",
            "unlock", "unblocks", "before we can", "prerequisite", "first we need",
            "can't start until", "cannot start until"
        )
        val hits = cues.filter { text.contains(it) }
        return if (hits.isNotEmpty()) {
            90.0 to "likely unblocks other work (${hits.take(2).joinToString(", ")})"
        } else {
            30.0 to "no clear blocker language"
        }
    }

    private fun scoreExternalPressure(text: String): Pair<Double, String> {
        val cues = listOf(
            "customer" to 85.0,
            "client" to 80.0,
            "investor" to 78.0,
            "board" to 82.0,
            "exec" to 75.0,
            "partner" to 70.0,
            "press" to 72.0,
            "announce" to 68.0,
            "ship" to 60.0,
            "launch" to 70.0
        )
        val hit = cues.firstOrNull { text.contains(it.first) }
        return if (hit != null) {
            hit.second to "external audience cue '${hit.first}'"
        } else {
            25.0 to "mostly internal"
        }
    }

    private fun buildSummary(
        item: Deliverable,
        sensitivity: Sensitivity,
        deadlineNote: String,
        blockerScore: Double,
        externalScore: Double,
        score: Double
    ): String {
        val parts = mutableListOf<String>()
        parts += sensitivity.label.lowercase(Locale.US) + " sensitivity"
        parts += deadlineNote
        if (blockerScore >= 70) parts += "unblocks other work"
        if (externalScore >= 70) parts += "external commitment"
        return "Score ${"%.0f".format(Locale.US, score)} — prioritize because ${parts.joinToString("; ")}."
    }

    private fun buildOverallReasoning(ranked: List<Deliverable>): String {
        if (ranked.isEmpty()) return "No tasks."
        val top = ranked.first()
        val second = ranked.getOrNull(1)
        return buildString {
            append("On-device reasoner ranked ${ranked.size} task(s) by deadline urgency (40%), ")
            append("sensitivity (30%), blocker impact (18%), and external pressure (12%). ")
            append("Start with “${top.title}”")
            top.sensitivity?.let { append(" [${it.label}]") }
            append(".")
            if (second != null) {
                append(" Next: “${second.title}”.")
            }
            append(" Re-run after dates or wording change.")
        }
    }

    private fun formatDuration(hours: Double): String {
        val h = hours
        return when {
            h < 1 -> "${max(1, (h * 60).toInt())}m"
            h < 48 -> "${h.toInt()}h"
            else -> "${(h / 24.0).toInt()}d"
        }
    }

    private fun fmt(v: Double): String = "%.0f".format(Locale.US, v)

    private data class Scored(
        val deliverable: Deliverable,
        val score: Double,
        val sensitivity: Sensitivity,
        val dueEpochMs: Long?,
        val steps: List<String>,
        val summary: String
    )

    companion object {
        /** Clamp helper kept for future tuning knobs. */
        @Suppress("unused")
        fun clamp01(v: Double): Double = min(1.0, max(0.0, v))
    }
}
