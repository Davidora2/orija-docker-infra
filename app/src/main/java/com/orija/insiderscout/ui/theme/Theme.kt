package com.orija.insiderscout.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Typography

private val TealDeep = Color(0xFF0A4641)
private val Teal = Color(0xFF0F6B63)
private val Ink = Color(0xFF10242B)
private val InkSoft = Color(0xFF3A545C)
private val Paper = Color(0xFFEEF3F5)
private val Coral = Color(0xFFC15B3A)
private val Sand = Color(0xFFD9C4A5)

private val LightColors = lightColorScheme(
    primary = Teal,
    onPrimary = Color(0xFFF4FFFD),
    secondary = Coral,
    onSecondary = Color.White,
    background = Paper,
    onBackground = Ink,
    surface = Color(0xFFF7FAFB),
    onSurface = Ink,
    surfaceVariant = Color(0xFFE2EBEF),
    onSurfaceVariant = InkSoft,
    tertiary = Sand,
)

private val AppTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.Bold,
        fontSize = 56.sp,
        lineHeight = 58.sp,
        letterSpacing = (-1.5).sp,
        color = TealDeep,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 28.sp,
        color = TealDeep,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
        color = Ink,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        color = Ink,
        lineHeight = 24.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontSize = 14.sp,
        color = InkSoft,
        lineHeight = 20.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        letterSpacing = 1.2.sp,
        color = InkSoft,
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
