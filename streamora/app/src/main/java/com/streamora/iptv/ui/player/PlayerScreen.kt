package com.streamora.iptv.ui.player

import android.app.Activity
import android.content.pm.ActivityInfo
import android.net.Uri
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Cast
import androidx.compose.material.icons.filled.ClosedCaption
import androidx.compose.material.icons.filled.ClosedCaptionDisabled
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.mediarouter.app.MediaRouteButton
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView
import androidx.media3.ui.SubtitleView
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaMetadata
import com.google.android.gms.cast.MediaTrack
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.SessionManagerListener
import com.google.android.gms.cast.framework.media.RemoteMediaClient
import com.google.android.gms.common.images.WebImage
import com.streamora.iptv.data.model.ExternalSubtitle
import com.streamora.iptv.ui.theme.StreamoraRed
import com.streamora.iptv.ui.theme.StreamoraSurface
import com.streamora.iptv.ui.theme.StreamoraText

data class TextTrackChoice(
    val id: String,
    val label: String,
    val groupIndex: Int = -1,
    val trackIndex: Int = -1,
    val off: Boolean = false
)

@Composable
fun PlayerScreen(
    title: String,
    streamUrl: String,
    subtitles: List<ExternalSubtitle> = emptyList(),
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? Activity
    var buffering by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showSubtitlePicker by remember { mutableStateOf(false) }
    var showCastHelp by remember { mutableStateOf(false) }
    var textChoices by remember { mutableStateOf<List<TextTrackChoice>>(emptyList()) }
    var selectedTextId by remember { mutableStateOf("off") }
    var castStatus by remember { mutableStateOf<String?>(null) }
    var castAvailable by remember { mutableStateOf(false) }

    val trackSelector = remember {
        DefaultTrackSelector(context).apply {
            parameters = buildUponParameters()
                .setPreferredTextLanguage(null)
                .setSelectUndeterminedTextLanguage(true)
                .setIgnoredTextSelectionFlags(0)
                .build()
        }
    }

    val player = remember {
        ExoPlayer.Builder(context)
            .setTrackSelector(trackSelector)
            .build()
            .apply {
                playWhenReady = true
                repeatMode = Player.REPEAT_MODE_OFF
            }
    }

    val castContext = remember {
        try {
            CastContext.getSharedInstance(context.applicationContext).also { castAvailable = true }
        } catch (_: Exception) {
            castAvailable = false
            null
        }
    }

    DisposableEffect(Unit) {
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        onDispose {
            player.release()
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    LaunchedEffect(streamUrl, subtitles) {
        error = null
        buffering = true
        val subtitleConfigs = subtitles.mapIndexed { index, sub ->
            val mime = when {
                !sub.mimeType.isNullOrBlank() -> sub.mimeType
                sub.url.lowercase().contains(".vtt") -> MimeTypes.TEXT_VTT
                sub.url.lowercase().contains(".ass") || sub.url.lowercase().contains(".ssa") -> MimeTypes.TEXT_SSA
                else -> MimeTypes.APPLICATION_SUBRIP
            }
            MediaItem.SubtitleConfiguration.Builder(Uri.parse(sub.url))
                .setMimeType(mime)
                .setLanguage(sub.language ?: "und")
                .setLabel(sub.label ?: sub.language ?: "Subtitle ${index + 1}")
                .setSelectionFlags(if (index == 0) C.SELECTION_FLAG_DEFAULT else 0)
                .build()
        }
        val mediaItem = MediaItem.Builder()
            .setUri(streamUrl)
            .setSubtitleConfigurations(subtitleConfigs)
            .build()
        player.setMediaItem(mediaItem)
        player.prepare()
        player.play()
    }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                buffering = playbackState == Player.STATE_BUFFERING
            }

            override fun onPlayerError(e: PlaybackException) {
                error = e.message ?: "Playback error"
                buffering = false
            }

            override fun onTracksChanged(tracks: Tracks) {
                textChoices = buildTextChoices(tracks)
                if (selectedTextId != "off" && textChoices.none { it.id == selectedTextId }) {
                    selectedTextId = textChoices.firstOrNull { !it.off }?.id ?: "off"
                }
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }

    DisposableEffect(castContext, streamUrl, title) {
        val ctx = castContext ?: return@DisposableEffect onDispose { }
        val listener = object : SessionManagerListener<CastSession> {
            override fun onSessionStarted(session: CastSession, sessionId: String) {
                castStatus = "Connected to ${session.castDevice?.friendlyName ?: "TV"}"
                loadOnCast(session, title, streamUrl, subtitles)
                player.pause()
            }

            override fun onSessionResumed(session: CastSession, wasSuspended: Boolean) {
                castStatus = "Casting to ${session.castDevice?.friendlyName ?: "TV"}"
            }

            override fun onSessionEnded(session: CastSession, error: Int) {
                castStatus = null
                player.play()
            }

            override fun onSessionStartFailed(session: CastSession, error: Int) {
                castStatus = "Cast failed ($error)"
            }

            override fun onSessionEnding(session: CastSession) {}
            override fun onSessionResumeFailed(session: CastSession, error: Int) {}
            override fun onSessionSuspended(session: CastSession, reason: Int) {}
            override fun onSessionResuming(session: CastSession, sessionId: String) {}
            override fun onSessionStarting(session: CastSession) {
                castStatus = "Connecting…"
            }
        }
        ctx.sessionManager.addSessionManagerListener(listener, CastSession::class.java)
        val current = ctx.sessionManager.currentCastSession
        if (current?.isConnected == true) {
            castStatus = "Casting to ${current.castDevice?.friendlyName ?: "TV"}"
            loadOnCast(current, title, streamUrl, subtitles)
            player.pause()
        }
        onDispose {
            ctx.sessionManager.removeSessionManagerListener(listener, CastSession::class.java)
        }
    }

    BackHandler(onBack = onBack)

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    this.player = player
                    useController = true
                    subtitleView?.apply {
                        setApplyEmbeddedStyles(true)
                        setApplyEmbeddedFontSizes(false)
                        setUserDefaultTextSize()
                        setStyle(
                            CaptionStyleCompat(
                                android.graphics.Color.WHITE,
                                android.graphics.Color.argb(160, 0, 0, 0),
                                android.graphics.Color.TRANSPARENT,
                                CaptionStyleCompat.EDGE_TYPE_OUTLINE,
                                android.graphics.Color.BLACK,
                                null
                            )
                        )
                    }
                    layoutParams = FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }
            },
            update = { view ->
                view.player = player
            },
            modifier = Modifier.fillMaxSize()
        )

        Row(
            modifier = Modifier
                .align(Alignment.TopStart)
                .fillMaxWidth()
                .padding(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Text(
                text = title,
                color = Color.White,
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.weight(1f),
                maxLines = 1
            )
            IconButton(onClick = { showSubtitlePicker = true }) {
                Icon(
                    if (selectedTextId == "off") Icons.Default.ClosedCaptionDisabled else Icons.Default.ClosedCaption,
                    contentDescription = "Subtitles",
                    tint = Color.White
                )
            }
            if (castAvailable) {
                AndroidView(
                    factory = { ctx ->
                        val themed = android.view.ContextThemeWrapper(
                            ctx,
                            androidx.appcompat.R.style.Theme_AppCompat_NoActionBar
                        )
                        MediaRouteButton(themed).apply {
                            try {
                                val selector = androidx.mediarouter.media.MediaRouteSelector.Builder()
                                    .addControlCategory(
                                        com.google.android.gms.cast.CastMediaControlIntent.categoryForCast(
                                            com.google.android.gms.cast.CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID
                                        )
                                    )
                                    .build()
                                setRouteSelector(selector)
                            } catch (_: Exception) {
                            }
                        }
                    },
                    modifier = Modifier
                        .padding(end = 4.dp)
                        .height(48.dp)
                        .width(48.dp)
                )
            } else {
                IconButton(onClick = { showCastHelp = true }) {
                    Icon(Icons.Default.Cast, contentDescription = "Cast", tint = Color.White)
                }
            }
        }

        if (!castStatus.isNullOrBlank()) {
            Text(
                text = castStatus ?: "",
                color = Color.White,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 72.dp)
                    .background(Color.Black.copy(alpha = 0.55f), RoundedCornerShape(8.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            )
        }

        if (buffering && castStatus == null) {
            CircularProgressIndicator(
                color = StreamoraRed,
                modifier = Modifier.align(Alignment.Center)
            )
        }
        if (error != null) {
            Text(
                text = error ?: "",
                color = Color.White,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(24.dp)
            )
        }
    }

    if (showSubtitlePicker) {
        AlertDialog(
            onDismissRequest = { showSubtitlePicker = false },
            containerColor = StreamoraSurface,
            title = { Text("Subtitles", color = StreamoraText) },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    val options = if (textChoices.isEmpty()) {
                        listOf(TextTrackChoice(id = "off", label = "Off", off = true))
                    } else textChoices
                    options.forEach { choice ->
                        val selected = choice.id == selectedTextId
                        Text(
                            text = choice.label + if (selected) "  ✓" else "",
                            color = if (selected) StreamoraRed else StreamoraText,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    selectedTextId = choice.id
                                    applyTextChoice(player, trackSelector, choice)
                                    showSubtitlePicker = false
                                }
                                .padding(vertical = 12.dp)
                        )
                    }
                    if (subtitles.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "${subtitles.size} external subtitle file(s) loaded",
                            color = Color.Gray,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showSubtitlePicker = false }) {
                    Text("Close")
                }
            }
        )
    }

    if (showCastHelp) {
        AlertDialog(
            onDismissRequest = { showCastHelp = false },
            containerColor = StreamoraSurface,
            title = { Text("Cast to TV", color = StreamoraText) },
            text = {
                Text(
                    "Google Cast / Play Services is unavailable on this device. " +
                        "Install Google Play Services or use a Chromecast / Cast-enabled TV on the same Wi‑Fi.",
                    color = StreamoraText
                )
            },
            confirmButton = {
                TextButton(onClick = { showCastHelp = false }) { Text("OK") }
            }
        )
    }
}

