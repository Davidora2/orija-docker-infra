package com.orija.insiderscout.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.orija.insiderscout.PoliticsUiState
import com.orija.insiderscout.data.politics.Country
import com.orija.insiderscout.data.politics.DisclosureKind
import com.orija.insiderscout.data.politics.PoliticianDisclosure
import com.orija.insiderscout.data.politics.PricePoint
import com.orija.insiderscout.data.politics.TradePerformance
import com.orija.insiderscout.data.politics.TradeSide
import com.orija.insiderscout.ui.theme.WsFog
import com.orija.insiderscout.ui.theme.WsGreen
import com.orija.insiderscout.ui.theme.WsGraphite
import com.orija.insiderscout.ui.theme.WsLinen
import com.orija.insiderscout.ui.theme.WsMuted
import com.orija.insiderscout.ui.theme.WsPaper
import com.orija.insiderscout.ui.theme.WsWarm
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs

private val SoftCard = RoundedCornerShape(24.dp)
private val Pill = RoundedCornerShape(100.dp)

@Composable
fun PoliticiansScreen(
    state: PoliticsUiState,
    onCountry: (Country) -> Unit,
    onRefresh: () -> Unit,
    onOpen: (PoliticianDisclosure) -> Unit,
    onBackFromDetail: () -> Unit,
) {
    val selected = state.selected
    if (selected != null) {
        PoliticianTradeDetailScreen(
            disclosure = selected,
            performance = state.performance,
            chartLoading = state.chartLoading,
            onBack = onBackFromDetail,
        )
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WsLinen),
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Text("Politicians", style = MaterialTheme.typography.displayLarge.copy(fontSize = 40.sp))
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    "Track serving lawmakers in the US, UK, and Canada — public trades and private-company filings.",
                    style = MaterialTheme.typography.bodyLarge,
                )
            }

            item {
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Country.entries.forEach { c ->
                        FilterChip(
                            selected = state.country == c,
                            onClick = { onCountry(c) },
                            label = { Text(c.label) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = WsGraphite,
                                selectedLabelColor = WsPaper,
                                containerColor = WsPaper,
                                labelColor = WsGraphite,
                            ),
                            shape = Pill,
                        )
                    }
                }
            }

            item {
                CountryExplainer(state.country)
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        when (state.country) {
                            Country.US -> "Recent STOCK Act trades"
                            Country.UK -> "Private interests & companies"
                            Country.CA -> "Serving MPs & registries"
                        },
                        style = MaterialTheme.typography.headlineMedium,
                    )
                    TextButton(onClick = onRefresh) { Text("Refresh") }
                }
            }

            if (state.loading) {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(color = WsGraphite, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("Loading disclosures…")
                    }
                }
            }

            state.error?.let { err ->
                item {
                    Surface(color = Color(0xFFFFEFEA), shape = SoftCard) {
                        Text(err, modifier = Modifier.padding(16.dp), color = Color(0xFFB42318))
                    }
                }
            }

            items(state.items, key = { it.id }) { item ->
                DisclosureCard(item = item, onClick = { onOpen(item) })
            }

            item { Spacer(modifier = Modifier.height(72.dp)) }
        }
    }
}

