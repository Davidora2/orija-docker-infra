package com.streamora.iptv.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.streamora.iptv.data.db.FavoriteEntity
import com.streamora.iptv.data.db.ProfileEntity
import com.streamora.iptv.data.db.WatchHistoryEntity
import com.streamora.iptv.data.model.Category
import com.streamora.iptv.data.model.ContentType
import com.streamora.iptv.data.model.Episode
import com.streamora.iptv.data.model.ExternalSubtitle
import com.streamora.iptv.data.model.MediaItem
import com.streamora.iptv.data.model.PlaybackRequest
import com.streamora.iptv.data.model.SeriesInfoResponse
import com.streamora.iptv.data.repository.StreamoraRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed class BootState {
    data object Loading : BootState()
    data object NeedLogin : BootState()
    data object NeedProfile : BootState()
    data object Ready : BootState()
}

class AppViewModel(private val repo: StreamoraRepository) : ViewModel() {
    private val _boot = MutableStateFlow<BootState>(BootState.Loading)
    val boot: StateFlow<BootState> = _boot.asStateFlow()

    private val _loginError = MutableStateFlow<String?>(null)
    val loginError: StateFlow<String?> = _loginError.asStateFlow()

    private val _loggingIn = MutableStateFlow(false)
    val loggingIn: StateFlow<Boolean> = _loggingIn.asStateFlow()

    val profiles = repo.profiles.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val activeProfileId = repo.activeProfileId.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    init {
        viewModelScope.launch {
            val restored = repo.restoreSession()
            if (!restored) {
                _boot.value = BootState.NeedLogin
                return@launch
            }
            val list = profiles.value.ifEmpty {
                // wait a tick for flow
                kotlinx.coroutines.delay(100)
                profiles.value
            }
            val active = activeProfileId.value
            _boot.value = if (active == null || list.none { it.id == active }) {
                BootState.NeedProfile
            } else {
                BootState.Ready
            }
        }
    }

    fun login(server: String, username: String, password: String) {
        viewModelScope.launch {
            _loggingIn.value = true
            _loginError.value = null
            try {
                repo.login(server.trim(), username.trim(), password.trim())
                _boot.value = BootState.NeedProfile
            } catch (e: Exception) {
                _loginError.value = e.message ?: "Login failed"
            } finally {
                _loggingIn.value = false
            }
        }
    }

    fun selectProfile(id: Long) {
        viewModelScope.launch {
            repo.setActiveProfile(id)
            _boot.value = BootState.Ready
        }
    }

    fun createProfile(name: String, color: Long, isKids: Boolean) {
        viewModelScope.launch {
            val id = repo.createProfile(name, color, isKids)
            repo.setActiveProfile(id)
            _boot.value = BootState.Ready
        }
    }

    fun switchProfile() {
        _boot.value = BootState.NeedProfile
    }

    fun logout() {
        viewModelScope.launch {
            repo.logout()
            _boot.value = BootState.NeedLogin
        }
    }

    fun repository(): StreamoraRepository = repo
}

data class HomeUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val hero: MediaItem? = null,
    val continueWatching: List<MediaItem> = emptyList(),
    val live: List<MediaItem> = emptyList(),
    val movies: List<MediaItem> = emptyList(),
    val series: List<MediaItem> = emptyList(),
    val favorites: List<MediaItem> = emptyList()
)

