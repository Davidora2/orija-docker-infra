package com.localaide.app.data.model

data class Deliverable(
    val id: String,
    val title: String,
    val owner: String? = null,
    val dueEpochMs: Long? = null,
    val notes: String = "",
    val sourceSnippet: String = "",
    var calendarEventId: Long? = null
)

data class MeetingSummary(
    val meetingId: Long,
    val title: String,
    val transcript: String,
    val deliverables: List<Deliverable>,
    val createdAt: Long
)
