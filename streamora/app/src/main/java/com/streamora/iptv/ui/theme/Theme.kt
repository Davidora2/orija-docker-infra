package com.streamora.iptv.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val StreamoraRed = Color(0xFFE50914)
val StreamoraBg = Color(0xFF0B0B0F)
val StreamoraSurface = Color(0xFF16161D)
val StreamoraSurfaceElevated = Color(0xFF1E1E28)
val StreamoraText = Color(0xFFF5F5F7)
val StreamoraMuted = Color(0xFFA0A0B0)
val StreamoraAccent = Color(0xFF46D369)

private val DarkColors = darkColorScheme(
    primary = StreamoraRed,
    onPrimary = Color.White,
    secondary = StreamoraAccent,
    background = StreamoraBg,
    onBackground = StreamoraText,
    surface = StreamoraSurface,
    onSurface = StreamoraText,
    surfaceVariant = StreamoraSurfaceElevated,
    onSurfaceVariant = StreamoraMuted,
    error = Color(0xFFFF6B6B)
)

@Composable
fun StreamoraTheme(content: @Composable () -> Unit) {
    // Cinema dark theme by design (streaming app), ignore system light.
    @Suppress("UNUSED_VARIABLE")
    val unused = isSystemInDarkTheme()
    MaterialTheme(
        colorScheme = DarkColors,
        typography = MaterialTheme.typography.copy(
            displayLarge = TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.Bold,
                fontSize = 40.sp,
                letterSpacing = (-0.5).sp,
                color = StreamoraText
            ),
            headlineLarge = TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp,
                color = StreamoraText
            ),
            headlineMedium = TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.SemiBold,
                fontSize = 22.sp,
                color = StreamoraText
            ),
            titleLarge = TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.SemiBold,
                fontSize = 18.sp,
                color = StreamoraText
            ),
            bodyLarge = TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.Normal,
                fontSize = 16.sp,
                color = StreamoraText
            ),
            bodyMedium = TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.Normal,
                fontSize = 14.sp,
                color = StreamoraMuted
            ),
            labelLarge = TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = StreamoraText
            )
        ),
        content = content
    )
}