class HomeViewModel(
    private val repo: StreamoraRepository,
    private val profileId: Long
) : ViewModel() {
    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    init {
        refresh()
        viewModelScope.launch {
            repo.favorites(profileId).collect { favs ->
                _state.value = _state.value.copy(favorites = favs.map { repo.run { it.toMedia() } })
            }
        }
        viewModelScope.launch {
            repo.watchHistory(profileId).collect { hist ->
                _state.value = _state.value.copy(continueWatching = hist.map { repo.run { it.toMedia() } })
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val live = repo.getLiveStreams().take(30).map { repo.run { it.toMedia() } }
                val movies = repo.getVodStreams().take(40).map { repo.run { it.toMedia() } }
                val series = repo.getSeries().take(40).map { repo.run { it.toMedia() } }
                val hero = movies.firstOrNull { !it.posterUrl.isNullOrBlank() }
                    ?: series.firstOrNull { !it.posterUrl.isNullOrBlank() }
                    ?: live.firstOrNull()
                _state.value = _state.value.copy(
                    loading = false,
                    hero = hero,
                    live = live,
                    movies = movies,
                    series = series
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = e.message ?: "Failed to load")
            }
        }
    }
}

data class BrowseUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val categories: List<Category> = emptyList(),
    val selectedCategoryId: String? = null,
    val items: List<MediaItem> = emptyList()
)

class BrowseViewModel(
    private val repo: StreamoraRepository,
    private val type: ContentType
) : ViewModel() {
    private val _state = MutableStateFlow(BrowseUiState())
    val state: StateFlow<BrowseUiState> = _state.asStateFlow()

    init {
        loadCategories()
    }

    fun loadCategories() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val cats = when (type) {
                    ContentType.LIVE -> repo.getLiveCategories()
                    ContentType.VOD -> repo.getVodCategories()
                    ContentType.SERIES -> repo.getSeriesCategories()
                }
                _state.value = _state.value.copy(categories = cats, loading = false)
                val first = cats.firstOrNull()?.categoryId
                if (first != null) selectCategory(first) else loadAll()
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = e.message)
            }
        }
    }

    fun selectCategory(id: String?) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, selectedCategoryId = id, error = null)
            try {
                val items = when (type) {
                    ContentType.LIVE -> repo.getLiveStreams(id).map { repo.run { it.toMedia() } }
                    ContentType.VOD -> repo.getVodStreams(id).map { repo.run { it.toMedia() } }
                    ContentType.SERIES -> repo.getSeries(id).map { repo.run { it.toMedia() } }
                }
                _state.value = _state.value.copy(loading = false, items = items)
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = e.message)
            }
        }
    }

    private fun loadAll() = selectCategory(null)
}

class FavoritesViewModel(
    repo: StreamoraRepository,
    profileId: Long
) : ViewModel() {
    val favorites: StateFlow<List<FavoriteEntity>> =
        repo.favorites(profileId).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
}

data class DetailsUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val item: MediaItem? = null,
    val liked: Boolean = false,
    val seriesInfo: SeriesInfoResponse? = null,
    val selectedSeason: String? = null,
    val episodes: List<Episode> = emptyList()
)

