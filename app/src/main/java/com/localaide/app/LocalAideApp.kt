package com.localaide.app

import android.app.Application
import com.localaide.app.data.AppContainer

class LocalAideApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
