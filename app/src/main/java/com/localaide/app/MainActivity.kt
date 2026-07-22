package com.localaide.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.localaide.app.ui.screens.LocalAideAppNav
import com.localaide.app.ui.theme.LocalAideTheme

class MainActivity : ComponentActivity() {
    private val vm: AssistantViewModel by viewModels {
        AssistantViewModelFactory(application as LocalAideApp)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            LocalAideTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    LocalAideAppNav(vm)
                }
            }
        }
    }
}
