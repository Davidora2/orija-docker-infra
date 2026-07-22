package com.streamora.iptv

import android.app.Application
import com.google.android.gms.cast.framework.CastContext
import com.streamora.iptv.data.repository.StreamoraRepository

class StreamoraApp : Application() {
    lateinit var repository: StreamoraRepository
        private set

    override fun onCreate() {
        super.onCreate()
        repository = StreamoraRepository(this)
        try {
            CastContext.getSharedInstance(this)
        } catch (_: Exception) {
            // Cast optional when Play Services missing
        }
    }
}
