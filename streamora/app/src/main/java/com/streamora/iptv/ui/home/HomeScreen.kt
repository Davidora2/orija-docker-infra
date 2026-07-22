package com.streamora.iptv.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.streamora.iptv.data.model.MediaItem
import com.streamora.iptv.ui.components.HeroBanner
import com.streamora.iptv.ui.components.LoadingScreen
import com.streamora.iptv.ui.components.MediaRow
import com.streamora.iptv.ui.theme.StreamoraBg
import com.streamora.iptv.ui.theme.StreamoraMuted
import com.streamora.iptv.ui.theme.StreamoraRed
import com.streamora.iptv.viewmodel.HomeUiState

@Composable
fun HomeScreen(
    state: HomeUiState,
    onOpen: (MediaItem) -> Unit,
    onPlay: (MediaItem) -> Unit,
    onRetry: () -> Unit
) {
    when {
        state.loading && state.movies.isEmpty() && state.series.isEmpty() -> LoadingScreen("Loading your library…")
        state.error != null && state.movies.isEmpty() -> {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(StreamoraBg),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(state.error, color = StreamoraMuted)
                    TextButton(onClick = onRetry) {
                        Text("Retry", color = StreamoraRed)
                    }
                }
            }
        }
        else -> {
            Column(
                Modifier
                    .fillMaxSize()
                    .background(StreamoraBg)
                    .verticalScroll(rememberScrollState())
            ) {
                HeroBanner(
                    item = state.hero,
                    onPlay = { state.hero?.let(onPlay) },
                    onDetails = { state.hero?.let(onOpen) }
                )
                if (state.continueWatching.isNotEmpty()) {
                    MediaRow("Continue Watching", state.continueWatching, onOpen)
                }
                if (state.favorites.isNotEmpty()) {
                    MediaRow("My List", state.favorites, onOpen)
                }
                MediaRow("Movies", state.movies, onOpen)
                MediaRow("Series", state.series, onOpen)
                MediaRow("Live TV", state.live, onOpen)
                Spacer(Modifier.height(80.dp).padding(bottom = 8.dp))
            }
        }
    }
}
