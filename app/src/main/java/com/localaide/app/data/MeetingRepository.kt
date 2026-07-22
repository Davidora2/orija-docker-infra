package com.localaide.app.data

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.localaide.app.data.db.MeetingDao
import com.localaide.app.data.db.MeetingEntity
import com.localaide.app.data.model.Deliverable
import com.localaide.app.data.model.MeetingSummary
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
        return MeetingSummary(
            meetingId = id,
            title = title,
            transcript = transcript,
            deliverables = items,
            createdAt = createdAt
        )
    }
}
