package com.streamora.iptv

import android.app.Application
import com.streamora.iptv.data.repository.StreamoraRepository

class StreamoraApp : Application() {
    lateinit var repository: StreamoraRepository
        private set

    override fun onCreate() {
        super.onCreate()
        repository = StreamoraRepository(this)
    }
}
