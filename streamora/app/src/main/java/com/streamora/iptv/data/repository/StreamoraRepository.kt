package com.streamora.iptv.data.repository

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.room.Room
import com.streamora.iptv.data.api.XtreamApi
import com.streamora.iptv.data.api.XtreamApiFactory
import com.streamora.iptv.data.db.FavoriteEntity
import com.streamora.iptv.data.db.ProfileEntity
import com.streamora.iptv.data.db.StreamoraDatabase
import com.streamora.iptv.data.db.WatchHistoryEntity
import com.streamora.iptv.data.model.Category
import com.streamora.iptv.data.model.ContentType
import com.streamora.iptv.data.model.Episode
import com.streamora.iptv.data.model.ExternalSubtitle
import com.streamora.iptv.data.model.LiveStream
import com.streamora.iptv.data.model.MediaItem
import com.streamora.iptv.data.model.SeriesInfoResponse
import com.streamora.iptv.data.model.SeriesItem
import com.streamora.iptv.data.model.VodInfoResponse
import com.streamora.iptv.data.model.VodStream
import com.streamora.iptv.data.model.XtreamAuthResponse
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore("streamora_prefs")

data class SessionCredentials(
    val serverUrl: String,
    val username: String,
    val password: String
)

class StreamoraRepository(context: Context) {
    private val appContext = context.applicationContext
    private val db = Room.databaseBuilder(
        appContext,
        StreamoraDatabase::class.java,
        "streamora.db"
    ).fallbackToDestructiveMigration().build()

    private val profileDao = db.profileDao()
    private val favoriteDao = db.favoriteDao()
    private val historyDao = db.watchHistoryDao()

    private var api: XtreamApi? = null
    private var credentials: SessionCredentials? = null

    private object Keys {
        val SERVER = stringPreferencesKey("server_url")
        val USERNAME = stringPreferencesKey("username")
        val PASSWORD = stringPreferencesKey("password")
        val ACTIVE_PROFILE = longPreferencesKey("active_profile_id")
    }

    val profiles: Flow<List<ProfileEntity>> = profileDao.observeProfiles()

    val activeProfileId: Flow<Long?> = appContext.dataStore.data.map { prefs ->
        prefs[Keys.ACTIVE_PROFILE]
    }

    val savedCredentials: Flow<SessionCredentials?> = appContext.dataStore.data.map { prefs ->
        val server = prefs[Keys.SERVER]
        val user = prefs[Keys.USERNAME]
        val pass = prefs[Keys.PASSWORD]
        if (server.isNullOrBlank() || user.isNullOrBlank() || pass.isNullOrBlank()) null
        else SessionCredentials(server, user, pass)
    }

    suspend fun restoreSession(): Boolean {
        val creds = savedCredentials.first() ?: return false
        return try {
            login(creds.serverUrl, creds.username, creds.password, persist = false)
            true
        } catch (_: Exception) {
            false
        }
    }

    suspend fun login(
        serverUrl: String,
        username: String,
        password: String,
        persist: Boolean = true
    ): XtreamAuthResponse {
        val client = XtreamApiFactory.create(serverUrl)
        val response = client.authenticate(username, password)
        val authOk = response.userInfo?.auth == 1 ||
            response.userInfo?.status.equals("Active", ignoreCase = true)
        if (!authOk && response.userInfo == null) {
            throw IllegalStateException("Invalid credentials or server URL")
        }
        if (response.userInfo?.status?.equals("Active", true) == false && response.userInfo?.auth != 1) {
            throw IllegalStateException("Account status: ${response.userInfo?.status ?: "inactive"}")
        }
        api = client
        credentials = SessionCredentials(
            XtreamApiFactory.normalizeBaseUrl(serverUrl),
            username,
            password
        )
        if (persist) {
            appContext.dataStore.edit { prefs ->
                prefs[Keys.SERVER] = XtreamApiFactory.normalizeBaseUrl(serverUrl)
                prefs[Keys.USERNAME] = username
                prefs[Keys.PASSWORD] = password
            }
            ensureDefaultProfile()
        }
        return response
    }

    suspend fun logout() {
        api = null
        credentials = null
        appContext.dataStore.edit { it.clear() }
    }

    private suspend fun ensureDefaultProfile() {
        if (profileDao.getProfiles().isEmpty()) {
            profileDao.upsert(
                ProfileEntity(name = "Main", avatarColor = 0xFFE50914)
            )
            profileDao.upsert(
                ProfileEntity(name = "Kids", avatarColor = 0xFF46D369, isKids = true)
            )
        }
    }

    suspend fun createProfile(name: String, color: Long, isKids: Boolean = false): Long {
        return profileDao.upsert(ProfileEntity(name = name, avatarColor = color, isKids = isKids))
    }

    suspend fun deleteProfile(id: Long) = profileDao.delete(id)

    suspend fun setActiveProfile(id: Long) {
        appContext.dataStore.edit { it[Keys.ACTIVE_PROFILE] = id }
    }

    private fun requireApi(): XtreamApi = api ?: error("Not logged in")
    private fun requireCreds(): SessionCredentials = credentials ?: error("Not logged in")

    suspend fun getLiveCategories(): List<Category> {
        val c = requireCreds()
        return requireApi().getLiveCategories(c.username, c.password)
    }

    suspend fun getLiveStreams(categoryId: String? = null): List<LiveStream> {
        val c = requireCreds()
        return requireApi().getLiveStreams(c.username, c.password, categoryId = categoryId)
    }

