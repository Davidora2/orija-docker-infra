package com.localaide.app.calendar

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import com.localaide.app.data.model.Deliverable
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/**
 * Writes one calendar event per deliverable into the device calendar (local/device calendars).
 */
class CalendarEventWriter(private val context: Context) {

    data class Result(
        val created: Int,
        val eventIds: List<Long>,
        val errors: List<String>
    )

    fun primaryCalendarId(): Long? {
        val projection = arrayOf(
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL,
            CalendarContract.Calendars.IS_PRIMARY
        )
        context.contentResolver.query(
            CalendarContract.Calendars.CONTENT_URI,
            projection,
            "${CalendarContract.Calendars.VISIBLE} = 1 AND ${CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL} >= ?",
            arrayOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR.toString()),
            "${CalendarContract.Calendars.IS_PRIMARY} DESC"
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                return cursor.getLong(0)
            }
        }
        return null
    }

    fun createEventsForDeliverables(
        meetingTitle: String,
        deliverables: List<Deliverable>,
        defaultDurationMinutes: Long = 30
    ): Result {
        val calId = primaryCalendarId()
        if (calId == null) {
            return Result(0, emptyList(), listOf("No writable calendar found on device"))
        }

        val ids = mutableListOf<Long>()
        val errors = mutableListOf<String>()
        val zone = TimeZone.getDefault().id

        deliverables.forEachIndexed { index, item ->
            try {
                val start = item.dueEpochMs
                    ?: (System.currentTimeMillis() + TimeUnit.DAYS.toMillis((index + 1).toLong()))
                val end = start + TimeUnit.MINUTES.toMillis(defaultDurationMinutes)
                val values = ContentValues().apply {
                    put(CalendarContract.Events.CALENDAR_ID, calId)
                    put(CalendarContract.Events.TITLE, "Deliverable: ${item.title}")
                    put(
                        CalendarContract.Events.DESCRIPTION,
                        buildString {
                            append("Meeting: ").append(meetingTitle).append('\n')
                            item.owner?.let { append("Owner: ").append(it).append('\n') }
                            if (item.notes.isNotBlank()) append(item.notes).append('\n')
                            if (item.sourceSnippet.isNotBlank()) {
                                append("\nFrom transcript:\n").append(item.sourceSnippet)
                            }
                            append("\n\nCreated by LocalAide (on-device)")
                        }
                    )
                    put(CalendarContract.Events.DTSTART, start)
                    put(CalendarContract.Events.DTEND, end)
                    put(CalendarContract.Events.EVENT_TIMEZONE, zone)
                    put(CalendarContract.Events.HAS_ALARM, 1)
                }
                val uri = context.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
                val eventId = uri?.let { ContentUris.parseId(it) }
                if (eventId != null) {
                    // Reminder 1 hour before
                    val reminder = ContentValues().apply {
                        put(CalendarContract.Reminders.EVENT_ID, eventId)
                        put(CalendarContract.Reminders.MINUTES, 60)
                        put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT)
                    }
                    context.contentResolver.insert(CalendarContract.Reminders.CONTENT_URI, reminder)
                    item.calendarEventId = eventId
                    ids += eventId
                } else {
                    errors += "Failed to insert: ${item.title}"
                }
            } catch (e: SecurityException) {
                errors += "Calendar permission denied"
            } catch (e: Exception) {
                errors += (e.message ?: "Error creating ${item.title}")
            }
        }

        return Result(ids.size, ids, errors)
    }

    /** Opens the system calendar insert UI for a single deliverable (no write permission needed). */
    fun previewInsertIntent(meetingTitle: String, item: Deliverable): Intent {
        val start = item.dueEpochMs ?: (System.currentTimeMillis() + TimeUnit.DAYS.toMillis(1))
        return Intent(Intent.ACTION_INSERT).apply {
            data = CalendarContract.Events.CONTENT_URI
            putExtra(CalendarContract.Events.TITLE, "Deliverable: ${item.title}")
            putExtra(
                CalendarContract.Events.DESCRIPTION,
                "Meeting: $meetingTitle\n${item.sourceSnippet}"
            )
            putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
            putExtra(CalendarContract.EXTRA_EVENT_END_TIME, start + TimeUnit.MINUTES.toMillis(30))
        }
    }

    fun viewEventIntent(eventId: Long): Intent {
        val uri: Uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId)
        return Intent(Intent.ACTION_VIEW).setData(uri)
    }
}
