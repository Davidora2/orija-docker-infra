package com.localaide.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Typography

private val Ink = Color(0xFF1A2A24)
private val Paper = Color(0xFFF3EFE6)
private val Moss = Color(0xFF2F6B4F)
private val MossDeep = Color(0xFF1E4634)
private val Clay = Color(0xFFC46B3A)
private val Mist = Color(0xFFD9E5DD)
private val Fog = Color(0xFFE8E2D6)

private val LightColors = lightColorScheme(
    primary = Moss,
    onPrimary = Color.White,
    primaryContainer = Mist,
    onPrimaryContainer = MossDeep,
    secondary = Clay,
    onSecondary = Color.White,
    background = Paper,
    onBackground = Ink,
    surface = Fog,
    onSurface = Ink,
    surfaceVariant = Mist,
    onSurfaceVariant = MossDeep,
    outline = Color(0xFF9BB0A4)
)

private val DarkColors = darkColorScheme(
    primary = Mist,
    onPrimary = MossDeep,
    primaryContainer = Moss,
    onPrimaryContainer = Paper,
    secondary = Clay,
    onSecondary = Color.White,
    background = Color(0xFF121A16),
    onBackground = Paper,
    surface = Color(0xFF1A2620),
    onSurface = Paper
)

private val AppTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.Bold,
        fontSize = 44.sp,
        lineHeight = 48.sp,
        letterSpacing = (-0.5).sp
    ),
    headlineLarge = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 30.sp,
        lineHeight = 36.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontSize = 14.sp,
        lineHeight = 20.sp
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp
    )
)

@Composable
fun LocalAideTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    // Prefer light brand atmosphere; only flip if system is dark
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = AppTypography,
        content = content
    )
}
