package com.orija.insiderscout

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.orija.insiderscout.ui.ScoutScreen
import com.orija.insiderscout.ui.theme.InsiderScoutTheme

class MainActivity : ComponentActivity() {
    private val viewModel: ScoutViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            InsiderScoutTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val state by viewModel.state.collectAsStateWithLifecycle()
                    ScoutScreen(
                        state = state,
                        onLookbackChange = viewModel::updateLookback,
                        onMaxFilingsChange = viewModel::updateMaxFilings,
                        onScan = viewModel::scan,
                    )
                }
            }
        }
    }
}
