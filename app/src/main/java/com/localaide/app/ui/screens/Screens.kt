package com.localaide.app.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Notes
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.localaide.app.AssistantViewModel
import com.localaide.app.audio.MeetingCaptureService
import com.localaide.app.audio.ModelInstaller
import com.localaide.app.data.model.MeetingSummary
import java.text.DateFormat
import java.util.Date

@Composable
fun LocalAideAppNav(vm: AssistantViewModel) {
    var screen by remember { mutableStateOf<Screen>(Screen.Home) }
    val review by vm.review.collectAsStateWithLifecycle()

    when (val s = screen) {
        Screen.Home -> HomeScreen(
            vm = vm,
            onOpenMeeting = {
                vm.openReview(it)
                screen = Screen.Review
            },
            onStartCapture = { screen = Screen.Capture },
            onPasteNotes = { screen = Screen.Paste }
        )
        Screen.Capture -> CaptureScreen(
            vm = vm,
            onBack = { screen = Screen.Home },
            onOpenReview = { screen = Screen.Review }
        )
        Screen.Review -> ReviewScreen(
            vm = vm,
            onBack = { screen = Screen.Home }
        )
        Screen.Paste -> PasteScreen(
            vm = vm,
            onBack = { screen = Screen.Home },
            onDone = { screen = Screen.Review }
        )
    }

    // Auto-navigate when recording finishes with a meeting
    LaunchedEffect(review.meeting?.meetingId) {
        if (screen == Screen.Capture && review.meeting != null) {
            // stay until user taps; CaptureScreen handles CTA
        }
    }
}

private sealed class Screen {
    data object Home : Screen()
    data object Capture : Screen()
    data object Review : Screen()
    data object Paste : Screen()
}

@Composable
private fun Atmosphere(content: @Composable () -> Unit) {
    val moss = MaterialTheme.colorScheme.primary
    val paper = MaterialTheme.colorScheme.background
    val mist = MaterialTheme.colorScheme.primaryContainer
    val clay = MaterialTheme.colorScheme.secondary
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        paper,
                        mist.copy(alpha = 0.55f),
                        paper
                    )
                )
            )
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val wave = Path().apply {
                moveTo(0f, size.height * 0.22f)
                cubicTo(
                    size.width * 0.25f, size.height * 0.16f,
                    size.width * 0.55f, size.height * 0.30f,
                    size.width, size.height * 0.20f
                )
                lineTo(size.width, 0f)
                lineTo(0f, 0f)
                close()
            }
            drawPath(wave, color = moss.copy(alpha = 0.08f))
            drawCircle(
                color = clay.copy(alpha = 0.12f),
                radius = size.minDimension * 0.28f,
                center = Offset(size.width * 0.86f, size.height * 0.78f)
            )
        }
        content()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    vm: AssistantViewModel,
    onOpenMeeting: (Long) -> Unit,
    onStartCapture: () -> Unit,
    onPasteNotes: () -> Unit
) {
    val meetings by vm.meetings.collectAsStateWithLifecycle()
    val capture by vm.capture.collectAsStateWithLifecycle()
    val pulse = rememberInfiniteTransition(label = "pulse")
    val glow by pulse.animateFloat(
        initialValue = 0.92f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(tween(2200), RepeatMode.Reverse),
        label = "glow"
    )

    Atmosphere {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                TopAppBar(
                    title = { Text("LocalAide", style = MaterialTheme.typography.headlineMedium) },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
                    actions = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(end = 12.dp)
                        ) {
                            Icon(
                                Icons.Outlined.Lock,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "On-device",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                )
            }
        ) { padding ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = "LocalAide",
                            style = MaterialTheme.typography.displayLarge,
                            color = MaterialTheme.colorScheme.onBackground,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Transcribe meetings on this phone. Rank what to finish first by deadline and sensitivity — nothing leaves the device.",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.78f)
                        )
                        Spacer(Modifier.height(24.dp))
                        Button(
                            onClick = onStartCapture,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary
                            )
                        ) {
                            Icon(Icons.Default.Mic, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Record a meeting", fontWeight = FontWeight.SemiBold)
                        }
                        Spacer(Modifier.height(10.dp))
                        FilledTonalButton(
                            onClick = onPasteNotes,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Icon(Icons.Outlined.Notes, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Paste notes instead")
                        }
                    }
                }

                item {
                    ModelStatusBlock(
                        progress = capture.modelProgress,
                        busy = capture.busy,
                        onDownload = { vm.ensureModel() },
                        glow = glow
                    )
                }

                item {
                    Text(
                        "Recent meetings",
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }

                if (meetings.isEmpty()) {
                    item {
                        Text(
                            "No meetings yet. Record one to see transcripts and deliverables here.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.65f)
                        )
                    }
                } else {
                    items(meetings, key = { it.meetingId }) { meeting ->
                        MeetingRow(
                            meeting = meeting,
                            onClick = { onOpenMeeting(meeting.meetingId) },
                            onDelete = { vm.deleteMeeting(meeting.meetingId) }
                        )
                    }
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }
}

