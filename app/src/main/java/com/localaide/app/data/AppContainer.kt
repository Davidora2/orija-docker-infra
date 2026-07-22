package com.localaide.app.data

import android.content.Context
import androidx.room.Room
import com.localaide.app.audio.ModelInstaller
import com.localaide.app.audio.VoskTranscriber
import com.localaide.app.calendar.CalendarEventWriter
import com.localaide.app.data.db.AppDatabase
import com.localaide.app.nlp.DeliverableExtractor

class AppContainer(context: Context) {
    private val appContext = context.applicationContext

    val database: AppDatabase = Room.databaseBuilder(
        appContext,
        AppDatabase::class.java,
        "localaide.db"
    ).fallbackToDestructiveMigration().build()

    val meetingRepository = MeetingRepository(database.meetingDao())
    val modelInstaller = ModelInstaller(appContext)
    val transcriber = VoskTranscriber(appContext, modelInstaller)
    val deliverableExtractor = DeliverableExtractor()
    val calendarWriter = CalendarEventWriter(appContext)
}