@Composable
private fun CountryExplainer(country: Country) {
    val text = when (country) {
        Country.US -> "US House & Senate Periodic Transaction Reports (STOCK Act). Annual disclosures can also list private / non-public holdings."
        Country.UK -> "UK Register of Members’ Financial Interests — directorships, shareholdings, partnerships, and paid roles in private companies."
        Country.CA -> "Canadian MPs don’t publish a STOCK Act-style trade feed. Open serving members and jump to the Conflict of Interest public registry for private-company assets."
    }
    Surface(color = WsFog, shape = SoftCard) {
        Text(text, modifier = Modifier.padding(16.dp), style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun DisclosureCard(item: PoliticianDisclosure, onClick: () -> Unit) {
    val sideColor = when (item.side) {
        TradeSide.BUY -> WsGreen
        TradeSide.SELL -> Color(0xFFB42318)
        else -> WsMuted
    }
    Surface(
        color = WsPaper,
        shape = SoftCard,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(WsFog),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        item.member.name.split(" ").mapNotNull { it.firstOrNull()?.uppercaseChar() }.take(2).joinToString(""),
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(item.member.name, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        listOfNotNull(item.member.chamber, item.member.party, item.member.districtOrRiding)
                            .joinToString(" · "),
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (item.ticker != null) {
                    Text(item.ticker, style = MaterialTheme.typography.titleMedium, color = WsGraphite)
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item.side?.let {
                    MiniPill(it.name.lowercase().replaceFirstChar { c -> c.titlecase(Locale.US) }, sideColor)
                }
                MiniPill(
                    if (item.isPrivateCompany) "Private company" else kindLabel(item.kind),
                    if (item.isPrivateCompany) WsWarm else WsMuted,
                )
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(item.assetName, style = MaterialTheme.typography.bodyLarge, maxLines = 3, overflow = TextOverflow.Ellipsis)
            item.amountRange?.let {
                Text(it.replace("\n", " "), style = MaterialTheme.typography.labelLarge, color = WsMuted)
            }
        }
    }
}

@Composable
private fun MiniPill(text: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(Pill)
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 10.dp, vertical = 5.dp),
    ) {
        Text(text, color = color, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
    }
}

private fun kindLabel(kind: DisclosureKind): String = when (kind) {
    DisclosureKind.PUBLIC_TRADE -> "Public trade"
    DisclosureKind.PRIVATE_COMPANY -> "Private company"
    DisclosureKind.DIRECTORSHIP -> "Directorship"
    DisclosureKind.SHAREHOLDING -> "Shareholding"
    DisclosureKind.EMPLOYMENT -> "Employment"
    DisclosureKind.PARTNERSHIP -> "Partnership"
    DisclosureKind.OTHER -> "Disclosure"
}

@Composable
fun PoliticianTradeDetailScreen(
    disclosure: PoliticianDisclosure,
    performance: TradePerformance?,
    chartLoading: Boolean,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd")
    val ret = performance?.returnSinceTradePct
    val retColor = when {
        ret == null -> WsMuted
        ret >= 0 -> WsGreen
        else -> Color(0xFFB42318)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WsLinen),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp),
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = WsGraphite)
            }
            Text("Disclosure", style = MaterialTheme.typography.titleMedium)
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(WsFog),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        disclosure.member.name.split(" ").mapNotNull { it.firstOrNull()?.uppercaseChar() }.take(2).joinToString(""),
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(disclosure.member.name, style = MaterialTheme.typography.headlineMedium)
                    Text(
                        listOfNotNull(disclosure.member.chamber, disclosure.member.party).joinToString(" · "),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                disclosure.ticker?.let {
                    Text(it, style = MaterialTheme.typography.displayLarge.copy(fontSize = 34.sp))
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                disclosure.member.profileUrl?.let { url ->
                    TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }) {
                        Text("Politician profile")
                    }
                }
                disclosure.ticker?.let { ticker ->
                    TextButton(
                        onClick = {
                            context.startActivity(
                                Intent(Intent.ACTION_VIEW, Uri.parse("https://finance.yahoo.com/quote/$ticker")),
                            )
                        },
                    ) { Text("$ticker in market") }
                }
            }

            Surface(color = WsPaper, shape = SoftCard) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(disclosure.assetName, style = MaterialTheme.typography.titleLarge)
                            disclosure.amountRange?.let {
                                Text(it.replace("\n", " "), style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                        if (ret != null) {
                            Text(
                                (if (ret >= 0) "+" else "") + String.format(Locale.US, "%.0f%%", ret),
                                color = retColor,
                                fontWeight = FontWeight.Bold,
                                fontSize = 28.sp,
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    when {
                        chartLoading -> {
                            Box(modifier = Modifier.fillMaxWidth().height(180.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(color = WsGraphite, strokeWidth = 2.dp)
                            }
                        }
                        performance != null && performance.points.size >= 2 && disclosure.ticker != null -> {
                            PriceChart(
                                points = performance.points,
                                anchorDate = disclosure.tradeDate ?: disclosure.filedDate,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(200.dp),
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            disclosure.tradeDate?.let {
                                Text(
                                    "They traded here: ${it.format(fmt)}" +
                                        (performance.priceAtTrade?.let { px -> " · close $${"%.2f".format(px)}" } ?: ""),
                                    style = MaterialTheme.typography.labelLarge,
                                    color = WsGreen,
                                )
                            }
                        }
                        disclosure.isPrivateCompany || disclosure.ticker.isNullOrBlank() -> {
                            Text(
                                "Private-company / non-listed interests don’t have a public price chart. Review the source filing for ownership details.",
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                        else -> {
                            Text("No market history available for this ticker.", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }

            if (performance != null && disclosure.ticker != null) {
                Text("Performance", style = MaterialTheme.typography.headlineMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PerfCard(
                        title = "Since trade",
                        value = performance.returnSinceTradePct,
                        modifier = Modifier.weight(1f),
                    )
                    PerfCard(
                        title = "Since disclosure",
                        value = performance.returnSinceDisclosurePct,
                        modifier = Modifier.weight(1f),
                    )
                }
                val from = performance.priceAtTrade
                val to = performance.priceNow
                if (from != null && to != null) {
                    Text(
                        "Trade/disclosure $${"%.2f".format(from)} → now $${"%.2f".format(to)}",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }

            Surface(color = WsFog, shape = SoftCard) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Filing facts", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Fact("Country", disclosure.member.country.label)
                    Fact("Type", kindLabel(disclosure.kind))
                    disclosure.tradeDate?.let { Fact("Trade date", it.format(fmt)) }
                    disclosure.filedDate?.let { Fact("Filed", it.format(fmt)) }
                    Fact("Source", disclosure.sourceLabel)
                }
            }

            disclosure.sourceUrl?.let { url ->
                Button(
                    onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = Pill,
                    colors = ButtonDefaults.buttonColors(containerColor = WsGraphite, contentColor = WsPaper),
                ) {
                    Text("Open official filing / registry", fontWeight = FontWeight.SemiBold)
                }
            }

            Text(
                "Educational research only — not investment advice. Disclosures can be delayed and incomplete.",
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(modifier = Modifier.height(28.dp))
        }
    }
}

@Composable
private fun Fact(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = WsMuted)
        Text(value, style = MaterialTheme.typography.titleMedium)
    }
}

@Composable
private fun PerfCard(title: String, value: Double?, modifier: Modifier = Modifier) {
    val color = when {
        value == null -> WsMuted
        value >= 0 -> WsGreen
        else -> Color(0xFFB42318)
    }
    Surface(color = WsPaper, shape = SoftCard, modifier = modifier) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title.uppercase(Locale.US), style = MaterialTheme.typography.labelSmall, color = WsMuted)
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                value?.let { (if (it >= 0) "+" else "") + String.format(Locale.US, "%.2f%%", it) } ?: "—",
                color = color,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
            )
        }
    }
}

@Composable
private fun PriceChart(
    points: List<PricePoint>,
    anchorDate: java.time.LocalDate?,
    modifier: Modifier = Modifier,
) {
    val line = WsGreen
    val before = Color(0xFFB0ACA7)
    Canvas(modifier = modifier.background(WsFog, RoundedCornerShape(18.dp)).padding(12.dp)) {
        if (points.size < 2) return@Canvas
        val min = points.minOf { it.close }
        val max = points.maxOf { it.close }
        val span = (max - min).takeIf { abs(it) > 1e-6 } ?: 1.0
        val w = size.width
        val h = size.height
        fun x(i: Int) = w * i / (points.size - 1).toFloat()
        fun y(v: Double) = h - (((v - min) / span).toFloat() * h)

        val anchorIdx = anchorDate?.let { d ->
            points.indexOfFirst { !it.date.isBefore(d) }.takeIf { it >= 0 } ?: 0
        } ?: 0

        val beforePath = Path()
        val afterPath = Path()
        points.forEachIndexed { i, p ->
            val px = x(i)
            val py = y(p.close)
            if (i <= anchorIdx) {
                if (i == 0) beforePath.moveTo(px, py) else beforePath.lineTo(px, py)
            }
            if (i >= anchorIdx) {
                if (i == anchorIdx) afterPath.moveTo(px, py) else afterPath.lineTo(px, py)
            }
        }
        drawPath(beforePath, color = before, style = Stroke(width = 4f, cap = StrokeCap.Round))
        drawPath(afterPath, color = line, style = Stroke(width = 5f, cap = StrokeCap.Round))
        val ax = x(anchorIdx)
        val ay = y(points[anchorIdx].close)
        drawCircle(color = line, radius = 8f, center = Offset(ax, ay))
        drawCircle(color = Color.White, radius = 3.5f, center = Offset(ax, ay))
    }
}
