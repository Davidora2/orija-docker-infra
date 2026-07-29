package com.orija.insiderscout.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.orija.insiderscout.data.InsiderTransaction
import com.orija.insiderscout.data.SecFilingUrls
import com.orija.insiderscout.data.TradeIdea
import com.orija.insiderscout.data.TransactionSide
import com.orija.insiderscout.ui.theme.WsFog
import com.orija.insiderscout.ui.theme.WsGreen
import com.orija.insiderscout.ui.theme.WsGraphite
import com.orija.insiderscout.ui.theme.WsLinen
import com.orija.insiderscout.ui.theme.WsMuted
import com.orija.insiderscout.ui.theme.WsPaper
import java.text.NumberFormat
import java.time.format.DateTimeFormatter
import java.util.Locale

private val SoftCard = RoundedCornerShape(24.dp)
private val Pill = RoundedCornerShape(100.dp)

@Composable
fun Form4DetailScreen(
    idea: TradeIdea,
    formUrl: String,
    onBack: () -> Unit,
) {
    val money = remember { NumberFormat.getCurrencyInstance(Locale.US) }
    val dateFmt = remember { DateTimeFormatter.ofPattern("MMM d, yyyy") }
    val txs = remember(idea, formUrl) {
        idea.transactions.filter { it.formUrl == formUrl }.ifEmpty { idea.transactions }
    }
    val owner = txs.firstOrNull()?.ownerName ?: "Reporting owner"
    val roles = txs.firstOrNull()?.roles?.joinToString(" · ") { it.name.lowercase().replace('_', ' ') }
        ?.replaceFirstChar { it.titlecase(Locale.getDefault()) }
        .orEmpty()
    var showOfficial by remember { mutableStateOf(false) }

    if (showOfficial) {
        OfficialFilingWebScreen(
            rawUrl = formUrl,
            title = "${idea.ticker} Form 4",
            onBack = { showOfficial = false },
        )
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WsLinen),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = WsGraphite)
            }
            Text("Form 4", style = MaterialTheme.typography.titleMedium)
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Text("Statement of changes in beneficial ownership", style = MaterialTheme.typography.labelLarge, color = WsMuted)
                Spacer(modifier = Modifier.height(6.dp))
                Text(idea.ticker, style = MaterialTheme.typography.displayLarge.copy(fontSize = 40.sp))
                Text(idea.issuerName, style = MaterialTheme.typography.bodyLarge)
            }

            item {
                Surface(color = WsPaper, shape = SoftCard) {
                    Row(
                        modifier = Modifier.padding(18.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(WsFog),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                owner.split(" ").mapNotNull { it.firstOrNull()?.uppercaseChar() }.take(2).joinToString(""),
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(owner, style = MaterialTheme.typography.titleLarge)
                            if (roles.isNotBlank()) {
                                Text(roles, style = MaterialTheme.typography.bodyMedium)
                            }
                            txs.firstOrNull()?.filedAt?.let {
                                Text("Filed ${it.toLocalDate().format(dateFmt)}", style = MaterialTheme.typography.labelLarge)
                            }
                        }
                    }
                }
            }

            item {
                Text("Transactions", style = MaterialTheme.typography.headlineMedium)
                Text("Open-market and reported activity from this filing.", style = MaterialTheme.typography.bodyMedium)
            }

            if (txs.isEmpty()) {
                item {
                    Surface(color = WsPaper, shape = SoftCard) {
                        Text(
                            "No open-market P/S rows were extracted from this filing.",
                            modifier = Modifier.padding(18.dp),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }

            items(txs) { tx ->
                TransactionCard(tx = tx, money = money, dateFmt = dateFmt)
            }

            item {
                Button(
                    onClick = { showOfficial = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = Pill,
                    colors = ButtonDefaults.buttonColors(containerColor = WsGraphite, contentColor = WsPaper),
                ) {
                    Text("View formatted SEC filing", fontWeight = FontWeight.SemiBold)
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Opens the SEC HTML Form 4 (not raw XML).",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(modifier = Modifier.height(28.dp))
            }
        }
    }
}

@Composable
private fun TransactionCard(
    tx: InsiderTransaction,
    money: NumberFormat,
    dateFmt: DateTimeFormatter,
) {
    val sideColor = if (tx.side == TransactionSide.BUY) WsGreen else Color(0xFFB42318)
    val sideBg = if (tx.side == TransactionSide.BUY) Color(0xFFEAF2E4) else Color(0xFFFFEFEA)
    Surface(color = WsPaper, shape = SoftCard) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .clip(Pill)
                        .background(sideBg)
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    Text(
                        tx.side.name.lowercase().replaceFirstChar { it.titlecase(Locale.getDefault()) },
                        color = sideColor,
                        fontWeight = FontWeight.SemiBold,
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
                Text("Code ${tx.code}", style = MaterialTheme.typography.labelLarge, color = WsMuted)
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = NumberFormat.getNumberInstance(Locale.US).format(tx.shares) + " shares",
                style = MaterialTheme.typography.headlineMedium,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                Column {
                    Text("Price", style = MaterialTheme.typography.labelSmall, color = WsMuted)
                    Text(tx.price?.let { money.format(it) } ?: "—", style = MaterialTheme.typography.titleMedium)
                }
                Column {
                    Text("Value", style = MaterialTheme.typography.labelSmall, color = WsMuted)
                    Text(tx.value?.let { money.format(it) } ?: "—", style = MaterialTheme.typography.titleMedium)
                }
                Column {
                    Text("Trade date", style = MaterialTheme.typography.labelSmall, color = WsMuted)
                    Text(tx.transactionDate?.format(dateFmt) ?: "—", style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun OfficialFilingWebScreen(
    rawUrl: String,
    title: String,
    onBack: () -> Unit,
) {
    val candidates = remember(rawUrl) { SecFilingUrls.alternateViewerUrls(rawUrl).distinct() }
    var attempt by remember(rawUrl) { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var failed by remember { mutableStateOf(false) }
    val currentUrl = candidates.getOrElse(attempt) { SecFilingUrls.styledViewerUrl(rawUrl) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WsLinen),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = WsGraphite)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text("SEC formatted view", style = MaterialTheme.typography.labelLarge, color = WsMuted)
            }
        }

        Box(modifier = Modifier.fillMaxSize()) {
            AndroidView(
                factory = { context ->
                    WebView(context).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        setBackgroundColor(android.graphics.Color.parseColor("#FAF8F5"))
                        webViewClient = object : WebViewClient() {
                            override fun onPageStarted(view: WebView?, url: String?, favIcon: Bitmap?) {
                                loading = true
                                failed = false
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                loading = false
                                // Soften the classic SEC Form 4 HTML into a cleaner reading surface.
                                view?.evaluateJavascript(SEC_FORM4_STYLE_JS, null)
                                val looksLikeXml = url?.endsWith(".xml") == true && url?.contains("/xslF345") != true
                                if (looksLikeXml && attempt < candidates.lastIndex) {
                                    attempt += 1
                                }
                            }

                            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                return false
                            }

                            override fun onReceivedError(
                                view: WebView?,
                                request: WebResourceRequest?,
                                error: android.webkit.WebResourceError?,
                            ) {
                                if (request?.isForMainFrame == true) {
                                    if (attempt < candidates.lastIndex) {
                                        attempt += 1
                                        view?.loadUrl(candidates[attempt])
                                    } else {
                                        failed = true
                                        loading = false
                                    }
                                }
                            }
                        }
                        loadUrl(currentUrl)
                    }
                },
                update = { webView ->
                    if (webView.url != currentUrl) {
                        webView.loadUrl(currentUrl)
                    }
                },
                modifier = Modifier.fillMaxSize(),
            )

            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = WsGraphite,
                    strokeWidth = 2.dp,
                )
            }

            if (failed) {
                Surface(
                    color = WsPaper,
                    shape = SoftCard,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(24.dp),
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text("Couldn’t load the formatted filing", style = MaterialTheme.typography.titleLarge)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "The SEC HTML view wasn’t available. You can go back to the summary.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        TextButton(onClick = onBack) { Text("Go back") }
                    }
                }
            }
        }
    }
}