    suspend fun getVodCategories(): List<Category> {
        val c = requireCreds()
        return requireApi().getVodCategories(c.username, c.password)
    }

    suspend fun getVodStreams(categoryId: String? = null): List<VodStream> {
        val c = requireCreds()
        return requireApi().getVodStreams(c.username, c.password, categoryId = categoryId)
    }

    suspend fun getSeriesCategories(): List<Category> {
        val c = requireCreds()
        return requireApi().getSeriesCategories(c.username, c.password)
    }

    suspend fun getSeries(categoryId: String? = null): List<SeriesItem> {
        val c = requireCreds()
        return requireApi().getSeries(c.username, c.password, categoryId = categoryId)
    }

    suspend fun getSeriesInfo(seriesId: Int): SeriesInfoResponse {
        val c = requireCreds()
        return requireApi().getSeriesInfo(c.username, c.password, seriesId = seriesId)
    }

    suspend fun getVodInfo(vodId: Int): VodInfoResponse {
        val c = requireCreds()
        return requireApi().getVodInfo(c.username, c.password, vodId = vodId)
    }

    suspend fun fetchExternalSubtitles(vodId: Int): List<ExternalSubtitle> {
        return try {
            val info = getVodInfo(vodId)
            info.info?.subtitles.orEmpty().mapNotNull { sub ->
                val url = sub.url?.takeIf { it.isNotBlank() } ?: sub.file?.takeIf { it.isNotBlank() }
                url?.let {
                    ExternalSubtitle(
                        url = it,
                        language = sub.lang ?: sub.language,
                        label = sub.language ?: sub.lang ?: "Subtitle",
                        mimeType = guessSubtitleMime(it)
                    )
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun guessSubtitleMime(url: String): String {
        val lower = url.lowercase()
        return when {
            lower.endsWith(".vtt") || lower.contains(".vtt?") -> "text/vtt"
            lower.endsWith(".ass") || lower.endsWith(".ssa") -> "text/x-ssa"
            else -> "application/x-subrip"
        }
    }

    fun liveUrl(streamId: Int): String {
        val c = requireCreds()
        return XtreamApiFactory.buildLiveUrl(c.serverUrl, c.username, c.password, streamId)
    }

    fun vodUrl(streamId: Int, extension: String?): String {
        val c = requireCreds()
        return XtreamApiFactory.buildVodUrl(c.serverUrl, c.username, c.password, streamId, extension)
    }

    fun seriesUrl(episodeId: String, extension: String?): String {
        val c = requireCreds()
        return XtreamApiFactory.buildSeriesUrl(c.serverUrl, c.username, c.password, episodeId, extension)
    }

    fun favorites(profileId: Long): Flow<List<FavoriteEntity>> =
        favoriteDao.observeFavorites(profileId)

    fun isFavorite(profileId: Long, contentId: Int, type: ContentType): Flow<Boolean> =
        favoriteDao.observeIsFavorite(profileId, contentId, type.name)

    suspend fun toggleFavorite(profileId: Long, item: MediaItem): Boolean {
        val existing = favoriteDao.getFavorite(profileId, item.id, item.type.name)
        return if (existing != null) {
            favoriteDao.remove(profileId, item.id, item.type.name)
            false
        } else {
            favoriteDao.upsert(
                FavoriteEntity(
                    profileId = profileId,
                    contentId = item.id,
                    contentType = item.type.name,
                    title = item.name,
                    posterUrl = item.posterUrl,
                    rating = item.rating,
                    plot = item.plot,
                    extension = item.extension
                )
            )
            true
        }
    }

    fun watchHistory(profileId: Long): Flow<List<WatchHistoryEntity>> =
        historyDao.observeHistory(profileId)

    suspend fun recordWatch(profileId: Long, item: MediaItem, positionMs: Long = 0, durationMs: Long = 0) {
        historyDao.upsert(
            WatchHistoryEntity(
                profileId = profileId,
                contentId = item.id,
                contentType = item.type.name,
                title = item.name,
                posterUrl = item.posterUrl,
                positionMs = positionMs,
                durationMs = durationMs
            )
        )
    }

    fun LiveStream.toMedia() = MediaItem(
        id = streamId,
        name = name,
        posterUrl = streamIcon,
        type = ContentType.LIVE,
        categoryId = categoryId
    )

    fun VodStream.toMedia() = MediaItem(
        id = streamId,
        name = name,
        posterUrl = streamIcon,
        type = ContentType.VOD,
        categoryId = categoryId,
        rating = rating,
        plot = plot,
        extension = containerExtension
    )

    fun SeriesItem.toMedia() = MediaItem(
        id = seriesId,
        name = name,
        posterUrl = cover,
        type = ContentType.SERIES,
        categoryId = categoryId,
        rating = rating,
        plot = plot
    )

    fun FavoriteEntity.toMedia() = MediaItem(
        id = contentId,
        name = title,
        posterUrl = posterUrl,
        type = ContentType.valueOf(contentType),
        rating = rating,
        plot = plot,
        extension = extension
    )

    fun WatchHistoryEntity.toMedia() = MediaItem(
        id = contentId,
        name = title,
        posterUrl = posterUrl,
        type = ContentType.valueOf(contentType)
    )

    fun Episode.displayTitle(season: Int): String {
        val ep = episodeNum
        val t = title?.takeIf { it.isNotBlank() }
        return if (t != null) "S${season}E$ep · $t" else "Season $season · Episode $ep"
    }
}
