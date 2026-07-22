package com.streamora.iptv.ui.details

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.streamora.iptv.data.model.ContentType
import com.streamora.iptv.data.model.Episode
import com.streamora.iptv.ui.theme.StreamoraBg
import com.streamora.iptv.ui.theme.StreamoraMuted
import com.streamora.iptv.ui.theme.StreamoraRed
import com.streamora.iptv.ui.theme.StreamoraSurface
import com.streamora.iptv.ui.theme.StreamoraText
import com.streamora.iptv.viewmodel.DetailsUiState

@Composable
fun DetailsScreen(
    state: DetailsUiState,
    onBack: () -> Unit,
    onToggleLike: () -> Unit,
    onPlay: (Episode?) -> Unit,
    onSelectSeason: (String) -> Unit
) {
    val item = state.item
    Box(
        Modifier
            .fillMaxSize()
            .background(StreamoraBg)
    ) {
        if (state.loading) {
            CircularProgressIndicator(color = StreamoraRed, modifier = Modifier.align(Alignment.Center))
        } else if (item != null) {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
            ) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(360.dp)
                ) {
                    if (!item.posterUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = item.posterUrl,
                            contentDescription = item.name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    Box(
                        Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    listOf(Color.Transparent, StreamoraBg)
                                )
                            )
                    )
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier
                            .padding(8.dp)
                            .align(Alignment.TopStart)
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Color.White)
                    }
                }
                Column(Modifier.padding(horizontal = 20.dp)) {
                    Text(item.name, style = MaterialTheme.typography.headlineLarge)
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(item.type.name, color = StreamoraRed, style = MaterialTheme.typography.labelLarge)
                        if (!item.rating.isNullOrBlank()) {
                            Text("★ ${item.rating}", color = StreamoraMuted)
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color.White)
                                .clickable { onPlay(null) }
                                .padding(horizontal = 18.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.PlayArrow, null, tint = Color.Black)
                            Spacer(Modifier.width(4.dp))
                            Text(
                                if (item.type == ContentType.SERIES) "Play episode" else "Play",
                                color = Color.Black,
                                style = MaterialTheme.typography.labelLarge
                            )
                        }
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(StreamoraSurface)
                                .clickable(onClick = onToggleLike)
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                if (state.liked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                contentDescription = "Like",
                                tint = if (state.liked) StreamoraRed else Color.White
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(if (state.liked) "Liked" else "My List", color = StreamoraText)
                        }
                    }
                    if (!item.plot.isNullOrBlank()) {
                        Spacer(Modifier.height(20.dp))
                        Text(item.plot, style = MaterialTheme.typography.bodyLarge, color = StreamoraMuted)
                    }

                    if (item.type == ContentType.SERIES && state.seriesInfo?.episodes != null) {
                        Spacer(Modifier.height(24.dp))
                        Text("Episodes", style = MaterialTheme.typography.titleLarge)
                        Spacer(Modifier.height(10.dp))
                        val seasons = state.seriesInfo.episodes.keys.sortedBy { it.toIntOrNull() ?: 0 }
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(seasons) { season ->
                                val selected = season == state.selectedSeason
                                Box(
                                    Modifier
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(if (selected) StreamoraRed else StreamoraSurface)
                                        .clickable { onSelectSeason(season) }
                                        .padding(horizontal = 14.dp, vertical = 8.dp)
                                ) {
                                    Text("Season $season", color = StreamoraText)
                                }
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                        state.episodes.forEach { ep ->
                            EpisodeRow(ep, state.selectedSeason?.toIntOrNull() ?: 1) {
                                onPlay(ep)
                            }
                        }
                    }
                    Spacer(Modifier.height(40.dp))
                }
            }
        }
    }
}

@Composable
private fun EpisodeRow(episode: Episode, season: Int, onPlay: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(StreamoraSurface)
            .clickable(onClick = onPlay)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .width(96.dp)
                .aspectRatio(16f / 9f)
                .clip(RoundedCornerShape(4.dp))
                .background(Color(0xFF2A2A36)),
            contentAlignment = Alignment.Center
        ) {
            if (!episode.info?.movieImage.isNullOrBlank()) {
                AsyncImage(
                    model = episode.info?.movieImage,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Icon(Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(28.dp))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                episode.title?.takeIf { it.isNotBlank() } ?: "Episode ${episode.episodeNum}",
                style = MaterialTheme.typography.titleLarge,
                maxLines = 2
            )
            Text("S${season}E${episode.episodeNum}", color = StreamoraMuted)
            if (!episode.info?.plot.isNullOrBlank()) {
                Text(episode.info?.plot.orEmpty(), color = StreamoraMuted, maxLines = 2)
            }
        }
    }
}
