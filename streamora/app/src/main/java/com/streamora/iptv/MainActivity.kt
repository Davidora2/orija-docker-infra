package com.streamora.iptv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.streamora.iptv.navigation.StreamoraNav
import com.streamora.iptv.ui.theme.StreamoraTheme
import com.streamora.iptv.viewmodel.AppViewModel
import com.streamora.iptv.viewmodel.BootState
import com.streamora.iptv.viewmodel.VmFactory
import androidx.compose.runtime.collectAsState
import com.streamora.iptv.ui.theme.StreamoraText

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as StreamoraApp
        setContent {
            StreamoraTheme {
                val vm: AppViewModel = viewModel(factory = VmFactory(app.repository))
                Box(Modifier.fillMaxSize()) {
                    StreamoraNav(vm)
                    AccountMenuOverlay(vm)
                }
            }
        }
    }
}

@Composable
private fun AccountMenuOverlay(vm: AppViewModel) {
    val boot by vm.boot.collectAsState()
    if (boot != BootState.Ready) return

    var expanded by remember { mutableStateOf(false) }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = 8.dp, end = 8.dp),
        contentAlignment = Alignment.TopEnd
    ) {
        IconButton(onClick = { expanded = true }) {
            Icon(Icons.Default.AccountCircle, contentDescription = "Account", tint = StreamoraText)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("Switch profile") },
                onClick = {
                    expanded = false
                    vm.switchProfile()
                },
                leadingIcon = { Icon(Icons.Default.AccountCircle, null) }
            )
            DropdownMenuItem(
                text = { Text("Sign out") },
                onClick = {
                    expanded = false
                    vm.logout()
                },
                leadingIcon = { Icon(Icons.AutoMirrored.Filled.Logout, null) }
            )
        }
    }
}
