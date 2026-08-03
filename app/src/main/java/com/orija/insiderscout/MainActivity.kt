package com.orija.insiderscout

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.orija.insiderscout.ui.PoliticiansScreen
import com.orija.insiderscout.ui.ScoutScreen
import com.orija.insiderscout.ui.theme.InsiderScoutTheme
import com.orija.insiderscout.ui.theme.WsGraphite
import com.orija.insiderscout.ui.theme.WsLinen
import com.orija.insiderscout.ui.theme.WsMuted
import com.orija.insiderscout.ui.theme.WsPaper

class MainActivity : ComponentActivity() {
    private val scoutViewModel: ScoutViewModel by viewModels()
    private val politicsViewModel: PoliticsViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            InsiderScoutTheme {
                var tab by remember { mutableStateOf(AppTab.POLITICIANS) }
                val scoutState by scoutViewModel.state.collectAsStateWithLifecycle()
                val politicsState by politicsViewModel.state.collectAsStateWithLifecycle()

                Scaffold(
                    containerColor = WsLinen,
                    bottomBar = {
                        // Hide tab bar on nested detail screens.
                        val hideBar = politicsState.selected != null
                        if (!hideBar) {
                            NavigationBar(containerColor = WsPaper) {
                                NavigationBarItem(
                                    selected = tab == AppTab.POLITICIANS,
                                    onClick = { tab = AppTab.POLITICIANS },
                                    icon = { Icon(Icons.Default.AccountBalance, contentDescription = null) },
                                    label = { Text("Politicians") },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedIconColor = WsGraphite,
                                        selectedTextColor = WsGraphite,
                                        indicatorColor = WsLinen,
                                        unselectedIconColor = WsMuted,
                                        unselectedTextColor = WsMuted,
                                    ),
                                )
                                NavigationBarItem(
                                    selected = tab == AppTab.INSIDERS,
                                    onClick = { tab = AppTab.INSIDERS },
                                    icon = { Icon(Icons.Default.TrendingUp, contentDescription = null) },
                                    label = { Text("Insiders") },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedIconColor = WsGraphite,
                                        selectedTextColor = WsGraphite,
                                        indicatorColor = WsLinen,
                                        unselectedIconColor = WsMuted,
                                        unselectedTextColor = WsMuted,
                                    ),
                                )
                            }
                        }
                    },
                ) { padding ->
                    Surface(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        color = WsLinen,
                    ) {
                        Box(modifier = Modifier.fillMaxSize()) {
                            when (tab) {
                                AppTab.POLITICIANS -> PoliticiansScreen(
                                    state = politicsState,
                                    onCountry = politicsViewModel::setCountry,
                                    onRefresh = politicsViewModel::refresh,
                                    onOpen = politicsViewModel::openDisclosure,
                                    onBackFromDetail = politicsViewModel::clearSelection,
                                )
                                AppTab.INSIDERS -> ScoutScreen(
                                    state = scoutState,
                                    onLookbackChange = scoutViewModel::updateLookback,
                                    onMaxFilingsChange = scoutViewModel::updateMaxFilings,
                                    onScan = scoutViewModel::scan,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
