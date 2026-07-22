package com.streamora.iptv.ui.profiles

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChildCare
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.streamora.iptv.data.db.ProfileEntity
import com.streamora.iptv.ui.theme.StreamoraBg
import com.streamora.iptv.ui.theme.StreamoraMuted
import com.streamora.iptv.ui.theme.StreamoraRed
import com.streamora.iptv.ui.theme.StreamoraText

private val AvatarPalette = listOf(
    0xFFE50914L, 0xFF46D369L, 0xFF0071EBL, 0xFFF5C518L,
    0xFFAF52DEL, 0xFFFF9500L, 0xFF5AC8FAL, 0xFFFF2D55L
)

@Composable
fun ProfilesScreen(
    profiles: List<ProfileEntity>,
    onSelect: (Long) -> Unit,
    onCreate: (name: String, color: Long, isKids: Boolean) -> Unit,
    onLogout: () -> Unit
) {
    var showCreate by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(listOf(Color(0xFF14080C), StreamoraBg))
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(48.dp))
            Text("STREAMORA", color = StreamoraRed, style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(12.dp))
            Text("Who's watching?", style = MaterialTheme.typography.headlineLarge, color = StreamoraText)
            Spacer(Modifier.height(32.dp))

            LazyVerticalGrid(
                columns = GridCells.Adaptive(120.dp),
                contentPadding = PaddingValues(8.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
                modifier = Modifier.weight(1f)
            ) {
                items(profiles, key = { it.id }) { profile ->
                    ProfileAvatar(
                        name = profile.name,
                        color = Color(profile.avatarColor),
                        isKids = profile.isKids,
                        onClick = { onSelect(profile.id) }
                    )
                }
                item {
                    ProfileAvatar(
                        name = "Add profile",
                        color = Color.Transparent,
                        isAdd = true,
                        onClick = { showCreate = true }
                    )
                }
            }

            TextButton(onClick = onLogout) {
                Text("Sign out", color = StreamoraMuted)
            }
        }
    }

    if (showCreate) {
        CreateProfileDialog(
            onDismiss = { showCreate = false },
            onConfirm = { name, color, kids ->
                showCreate = false
                onCreate(name, color, kids)
            }
        )
    }
}

@Composable
private fun ProfileAvatar(
    name: String,
    color: Color,
    onClick: () -> Unit,
    isKids: Boolean = false,
    isAdd: Boolean = false
) {
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.94f else 1f,
        animationSpec = tween(120),
        label = "avatarScale"
    )
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .scale(scale)
            .clickable {
                pressed = true
                onClick()
            }
    ) {
        Box(
            modifier = Modifier
                .size(96.dp)
                .clip(RoundedCornerShape(8.dp))
                .then(
                    if (isAdd) Modifier.border(2.dp, StreamoraMuted.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                    else Modifier.background(color)
                ),
            contentAlignment = Alignment.Center
        ) {
            when {
                isAdd -> Icon(Icons.Default.Add, null, tint = StreamoraMuted, modifier = Modifier.size(40.dp))
                isKids -> Icon(Icons.Default.ChildCare, null, tint = Color.White, modifier = Modifier.size(40.dp))
                else -> Icon(Icons.Default.Person, null, tint = Color.White, modifier = Modifier.size(40.dp))
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(
            name,
            color = StreamoraText,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            maxLines = 1
        )
    }
}

@Composable
private fun CreateProfileDialog(
    onDismiss: () -> Unit,
    onConfirm: (String, Long, Boolean) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var kids by remember { mutableStateOf(false) }
    var color by remember { mutableStateOf(AvatarPalette.first()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1A1A22),
        title = { Text("Add profile", color = StreamoraText) },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(12.dp))
                Text("Avatar color", color = StreamoraMuted)
                Spacer(Modifier.height(8.dp))
                androidx.compose.foundation.layout.Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AvatarPalette.forEach { c ->
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(Color(c))
                                .then(
                                    if (c == color) Modifier.border(2.dp, Color.White, CircleShape)
                                    else Modifier
                                )
                                .clickable { color = c }
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                TextButton(onClick = { kids = !kids }) {
                    Text(if (kids) "Kids profile: On" else "Kids profile: Off")
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { if (name.isNotBlank()) onConfirm(name.trim(), color, kids) },
                colors = ButtonDefaults.buttonColors(containerColor = StreamoraRed)
            ) { Text("Create") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