private const val SEC_FORM4_STYLE_JS = """
(function() {
  try {
    var css = `
      html, body {
        background: #FAF8F5 !important;
        color: #32302F !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        margin: 0 !important;
        padding: 16px !important;
      }
      table {
        border-collapse: separate !important;
        border-spacing: 0 !important;
        width: 100% !important;
        background: #FCFCFC !important;
        border: 1px solid #E4E2E1 !important;
        border-radius: 16px !important;
        overflow: hidden !important;
        margin: 12px 0 20px !important;
      }
      th, td {
        border-color: #E4E2E1 !important;
        padding: 10px 8px !important;
      }
      th {
        background: #F1F0F0 !important;
        color: #4D4A46 !important;
        font-weight: 600 !important;
      }
      .FormData, .FormDataC, .FormDataR, .SmallFormData, .FormText, .FormTextC,
      .MedSmallFormText, .SmallFormText, .SmallFormTextR, .FormName, .FormTitle {
        color: #32302F !important;
        font-family: inherit !important;
        background: transparent !important;
      }
      .FootnoteData { color: #486635 !important; }
      a { color: #486635 !important; }
    `;
    var style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
    document.body.style.maxWidth = '900px';
    document.body.style.margin = '0 auto';
  } catch (e) {}
})();
"""
