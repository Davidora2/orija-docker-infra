package com.streamora.iptv.ui.login

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.streamora.iptv.ui.theme.StreamoraBg
import com.streamora.iptv.ui.theme.StreamoraMuted
import com.streamora.iptv.ui.theme.StreamoraRed
import com.streamora.iptv.ui.theme.StreamoraSurface
import com.streamora.iptv.ui.theme.StreamoraText

@Composable
fun LoginScreen(
    loading: Boolean,
    error: String?,
    onLogin: (server: String, username: String, password: String) -> Unit
) {
    var server by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var visible by remember { mutableStateOf(true) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF1A0508), StreamoraBg, Color(0xFF0A0A12))
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 48.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            AnimatedVisibility(visible = visible, enter = fadeIn() + slideInVertically { it / 3 }) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "STREAMORA",
                        color = StreamoraRed,
                        style = MaterialTheme.typography.displayLarge
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Xtream IPTV, built like a cinema app",
                        color = StreamoraMuted,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }
            Spacer(Modifier.height(40.dp))
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(StreamoraSurface.copy(alpha = 0.85f), RoundedCornerShape(16.dp))
                    .padding(20.dp)
            ) {
                val fieldColors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = StreamoraRed,
                    unfocusedBorderColor = Color.White.copy(alpha = 0.2f),
                    focusedTextColor = StreamoraText,
                    unfocusedTextColor = StreamoraText,
                    cursorColor = StreamoraRed,
                    focusedLabelColor = StreamoraMuted,
                    unfocusedLabelColor = StreamoraMuted
                )
                OutlinedTextField(
                    value = server,
                    onValueChange = { server = it },
                    label = { Text("Stream server URL") },
                    placeholder = { Text("http://host:port") },
                    leadingIcon = { Icon(Icons.Default.Link, null, tint = StreamoraMuted) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = fieldColors,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri)
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Username") },
                    leadingIcon = { Icon(Icons.Default.Person, null, tint = StreamoraMuted) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = fieldColors
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    leadingIcon = { Icon(Icons.Default.Lock, null, tint = StreamoraMuted) },
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = null,
                                tint = StreamoraMuted
                            )
                        }
                    },
                    singleLine = true,
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    colors = fieldColors
                )
                if (!error.isNullOrBlank()) {
                    Spacer(Modifier.height(12.dp))
                    Text(error, color = MaterialTheme.colorScheme.error)
                }
                Spacer(Modifier.height(20.dp))
                Button(
                    onClick = { onLogin(server, username, password) },
                    enabled = !loading && server.isNotBlank() && username.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = StreamoraRed),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    if (loading) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.height(22.dp)
                        )
                    } else {
                        Text("Sign in", style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
            Text(
                "Use your Xtream Codes panel URL, username, and password.",
                color = StreamoraMuted,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}