@Composable
private fun ModelStatusBlock(
    progress: ModelInstaller.Progress,
    busy: Boolean,
    onDownload: () -> Unit,
    glow: Float
) {
    val ready = progress.status == ModelInstaller.Status.Ready
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.7f))
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f), RoundedCornerShape(18.dp))
            .padding(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size((12 * glow).dp)
                    .clip(CircleShape)
                    .background(
                        if (ready) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.secondary
                    )
            )
            Spacer(Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    if (ready) "Speech model ready" else "Offline speech model",
                    style = MaterialTheme.typography.titleLarge
                )
                Text(
                    progress.message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
            }
            if (!ready) {
                FilledTonalButton(onClick = onDownload, enabled = !busy && progress.status != ModelInstaller.Status.Downloading) {
                    if (busy || progress.status == ModelInstaller.Status.Downloading) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Default.Download, contentDescription = null)
                    }
                    Spacer(Modifier.width(6.dp))
                    Text("Install")
                }
            }
        }
        AnimatedVisibility(visible = progress.status == ModelInstaller.Status.Downloading) {
            Column {
                Spacer(Modifier.height(12.dp))
                LinearProgressIndicator(
                    progress = { progress.fraction },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun MeetingRow(
    meeting: MeetingSummary,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.55f))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(meeting.title, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(meeting.createdAt)),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
            Text(
                "${meeting.deliverables.size} deliverable(s)",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary
            )
        }
        IconButton(onClick = onDelete) {
            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
        }
    }
}

@Composable
fun CaptureScreen(
    vm: AssistantViewModel,
    onBack: () -> Unit,
    onOpenReview: () -> Unit
) {
    val capture by vm.capture.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val permissions = buildList {
        add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
    }.toTypedArray()

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants[Manifest.permission.RECORD_AUDIO] == true) {
            context.startForegroundService(Intent(context, MeetingCaptureService::class.java))
            vm.startRecording()
        }
    }

    fun ensurePermsAndRecord() {
        val need = permissions.filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }
        if (need.isEmpty()) {
            context.startForegroundService(Intent(context, MeetingCaptureService::class.java))
            vm.startRecording()
        } else {
            launcher.launch(need.toTypedArray())
        }
    }

    LaunchedEffect(Unit) {
        if (capture.modelProgress.status != ModelInstaller.Status.Ready) {
            vm.ensureModel()
        }
    }

    Atmosphere {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp)
                .verticalScroll(rememberScrollState())
        ) {
            TextButton(onClick = {
                if (capture.isRecording) vm.stopRecording()
                context.stopService(Intent(context, MeetingCaptureService::class.java))
                onBack()
            }) { Text("← Back") }

            Spacer(Modifier.height(12.dp))
            Text("LocalAide", style = MaterialTheme.typography.headlineLarge)
            Text(
                if (capture.isRecording) "Listening on-device" else "Meeting capture",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )

            Spacer(Modifier.height(28.dp))
            LevelRing(level = capture.level, recording = capture.isRecording)

            Spacer(Modifier.height(20.dp))
            Text(
                capture.statusMessage.ifBlank { "Tap record when the model is ready." },
                style = MaterialTheme.typography.bodyMedium
            )
            capture.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            }

            Spacer(Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (!capture.isRecording) {
                    Button(
                        onClick = { ensurePermsAndRecord() },
                        enabled = !capture.busy || capture.modelProgress.status == ModelInstaller.Status.Ready,
                        modifier = Modifier.weight(1f).height(52.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Default.Mic, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Record")
                    }
                } else {
                    Button(
                        onClick = {
                            vm.stopRecording()
                            context.stopService(Intent(context, MeetingCaptureService::class.java))
                        },
                        modifier = Modifier.weight(1f).height(52.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
                    ) {
                        Icon(Icons.Default.Stop, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Stop & process")
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
            Text("Live transcript", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(8.dp))
            Text(
                buildString {
                    append(capture.liveTranscript)
                    if (capture.partialText.isNotBlank()) {
                        if (isNotEmpty()) append(' ')
                        append(capture.partialText)
                    }
                    if (isEmpty()) append("Waiting for speech…")
                },
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.65f))
                    .padding(14.dp)
            )

            AnimatedVisibility(visible = capture.lastMeetingId != null && !capture.isRecording, enter = fadeIn(), exit = fadeOut()) {
                Column {
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = onOpenReview,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text("Review deliverables & calendar")
                    }
                }
            }
        }
    }
}

