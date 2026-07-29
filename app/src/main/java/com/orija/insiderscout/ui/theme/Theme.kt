package com.orija.insiderscout.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Wealthsimple-inspired tokens (warm paper + graphite, magazine fintech)
val WsGraphite = Color(0xFF32302F)
val WsInkSoft = Color(0xFF4D4A46)
val WsMuted = Color(0xFF686664)
val WsFaint = Color(0xFF94908D)
val WsPaper = Color(0xFFFCFCFC)
val WsLinen = Color(0xFFFAF8F5)
val WsFog = Color(0xFFF1F0F0)
val WsStone = Color(0xFFE4E2E1)
val WsBorder = Color(0xFFC9C6C4)
val WsGreen = Color(0xFF486635)
val WsGreenSoft = Color(0xFF99B383)
val WsWarm = Color(0xFFFF8A71)
val WsBronze = Color(0xFF3A3525)

private val LightColors = lightColorScheme(
    primary = WsGraphite,
    onPrimary = WsPaper,
    secondary = WsGreen,
    onSecondary = WsPaper,
    tertiary = WsWarm,
    onTertiary = WsGraphite,
    background = WsLinen,
    onBackground = WsGraphite,
    surface = WsPaper,
    onSurface = WsGraphite,
    surfaceVariant = WsFog,
    onSurfaceVariant = WsMuted,
    outline = WsBorder,
    error = Color(0xFFB42318),
    onError = Color.White,
)

private val AppTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.Medium,
        fontSize = 44.sp,
        lineHeight = 48.sp,
        letterSpacing = (-0.8).sp,
        color = WsGraphite,
    ),
    headlineLarge = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.Medium,
        fontSize = 32.sp,
        lineHeight = 38.sp,
        letterSpacing = (-0.4).sp,
        color = WsGraphite,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.Medium,
        fontSize = 24.sp,
        lineHeight = 30.sp,
        color = WsGraphite,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        color = WsGraphite,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        color = WsGraphite,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        color = WsInkSoft,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        color = WsMuted,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        letterSpacing = 0.1.sp,
        color = WsMuted,
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        letterSpacing = 0.4.sp,
        color = WsFaint,
    ),
)

@Composable
fun InsiderScoutTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColors,
        typography = AppTypography,
        content = content,
    )
}
