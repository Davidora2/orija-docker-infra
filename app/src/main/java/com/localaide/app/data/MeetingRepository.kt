package com.localaide.app.data

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.localaide.app.data.db.MeetingDao
import com.localaide.app.data.db.MeetingEntity
import com.localaide.app.data.model.Deliverable
import com.localaide.app.data.model.MeetingSummary
import com.localaide.app.data.model.PriorityPlan
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class MeetingRepository(private val dao: MeetingDao) {
    private val gson = Gson()
    private val listType = object : TypeToken<List<Deliverable>>() {}.type

    fun observeMeetings(): Flow<List<MeetingSummary>> =
        dao.observeAll().map { rows -> rows.map { it.toSummary() } }

    suspend fun getMeeting(id: Long): MeetingSummary? =
        dao.getById(id)?.toSummary()

    suspend fun saveMeeting(
        title: String,
        audioPath: String?,
        transcript: String,
        deliverables: List<Deliverable>,
        durationMs: Long
    ): Long {
        return dao.insert(
            MeetingEntity(
                title = title,
                audioPath = audioPath,
                transcript = transcript,
                deliverablesJson = gson.toJson(deliverables),
                createdAt = System.currentTimeMillis(),
                durationMs = durationMs
            )
        )
    }

    suspend fun updateDeliverables(meetingId: Long, deliverables: List<Deliverable>) {
        val existing = dao.getById(meetingId) ?: return
        dao.update(existing.copy(deliverablesJson = gson.toJson(deliverables)))
    }

    suspend fun deleteMeeting(id: Long) = dao.delete(id)

    private fun MeetingEntity.toSummary(): MeetingSummary {
        val items: List<Deliverable> = try {
            gson.fromJson(deliverablesJson, listType) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
        val plan = rebuildPlan(items)
        return MeetingSummary(
            meetingId = id,
            title = title,
            transcript = transcript,
            deliverables = plan?.ranked ?: items,
            createdAt = createdAt,
            priorityPlan = plan
        )
    }

    private fun rebuildPlan(items: List<Deliverable>): PriorityPlan? {
        if (items.isEmpty() || items.none { it.priorityRank != null }) return null
        val ranked = items.sortedBy { it.priorityRank ?: Int.MAX_VALUE }
        val top = ranked.first()
        return PriorityPlan(
            ranked = ranked,
            overallReasoning = "Restored on-device ranking for ${ranked.size} task(s).",
            doFirstId = top.id,
            doFirstBlurb = top.recommendationSummary
                ?.let { "Do first: ${top.title} — $it" }
                ?: "Do first: ${top.title}"
        )
    }
}