@Composable
private fun LevelRing(level: Float, recording: Boolean) {
    val anim = remember { Animatable(0.3f) }
    LaunchedEffect(level, recording) {
        anim.animateTo(if (recording) (0.35f + level * 0.65f) else 0.3f, tween(120))
    }
    val color = MaterialTheme.colorScheme.primary
    val secondary = MaterialTheme.colorScheme.secondary
    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxWidth().height(180.dp)) {
        Canvas(modifier = Modifier.size(160.dp)) {
            drawCircle(color = color.copy(alpha = 0.12f), radius = size.minDimension / 2)
            drawCircle(
                color = if (recording) secondary else color,
                radius = size.minDimension / 2 * anim.value,
                style = Stroke(width = 10f)
            )
        }
        Icon(
            if (recording) Icons.Default.Mic else Icons.Default.Mic,
            contentDescription = null,
            tint = color,
            modifier = Modifier.size(40.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewScreen(vm: AssistantViewModel, onBack: () -> Unit) {
    val review by vm.review.collectAsStateWithLifecycle()
    val meeting = review.meeting
    val plan = review.priorityPlan
    val context = LocalContext.current

    val calPerms = arrayOf(
        Manifest.permission.READ_CALENDAR,
        Manifest.permission.WRITE_CALENDAR
    )
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.all { it }) vm.pushSelectedToCalendar()
    }

    Atmosphere {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp)
        ) {
            TextButton(onClick = onBack) { Text("← Home") }
            if (meeting == null) {
                Text("No meeting selected", style = MaterialTheme.typography.bodyLarge)
                return@Column
            }

            Text(meeting.title, style = MaterialTheme.typography.headlineLarge)
            Text(
                "${meeting.deliverables.size} deliverables · ranked on-device by deadline & sensitivity",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.65f)
            )

            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilledTonalButton(onClick = { vm.reExtract() }) { Text("Re-scan") }
                FilledTonalButton(onClick = { vm.reRank() }, enabled = !review.busy) {
                    Icon(Icons.Default.Psychology, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Re-rank")
                }
                Button(
                    onClick = {
                        val need = calPerms.filter {
                            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
                        }
                        if (need.isEmpty()) vm.pushSelectedToCalendar()
                        else launcher.launch(need.toTypedArray())
                    },
                    enabled = !review.busy,
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.CalendarMonth, null)
                    Spacer(Modifier.width(6.dp))
                    Text("Calendar")
                }
            }
            review.calendarMessage?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium)
            }

            Spacer(Modifier.height(12.dp))
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                if (plan != null) {
                    item {
                        PriorityPlanCard(plan = plan)
                    }
                }

                items(meeting.deliverables, key = { it.id }) { item ->
                    val expanded = review.reasoningExpandedId == item.id
                    val isFirst = item.id == plan?.doFirstId
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(
                                if (isFirst) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f)
                                else MaterialTheme.colorScheme.surface.copy(alpha = 0.6f)
                            )
                            .padding(10.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Checkbox(
                            checked = item.id in review.selected,
                            onCheckedChange = { vm.toggleDeliverable(item.id) }
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                item.priorityRank?.let { rank ->
                                    Text(
                                        "#$rank",
                                        style = MaterialTheme.typography.titleLarge,
                                        color = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.padding(end = 8.dp)
                                    )
                                }
                                if (isFirst) {
                                    Text(
                                        "DO FIRST",
                                        style = MaterialTheme.typography.labelLarge,
                                        color = MaterialTheme.colorScheme.secondary,
                                        modifier = Modifier.padding(end = 8.dp)
                                    )
                                }
                            }
                            var title by remember(item.id, item.title) { mutableStateOf(item.title) }
                            OutlinedTextField(
                                value = title,
                                onValueChange = {
                                    title = it
                                    vm.updateDeliverableTitle(item.id, it)
                                },
                                modifier = Modifier.fillMaxWidth(),
                                label = { Text("Deliverable") }
                            )
                            Spacer(Modifier.height(6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                item.sensitivity?.let {
                                    Text(
                                        "Sensitivity: ${it.label}",
                                        style = MaterialTheme.typography.labelLarge,
                                        color = MaterialTheme.colorScheme.secondary
                                    )
                                }
                                item.priorityScore?.let {
                                    Text(
                                        "Score ${"%.0f".format(it)}",
                                        style = MaterialTheme.typography.labelLarge,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                            item.owner?.let {
                                Text("Owner: $it", style = MaterialTheme.typography.bodyMedium)
                            }
                            item.dueEpochMs?.let {
                                Text(
                                    "Due: " + DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(it)),
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                            item.recommendationSummary?.let {
                                Text(
                                    it,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }
                            if (item.calendarEventId != null) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.CheckCircle, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("On calendar", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
                                }
                            }
                            if (item.reasoningSteps.isNotEmpty()) {
                                TextButton(onClick = { vm.toggleReasoning(item.id) }) {
                                    Icon(
                                        if (expanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(Modifier.width(4.dp))
                                    Text(if (expanded) "Hide reasoning" else "Show reasoning steps")
                                }
                                AnimatedVisibility(visible = expanded) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(MaterialTheme.colorScheme.background.copy(alpha = 0.55f))
                                            .padding(10.dp)
                                    ) {
                                        item.reasoningSteps.forEachIndexed { i, step ->
                                            Text(
                                                "${i + 1}. $step",
                                                style = MaterialTheme.typography.bodyMedium,
                                                modifier = Modifier.padding(bottom = 4.dp)
                                            )
                                        }
                                    }
                                }
                            }
                            Text(
                                item.sourceSnippet,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }

                item {
                    Spacer(Modifier.height(8.dp))
                    Text("Full transcript", style = MaterialTheme.typography.titleLarge)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        meeting.transcript,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.5f))
                            .padding(12.dp)
                    )
                    Spacer(Modifier.height(32.dp))
                }
            }
        }
    }
}

