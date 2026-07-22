package com.streamora.iptv.ui.browse

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.streamora.iptv.data.model.ContentType
import com.streamora.iptv.data.model.MediaItem
import com.streamora.iptv.ui.components.PosterCard
import com.streamora.iptv.ui.theme.StreamoraBg
import com.streamora.iptv.ui.theme.StreamoraMuted
import com.streamora.iptv.ui.theme.StreamoraRed
import com.streamora.iptv.ui.theme.StreamoraSurface
import com.streamora.iptv.ui.theme.StreamoraText
import com.streamora.iptv.viewmodel.BrowseUiState

@Composable
fun BrowseScreen(
    type: ContentType,
    state: BrowseUiState,
    onCategory: (String?) -> Unit,
    onOpen: (MediaItem) -> Unit
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(StreamoraBg)
    ) {
        Text(
            text = when (type) {
                ContentType.LIVE -> "Live TV"
                ContentType.VOD -> "Movies"
                ContentType.SERIES -> "Series"
            },
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.padding(16.dp),
            color = StreamoraText
        )
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            item {
                CategoryChip(
                    label = "All",
                    selected = state.selectedCategoryId == null,
                    onClick = { onCategory(null) }
                )
            }
            items(state.categories, key = { it.categoryId }) { cat ->
                CategoryChip(
                    label = cat.categoryName,
                    selected = state.selectedCategoryId == cat.categoryId,
                    onClick = { onCategory(cat.categoryId) }
                )
            }
        }
        Box(
            Modifier
                .fillMaxSize()
                .padding(top = 12.dp)
        ) {
            when {
                state.loading -> {
                    CircularProgressIndicator(
                        color = StreamoraRed,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                state.error != null -> {
                    Text(
                        state.error,
                        color = StreamoraMuted,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                state.items.isEmpty() -> {
                    Text(
                        "No content in this category",
                        color = StreamoraMuted,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                else -> {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(110.dp),
                        contentPadding = PaddingValues(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(state.items, key = { "${it.type}-${it.id}" }) { item ->
                            PosterCard(item = item, onClick = { onOpen(item) }, width = 110)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CategoryChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(if (selected) StreamoraRed else StreamoraSurface)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Text(
            label,
            color = if (selected) StreamoraText else StreamoraMuted,
            style = MaterialTheme.typography.labelLarge,
            maxLines = 1
        )
    }
}
