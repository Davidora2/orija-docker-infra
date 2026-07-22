package com.streamora.iptv.ui.search

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.streamora.iptv.data.model.MediaItem
import com.streamora.iptv.ui.components.PosterCard
import com.streamora.iptv.ui.theme.StreamoraBg
import com.streamora.iptv.ui.theme.StreamoraMuted
import com.streamora.iptv.ui.theme.StreamoraRed
import com.streamora.iptv.ui.theme.StreamoraSurface
import com.streamora.iptv.ui.theme.StreamoraText

@Composable
fun SearchScreen(
    query: String,
    loading: Boolean,
    results: List<MediaItem>,
    suggestions: List<String>,
    onQueryChange: (String) -> Unit,
    onSuggestionClick: (String) -> Unit,
    onOpen: (MediaItem) -> Unit
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(StreamoraBg)
            .padding(16.dp)
    ) {
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Try Shogun, resume, cafe…") },
            leadingIcon = { Icon(Icons.Default.Search, null, tint = StreamoraMuted) },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = StreamoraRed,
                unfocusedBorderColor = Color.White.copy(alpha = 0.2f),
                focusedTextColor = StreamoraText,
                unfocusedTextColor = StreamoraText,
                cursorColor = StreamoraRed
            )
        )

        if (suggestions.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            Text("Did you mean", color = StreamoraMuted)
            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                suggestions.forEach { title ->
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(StreamoraSurface)
                            .clickable { onSuggestionClick(title) }
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Text(title, color = StreamoraText, maxLines = 1)
                    }
                }
            }
        }

        when {
            loading -> {
                CircularProgressIndicator(
                    color = StreamoraRed,
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .padding(40.dp)
                )
            }
            query.length >= 2 && results.isEmpty() -> {
                Text(
                    "No matches — try another spelling",
                    color = StreamoraMuted,
                    modifier = Modifier.padding(top = 24.dp)
                )
            }
            else -> {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(110.dp),
                    contentPadding = PaddingValues(vertical = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    items(results, key = { "${it.type}-${it.id}" }) { item ->
                        PosterCard(item = item, onClick = { onOpen(item) }, width = 110)
                    }
                }
            }
        }
    }
}