@Composable
private fun PriorityPlanCard(plan: com.localaide.app.data.model.PriorityPlan) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.75f))
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Default.Psychology,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(Modifier.width(8.dp))
            Text("Priority reasoner", style = MaterialTheme.typography.titleLarge)
        }
        Spacer(Modifier.height(6.dp))
        Text(
            plan.doFirstBlurb,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.secondary
        )
        Spacer(Modifier.height(6.dp))
        Text(
            plan.overallReasoning,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f)
        )
    }
}

@Composable
fun PasteScreen(
    vm: AssistantViewModel,
    onBack: () -> Unit,
    onDone: () -> Unit
) {
    var text by remember { mutableStateOf("") }
    Atmosphere {
        Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
            TextButton(onClick = onBack) { Text("← Back") }
            Text("LocalAide", style = MaterialTheme.typography.headlineLarge)
            Text(
                "Paste meeting notes. Deliverables are extracted on-device.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                placeholder = {
                    Text("Alex will send the deck by Friday. Sam needs to schedule the customer call next week…")
                }
            )
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = {
                    if (text.isNotBlank()) {
                        vm.processPastedTranscript(text)
                        onDone()
                    }
                },
                enabled = text.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp)
            ) {
                Text("Extract deliverables")
            }
        }
    }
}
