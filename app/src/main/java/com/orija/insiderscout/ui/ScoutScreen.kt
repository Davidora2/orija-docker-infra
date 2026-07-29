package com.orija.insiderscout.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.orija.insiderscout.ScoutUiState
import com.orija.insiderscout.data.IdeaSide
import com.orija.insiderscout.data.TradeIdea
import com.orija.insiderscout.ui.theme.WsBorder
import com.orija.insiderscout.ui.theme.WsFaint
import com.orija.insiderscout.ui.theme.WsFog
import com.orija.insiderscout.ui.theme.WsGreen
import com.orija.insiderscout.ui.theme.WsGreenSoft
import com.orija.insiderscout.ui.theme.WsGraphite
import com.orija.insiderscout.ui.theme.WsLinen
import com.orija.insiderscout.ui.theme.WsMuted
import com.orija.insiderscout.ui.theme.WsPaper
import com.orija.insiderscout.ui.theme.WsStone
import com.orija.insiderscout.ui.theme.WsWarm
import java.time.format.DateTimeFormatter
import java.text.NumberFormat
import java.util.Locale

private val SoftCard = RoundedCornerShape(24.dp)
private val Pill = RoundedCornerShape(100.dp)

@Composable
fun ScoutScreen(
    state: ScoutUiState,
    onLookbackChange: (Int) -> Unit,
    onMaxFilingsChange: (Int) -> Unit,
    onScan: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WsLinen),
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Text(
                    text = "Orija",
                    style = MaterialTheme.typography.labelLarge,
                    color = WsMuted,
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "Insider Scout",
                    style = MaterialTheme.typography.displayLarge,
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "See what insiders are buying — ranked ideas with clear buy and sell windows.",
                    style = MaterialTheme.typography.bodyLarge,
                )
            }

            item {
                ControlsCard(
                    state = state,
                    onLookbackChange = onLookbackChange,
                    onMaxFilingsChange = onMaxFilingsChange,
                    onScan = onScan,
                )
            }

            if (state.loading) {
                item {
                    Surface(color = WsPaper, shape = SoftCard) {
                        Row(
                            modifier = Modifier.padding(20.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            CircularProgressIndicator(
                                color = WsGraphite,
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(22.dp),
                            )
                            Text("Scanning public Form 4 filings…", style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            }

            state.error?.let { err ->
                item {
                    Surface(color = Color(0xFFFFEFEA), shape = SoftCard) {
                        Text(
                            text = err,
                            modifier = Modifier.padding(18.dp),
                            color = Color(0xFFB42318),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }

            state.result?.let { result ->
                item {
                    PortfolioSummaryCard(
                        filings = result.filingsConsidered,
                        ideas = result.ideas.size,
                        lookback = result.lookbackDays,
                        longCount = result.ideas.count { it.side == IdeaSide.LONG },
                    )
                }

                item {
                    Text("Ideas", style = MaterialTheme.typography.headlineMedium)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "Ranked from recent open-market insider activity.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }

                if (result.ideas.isEmpty()) {
                    item {
                        EmptyStateCard()
                    }
                }

                itemsIndexed(result.ideas) { index, idea ->
                    AnimatedVisibility(
                        visible = true,
                        enter = fadeIn() + slideInVertically { it / 4 },
                    ) {
                        IdeaCard(index = index, idea = idea)
                    }
                }

                item {
                    Surface(color = WsFog, shape = SoftCard) {
                        Column(modifier = Modifier.padding(18.dp)) {
                            Text("Important", style = MaterialTheme.typography.titleMedium)
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(result.disclaimer, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    Spacer(modifier = Modifier.height(28.dp))
                }
            }
        }
    }
}

@Composable
private fun ControlsCard(
    state: ScoutUiState,
    onLookbackChange: (Int) -> Unit,
    onMaxFilingsChange: (Int) -> Unit,
    onScan: () -> Unit,
) {
    var lookbackText by remember(state.lookbackDays) { mutableStateOf(state.lookbackDays.toString()) }
    var filingsText by remember(state.maxFilings) { mutableStateOf(state.maxFilings.toString()) }
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = WsGraphite,
        unfocusedBorderColor = WsBorder,
        focusedContainerColor = WsPaper,
        unfocusedContainerColor = WsPaper,
        cursorColor = WsGraphite,
        focusedLabelColor = WsMuted,
        unfocusedLabelColor = WsFaint,
    )

    Surface(color = WsPaper, shape = SoftCard) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Scan settings", style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = lookbackText,
                    onValueChange = {
                        lookbackText = it.filter(Char::isDigit).take(2)
                        lookbackText.toIntOrNull()?.let(onLookbackChange)
                    },
                    label = { Text("Lookback days") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    colors = fieldColors,
                )
                OutlinedTextField(
                    value = filingsText,
                    onValueChange = {
                        filingsText = it.filter(Char::isDigit).take(2)
                        filingsText.toIntOrNull()?.let(onMaxFilingsChange)
                    },
                    label = { Text("Max filings") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    colors = fieldColors,
                )
            }
            Button(
                onClick = onScan,
                enabled = !state.loading,
                colors = ButtonDefaults.buttonColors(
                    containerColor = WsGraphite,
                    contentColor = WsPaper,
                    disabledContainerColor = WsStone,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = Pill,
            ) {
                Text(
                    if (state.loading) "Scanning…" else "Update",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                )
            }
        }
    }
}

@Composable
private fun PortfolioSummaryCard(
    filings: Int,
    ideas: Int,
    lookback: Int,
    longCount: Int,
) {
    Surface(color = WsGraphite, shape = SoftCard) {
        Column(modifier = Modifier.padding(22.dp)) {
            Text("Your scan", style = MaterialTheme.typography.labelLarge, color = WsGreenSoft)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "$ideas",
                style = MaterialTheme.typography.displayLarge.copy(color = WsPaper, fontSize = 52.sp),
            )
            Text("ranked opportunities", color = Color(0xFFD8D5D2), style = MaterialTheme.typography.bodyLarge)
            Spacer(modifier = Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                MiniStat("Longs", "$longCount")
                MiniStat("Filings", "$filings")
                MiniStat("Window", "${lookback}d")
            }
        }
    }
}

@Composable
private fun MiniStat(label: String, value: String) {
    Column {
        Text(label, color = Color(0xFFA8A29E), style = MaterialTheme.typography.labelSmall)
        Text(value, color = WsPaper, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
    }
}

@Composable
private fun EmptyStateCard() {
    Surface(color = WsPaper, shape = SoftCard) {
        Column(modifier = Modifier.padding(22.dp)) {
            Text("Nothing to show yet", style = MaterialTheme.typography.titleLarge)
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                "No qualifying open-market buy clusters in this window. Try a wider lookback.",
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun IdeaCard(index: Int, idea: TradeIdea) {
    val context = LocalContext.current
    var expanded by remember { mutableStateOf(index == 0) }
    val money = remember { NumberFormat.getCurrencyInstance(Locale.US) }
    val sideTone = when (idea.side) {
        IdeaSide.LONG -> WsGreen
        IdeaSide.WATCH -> Color(0xFF8A6A20)
        IdeaSide.AVOID -> Color(0xFFB42318)
    }
    val sideBg = when (idea.side) {
        IdeaSide.LONG -> Color(0xFFEAF2E4)
        IdeaSide.WATCH -> Color(0xFFF7F1E0)
        IdeaSide.AVOID -> Color(0xFFFFEFEA)
    }

    Surface(
        color = WsPaper,
        shape = SoftCard,
        modifier = Modifier
            .fillMaxWidth()
            .clickable { expanded = !expanded },
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(WsFog),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = idea.ticker.take(2),
                        fontWeight = FontWeight.SemiBold,
                        color = WsGraphite,
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(idea.ticker, style = MaterialTheme.typography.titleLarge)
                    Text(
                        idea.issuerName,
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = idea.grade,
                        style = MaterialTheme.typography.headlineMedium,
                        color = sideTone,
                    )
                    Text("${idea.rankScore.toInt()} score", style = MaterialTheme.typography.labelSmall)
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                StatusPill(idea.side.name.lowercase().replaceFirstChar { it.titlecase() }, sideTone, sideBg)
                StatusPill(money.format(idea.totalBuyValue) + " buys", WsMuted, WsFog)
            }

            Spacer(modifier = Modifier.height(12.dp))
            Text(idea.summary, style = MaterialTheme.typography.bodyLarge)

            Spacer(modifier = Modifier.height(14.dp))
            TimingGrid(idea)

            AnimatedVisibility(expanded) {
                Column {
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(idea.timing.rationale, style = MaterialTheme.typography.bodyMedium)
                    Spacer(modifier = Modifier.height(12.dp))
                    FactorBars(idea)
                    Spacer(modifier = Modifier.height(12.dp))
                    idea.formUrls.take(2).forEach { url ->
                        TextButton(
                            onClick = {
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                            },
                            colors = ButtonDefaults.textButtonColors(contentColor = WsGraphite),
                        ) {
                            Text("View Form 4 filing")
                        }
                    }
                }
            }

            Text(
                text = if (expanded) "Show less" else "Show details",
                style = MaterialTheme.typography.labelLarge,
                color = WsGraphite,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

@Composable
private fun StatusPill(text: String, fg: Color, bg: Color) {
    Box(
        modifier = Modifier
            .clip(Pill)
            .background(bg)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(text, color = fg, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun TimingGrid(idea: TradeIdea) {
    val fmt = DateTimeFormatter.ofPattern("MMM d")
    Surface(
        color = WsFog,
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            TimingRow("Buy", "${idea.timing.entryWindowStart.format(fmt)} – ${idea.timing.entryWindowEnd.format(fmt)}")
            TimingRow("Review", idea.timing.reviewDate.format(fmt))
            TimingRow("Sell", "${idea.timing.targetExitStart.format(fmt)} – ${idea.timing.targetExitEnd.format(fmt)}")
        }
    }
}

@Composable
private fun TimingRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = WsMuted)
        Text(value, style = MaterialTheme.typography.titleMedium)
    }
}

@Composable
private fun FactorBars(idea: TradeIdea) {
    val rows = listOf(
        "Open-market" to idea.factors.openMarketBuy,
        "Cluster" to idea.factors.clusterBuying,
        "Role" to idea.factors.roleWeight,
        "Size" to idea.factors.sizeConviction,
        "Recency" to idea.factors.recency,
        "Sell drag" to idea.factors.sellPressurePenalty,
    )
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        rows.forEach { (label, value) ->
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(label, style = MaterialTheme.typography.labelLarge)
                    Text("${(value * 100).toInt()}%", style = MaterialTheme.typography.labelLarge)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(Pill)
                        .background(WsStone),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(value.toFloat().coerceIn(0f, 1f))
                            .height(6.dp)
                            .clip(Pill)
                            .background(if (label == "Sell drag") WsWarm else WsGreen),
                    )
                }
            }
        }
    }
}
