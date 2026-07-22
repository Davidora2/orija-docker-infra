package com.streamora.iptv.ui.favorites

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.streamora.iptv.data.db.FavoriteEntity
import com.streamora.iptv.data.model.ContentType
import com.streamora.iptv.data.model.MediaItem
import com.streamora.iptv.ui.components.PosterCard
import com.streamora.iptv.ui.theme.StreamoraBg
import com.streamora.iptv.ui.theme.StreamoraMuted
import com.streamora.iptv.ui.theme.StreamoraText

@Composable
fun FavoritesScreen(
    favorites: List<FavoriteEntity>,
    onOpen: (MediaItem) -> Unit
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(StreamoraBg)
    ) {
        Text(
            "My List",
            style = MaterialTheme.typography.headlineMedium,
            color = StreamoraText,
            modifier = Modifier.padding(16.dp)
        )
        if (favorites.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Like titles to build your list", color = StreamoraMuted)
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(110.dp),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                items(favorites, key = { "${it.contentType}-${it.contentId}" }) { fav ->
                    val item = MediaItem(
                        id = fav.contentId,
                        name = fav.title,
                        posterUrl = fav.posterUrl,
                        type = ContentType.valueOf(fav.contentType),
                        rating = fav.rating,
                        plot = fav.plot,
                        extension = fav.extension
                    )
                    PosterCard(item = item, onClick = { onOpen(item) }, width = 110)
                }
            }
        }
    }
}
