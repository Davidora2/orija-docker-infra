package com.orija.insiderscout.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.orija.insiderscout.ScoutUiState
import com.orija.insiderscout.data.IdeaSide
import com.orija.insiderscout.data.TradeIdea
import java.time.format.DateTimeFormatter

@Composable
fun ScoutScreen(
    state: ScoutUiState,
    onLookbackChange: (Int) -> Unit,
    onMaxFilingsChange: (Int) -> Unit,
    onScan: () -> Unit,
) {
    val gradient = Brush.verticalGradient(
        listOf(Color(0xFFEEF3F5), Color(0xFFE2EBEF), Color(0xFFDFE8EC)),
    )
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(gradient),
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Text(
                    text = "PUBLIC FORM 4 · RESEARCH",
                    style = MaterialTheme.typography.labelLarge,
                    color = Color(0xFFC15B3A),
                )
                Text(
                    text = "Orija",
                    style = MaterialTheme.typography.displayLarge,
                )
                Text(
                    text = "Insider Scout",
                    style = MaterialTheme.typography.headlineMedium,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Rank recent SEC Form 4 open-market activity and map a buy window plus staged exit band.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            item {
                ControlsRow(
                    state = state,
                    onLookbackChange = onLookbackChange,
                    onMaxFilingsChange = onMaxFilingsChange,
                    onScan = onScan,
                )
            }

            if (state.loading) {
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        CircularProgressIndicator(color = Color(0xFF0F6B63))
                        Text("Scanning EDGAR Form 4 filings…")
                    }
                }
            }

            state.error?.let { err ->
                item {
                    Surface(color = Color(0x22C15B3A), shape = RoundedCornerShape(0.dp)) {
                        Text(
                            text = err,
                            modifier = Modifier.padding(12.dp),
                            color = Color(0xFFC15B3A),
                        )
                    }
                }
            }

            state.result?.let { result ->
                item {
                    MetaStrip(
                        filings = result.filingsConsidered,
                        ideas = result.ideas.size,
                        lookback = result.lookbackDays,
                    )
                }
                item {
                    Text("Ranked opportunities", style = MaterialTheme.typography.headlineMedium)
                    Text(
                        "Scores favor clustered open-market buys by senior officers after filing.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                if (result.ideas.isEmpty()) {
                    item {
                        Text(
                            "No qualifying open-market buy clusters in this window. Widen lookback or raise filings.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
                itemsIndexed(result.ideas) { index, idea ->
                    AnimatedVisibility(
                        visible = true,
                        enter = fadeIn() + slideInVertically { it / 3 },
                    ) {
                        IdeaRow(index = index, idea = idea)
                    }
                }
                item {
                    HorizontalDivider(color = Color(0x2210242B))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Disclaimer", style = MaterialTheme.typography.titleLarge)
                    Text(result.disclaimer, style = MaterialTheme.typography.bodyMedium)
                    Spacer(modifier = Modifier.height(24.dp))
                }
            }
        }
    }
}

@Composable
private fun ControlsRow(
    state: ScoutUiState,
    onLookbackChange: (Int) -> Unit,
    onMaxFilingsChange: (Int) -> Unit,
    onScan: () -> Unit,
) {
    var lookbackText by remember(state.lookbackDays) { mutableStateOf(state.lookbackDays.toString()) }
    var filingsText by remember(state.maxFilings) { mutableStateOf(state.maxFilings.toString()) }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
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
            )
        }
        Button(
            onClick = onScan,
            enabled = !state.loading,
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F6B63)),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(0.dp),
        ) {
            Text("Rescan EDGAR")
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MetaStrip(filings: Int, ideas: Int, lookback: Int) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        MetaChip("Filings", filings.toString())
        MetaChip("Ideas", ideas.toString())
        MetaChip("Lookback", "${lookback}d")
    }
}

@Composable
private fun MetaChip(label: String, value: String) {
    Column {
        Text(label.uppercase(), style = MaterialTheme.typography.labelLarge)
        Text(value, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
    }
}

@Composable
private fun IdeaRow(index: Int, idea: TradeIdea) {
    val context = LocalContext.current
    var expanded by remember { mutableStateOf(index == 0) }
    val sideColor = when (idea.side) {
        IdeaSide.LONG -> Color(0xFF0F6B63)
        IdeaSide.WATCH -> Color(0xFF8A6A20)
        IdeaSide.AVOID -> Color(0xFFC15B3A)
    }
    val gradeColor = when (idea.grade) {
        "A", "B" -> Color(0xFF0F6B63)
        "C" -> Color(0xFF8A6A20)
        else -> Color(0xFFC15B3A)
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
    ) {
        HorizontalDivider(color = Color(0x2210242B))
        Spacer(modifier = Modifier.height(12.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.width(52.dp),
            ) {
                Text(idea.grade, color = gradeColor, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Text("${idea.rankScore.toInt()}", style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = idea.ticker,
                        style = MaterialTheme.typography.headlineMedium.copy(fontSize = 24.sp),
                    )
                    Text(
                        text = idea.side.name,
                        color = sideColor,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        fontSize = 12.sp,
                    )
                }
                Text(idea.issuerName, style = MaterialTheme.typography.bodyMedium)
                Spacer(modifier = Modifier.height(6.dp))
                Text(idea.summary, style = MaterialTheme.typography.bodyLarge)
                Spacer(modifier = Modifier.height(10.dp))
                TimingBlock(idea)
                Spacer(modifier = Modifier.height(6.dp))
                Text(idea.timing.rationale, style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = { expanded = !expanded }) {
                    Text(if (expanded) "Hide factors" else "Signal factors & filings")
                }
                AnimatedVisibility(expanded) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        FactorLine("Open-market", idea.factors.openMarketBuy)
                        FactorLine("Cluster", idea.factors.clusterBuying)
                        FactorLine("Role", idea.factors.roleWeight)
                        FactorLine("Size", idea.factors.sizeConviction)
                        FactorLine("Recency", idea.factors.recency)
                        FactorLine("Sell penalty", idea.factors.sellPressurePenalty)
                        idea.formUrls.take(2).forEach { url ->
                            OutlinedButton(
                                onClick = {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                },
                                shape = RoundedCornerShape(0.dp),
                            ) {
                                Text("Open Form 4")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TimingBlock(idea: TradeIdea) {
    val fmt = DateTimeFormatter.ISO_LOCAL_DATE
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        TimingLine("Buy window", "${idea.timing.entryWindowStart.format(fmt)} → ${idea.timing.entryWindowEnd.format(fmt)}")
        TimingLine("Review", idea.timing.reviewDate.format(fmt))
        TimingLine("Sell window", "${idea.timing.targetExitStart.format(fmt)} → ${idea.timing.targetExitEnd.format(fmt)}")
        TimingLine("Stop review", "${idea.timing.stopReviewDays} trading days")
    }
}

@Composable
private fun TimingLine(label: String, value: String) {
    Column {
        Text(label.uppercase(), style = MaterialTheme.typography.labelLarge)
        Text(value, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun FactorLine(label: String, value: Double) {
    Text("$label ${(value * 100).toInt()}%", style = MaterialTheme.typography.bodyMedium)
}