private fun buildTextChoices(tracks: Tracks): List<TextTrackChoice> {
    val list = mutableListOf(TextTrackChoice(id = "off", label = "Off", off = true))
    tracks.groups.forEachIndexed { groupIndex, group ->
        if (group.type != C.TRACK_TYPE_TEXT) return@forEachIndexed
        for (i in 0 until group.length) {
            val format = group.getTrackFormat(i)
            if (!group.isTrackSupported(i)) continue
            val lang = format.language
            val label = format.label
                ?: lang?.uppercase()
                ?: "Track ${list.size}"
            list += TextTrackChoice(
                id = "$groupIndex-$i",
                label = label,
                groupIndex = groupIndex,
                trackIndex = i
            )
        }
    }
    return list
}

private fun applyTextChoice(
    player: ExoPlayer,
    trackSelector: DefaultTrackSelector,
    choice: TextTrackChoice
) {
    if (choice.off) {
        trackSelector.parameters = trackSelector.buildUponParameters()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            .clearOverridesOfType(C.TRACK_TYPE_TEXT)
            .build()
        return
    }
    val tracks = player.currentTracks
    if (choice.groupIndex !in tracks.groups.indices) return
    val group = tracks.groups[choice.groupIndex]
    trackSelector.parameters = trackSelector.buildUponParameters()
        .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
        .clearOverridesOfType(C.TRACK_TYPE_TEXT)
        .addOverride(TrackSelectionOverride(group.mediaTrackGroup, listOf(choice.trackIndex)))
        .build()
}