class DetailsViewModel(
    private val repo: StreamoraRepository,
    private val profileId: Long,
    private val item: MediaItem
) : ViewModel() {
    private val _state = MutableStateFlow(DetailsUiState(item = item))
    val state: StateFlow<DetailsUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repo.isFavorite(profileId, item.id, item.type).collect { liked ->
                _state.value = _state.value.copy(liked = liked)
            }
        }
        if (item.type == ContentType.SERIES) {
            viewModelScope.launch {
                try {
                    val info = repo.getSeriesInfo(item.id)
                    val firstSeason = info.episodes?.keys?.sortedBy { it.toIntOrNull() ?: 0 }?.firstOrNull()
                    val eps = firstSeason?.let { info.episodes?.get(it) }.orEmpty()
                    _state.value = _state.value.copy(
                        loading = false,
                        seriesInfo = info,
                        selectedSeason = firstSeason,
                        episodes = eps,
                        item = item.copy(
                            plot = info.info?.plot ?: item.plot,
                            posterUrl = info.info?.cover ?: item.posterUrl,
                            rating = info.info?.rating ?: item.rating
                        )
                    )
                } catch (e: Exception) {
                    _state.value = _state.value.copy(loading = false, error = e.message)
                }
            }
        } else {
            _state.value = _state.value.copy(loading = false)
        }
    }

    fun selectSeason(season: String) {
        val eps = _state.value.seriesInfo?.episodes?.get(season).orEmpty()
        _state.value = _state.value.copy(selectedSeason = season, episodes = eps)
    }

    fun toggleLike() {
        viewModelScope.launch {
            val current = _state.value.item ?: return@launch
            repo.toggleFavorite(profileId, current)
        }
    }

    fun playUrl(episode: Episode? = null): String {
        return when (item.type) {
            ContentType.LIVE -> repo.liveUrl(item.id)
            ContentType.VOD -> repo.vodUrl(item.id, item.extension)
            ContentType.SERIES -> {
                val ep = episode ?: _state.value.episodes.firstOrNull()
                    ?: error("No episodes")
                repo.seriesUrl(ep.id, ep.containerExtension)
            }
        }
    }

    suspend fun buildPlayback(episode: Episode? = null): PlaybackRequest {
        val url = playUrl(episode)
        val title = when {
            episode != null -> episode.title?.takeIf { it.isNotBlank() } ?: item.name
            else -> item.name
        }
        val subs = if (item.type == ContentType.VOD) {
            repo.fetchExternalSubtitles(item.id)
        } else {
            emptyList()
        }
        return PlaybackRequest(title = title, streamUrl = url, subtitles = subs)
    }

    fun recordWatch() {
        viewModelScope.launch {
            repo.recordWatch(profileId, item)
        }
    }
}

class SearchViewModel(private val repo: StreamoraRepository) : ViewModel() {
    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    private val _results = MutableStateFlow<List<MediaItem>>(emptyList())
    val results: StateFlow<List<MediaItem>> = _results.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private var cacheMovies: List<MediaItem> = emptyList()
    private var cacheSeries: List<MediaItem> = emptyList()
    private var cacheLive: List<MediaItem> = emptyList()
    private var loaded = false

    fun onQueryChange(q: String) {
        _query.value = q
        viewModelScope.launch {
            ensureCache()
            val needle = q.trim().lowercase()
            if (needle.length < 2) {
                _results.value = emptyList()
                return@launch
            }
            _results.value = (cacheMovies + cacheSeries + cacheLive)
                .filter { it.name.lowercase().contains(needle) }
                .take(80)
        }
    }

    private suspend fun ensureCache() {
        if (loaded) return
        _loading.value = true
        try {
            cacheLive = repo.getLiveStreams().map { repo.run { it.toMedia() } }
            cacheMovies = repo.getVodStreams().map { repo.run { it.toMedia() } }
            cacheSeries = repo.getSeries().map { repo.run { it.toMedia() } }
            loaded = true
        } catch (_: Exception) {
        } finally {
            _loading.value = false
        }
    }
}

@Suppress("UNCHECKED_CAST")
class VmFactory(
    private val repo: StreamoraRepository,
    private val profileId: Long? = null,
    private val contentType: ContentType? = null,
    private val mediaItem: MediaItem? = null
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when {
            modelClass.isAssignableFrom(AppViewModel::class.java) -> AppViewModel(repo) as T
            modelClass.isAssignableFrom(HomeViewModel::class.java) ->
                HomeViewModel(repo, profileId!!) as T
            modelClass.isAssignableFrom(BrowseViewModel::class.java) ->
                BrowseViewModel(repo, contentType!!) as T
            modelClass.isAssignableFrom(FavoritesViewModel::class.java) ->
                FavoritesViewModel(repo, profileId!!) as T
            modelClass.isAssignableFrom(DetailsViewModel::class.java) ->
                DetailsViewModel(repo, profileId!!, mediaItem!!) as T
            modelClass.isAssignableFrom(SearchViewModel::class.java) ->
                SearchViewModel(repo) as T
            else -> error("Unknown ViewModel: $modelClass")
        }
    }
}
