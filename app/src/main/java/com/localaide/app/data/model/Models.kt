package com.localaide.app.data.model

enum class Sensitivity(
    val label: String,
    val rank: Int
) {
    CRITICAL("Critical", 4),
    HIGH("High", 3),
    MEDIUM("Medium", 2),
    LOW("Low", 1)
}

data class Deliverable(
    val id: String,
    val title: String,
    val owner: String? = null,
    val dueEpochMs: Long? = null,
    val notes: String = "",
    val sourceSnippet: String = "",
    var calendarEventId: Long? = null,
    val sensitivity: Sensitivity? = null,
    val priorityScore: Double? = null,
    val priorityRank: Int? = null,
    val reasoningSteps: List<String> = emptyList(),
    val recommendationSummary: String? = null
)

data class PriorityPlan(
    val ranked: List<Deliverable>,
    val overallReasoning: String,
    val doFirstId: String?,
    val doFirstBlurb: String
)

data class MeetingSummary(
    val meetingId: Long,
    val title: String,
    val transcript: String,
    val deliverables: List<Deliverable>,
    val createdAt: Long,
    val priorityPlan: PriorityPlan? = null
)