private fun loadOnCast(
    session: CastSession,
    title: String,
    streamUrl: String,
    subtitles: List<ExternalSubtitle>
) {
    val client: RemoteMediaClient = session.remoteMediaClient ?: return
    val metadata = MediaMetadata(MediaMetadata.MEDIA_TYPE_MOVIE).apply {
        putString(MediaMetadata.KEY_TITLE, title)
    }
    val contentType = when {
        streamUrl.contains(".m3u8", ignoreCase = true) -> "application/x-mpegURL"
        streamUrl.contains(".mpd", ignoreCase = true) -> "application/dash+xml"
        streamUrl.contains(".mkv", ignoreCase = true) -> "video/x-matroska"
        else -> "video/mp4"
    }
    val mediaTracks = subtitles.mapIndexed { index, sub ->
        MediaTrack.Builder(index + 1L, MediaTrack.TYPE_TEXT)
            .setName(sub.label ?: sub.language ?: "Subtitle ${index + 1}")
            .setSubtype(MediaTrack.SUBTYPE_SUBTITLES)
            .setContentId(sub.url)
            .setLanguage(sub.language ?: "en")
            .build()
    }
    val info = MediaInfo.Builder(streamUrl)
        .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
        .setContentType(contentType)
        .setMetadata(metadata)
        .setMediaTracks(mediaTracks)
        .build()
    client.load(
        MediaLoadRequestData.Builder()
            .setMediaInfo(info)
            .setAutoplay(true)
            .setActiveTrackIds(if (mediaTracks.isNotEmpty()) longArrayOf(1L) else longArrayOf())
            .build()
    )
}
