package com.streamora.iptv.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.google.gson.Gson
import com.streamora.iptv.data.model.ContentType
import com.streamora.iptv.data.model.MediaItem
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import com.streamora.iptv.data.model.PlaybackRequest
import com.streamora.iptv.data.model.ExternalSubtitle
import com.streamora.iptv.ui.browse.BrowseScreen
import com.streamora.iptv.ui.details.DetailsScreen
import com.streamora.iptv.ui.favorites.FavoritesScreen
import com.streamora.iptv.ui.home.HomeScreen
import com.streamora.iptv.ui.login.LoginScreen
import com.streamora.iptv.ui.player.PlayerScreen
import com.streamora.iptv.ui.profiles.ProfilesScreen
import com.streamora.iptv.ui.search.SearchScreen
import com.streamora.iptv.ui.theme.StreamoraBg
import com.streamora.iptv.ui.theme.StreamoraMuted
import com.streamora.iptv.ui.theme.StreamoraRed
import com.streamora.iptv.ui.theme.StreamoraText
import com.streamora.iptv.viewmodel.AppViewModel
import com.streamora.iptv.viewmodel.BootState
import com.streamora.iptv.viewmodel.BrowseViewModel
import com.streamora.iptv.viewmodel.DetailsViewModel
import com.streamora.iptv.viewmodel.FavoritesViewModel
import com.streamora.iptv.viewmodel.HomeViewModel
import com.streamora.iptv.viewmodel.SearchViewModel
import com.streamora.iptv.viewmodel.VmFactory
import com.streamora.iptv.ui.components.LoadingScreen
import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

private sealed class Tab(val route: String, val label: String, val icon: ImageVector) {
    data object Home : Tab("tab_home", "Home", Icons.Default.Home)
    data object Movies : Tab("tab_movies", "Movies", Icons.Default.Movie)
    data object Series : Tab("tab_series", "Series", Icons.Default.Tv)
    data object Live : Tab("tab_live", "Live", Icons.Default.LiveTv)
    data object MyList : Tab("tab_mylist", "My List", Icons.Default.Favorite)
    data object Search : Tab("tab_search", "Search", Icons.Default.Search)
}

private val tabs = listOf(Tab.Home, Tab.Movies, Tab.Series, Tab.Live, Tab.MyList, Tab.Search)

@Composable
fun StreamoraNav(appViewModel: AppViewModel) {
    val boot by appViewModel.boot.collectAsState()
    val loggingIn by appViewModel.loggingIn.collectAsState()
    val loginError by appViewModel.loginError.collectAsState()
    val profiles by appViewModel.profiles.collectAsState()
    val activeProfileId by appViewModel.activeProfileId.collectAsState()
    val gson = remember { Gson() }

    when (boot) {
        BootState.Loading -> LoadingScreen("Starting Streamora…")
        BootState.NeedLogin -> LoginScreen(
            loading = loggingIn,
            error = loginError,
            onLogin = appViewModel::login
        )
        BootState.NeedProfile -> ProfilesScreen(
            profiles = profiles,
            onSelect = appViewModel::selectProfile,
            onCreate = appViewModel::createProfile,
            onLogout = appViewModel::logout
        )
        BootState.Ready -> {
            val profileId = activeProfileId ?: return
            MainShell(
                appViewModel = appViewModel,
                profileId = profileId,
                gson = gson
            )
        }
    }
}

@Composable
private fun MainShell(
    appViewModel: AppViewModel,
    profileId: Long,
    gson: Gson
) {
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()
    val repo = appViewModel.repository()
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val showBottomBar = tabs.any { it.route == currentRoute }

    Scaffold(
        containerColor = StreamoraBg,
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(containerColor = Color(0xFF121218)) {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = currentRoute == tab.route,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = StreamoraRed,
                                selectedTextColor = StreamoraText,
                                unselectedIconColor = StreamoraMuted,
                                unselectedTextColor = StreamoraMuted,
                                indicatorColor = Color(0xFF2A1518)
                            )
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Tab.Home.route,
            modifier = Modifier.padding(padding)
        ) {
            composable(Tab.Home.route) {
                val vm: HomeViewModel = viewModel(
                    key = "home-$profileId",
                    factory = VmFactory(repo, profileId = profileId)
                )
                val state by vm.state.collectAsState()
                HomeScreen(
                    state = state,
                    onOpen = { item -> navController.navigate(detailsRoute(gson, item)) },
                    onPlay = { item ->
                        when (item.type) {
                            ContentType.SERIES -> navController.navigate(detailsRoute(gson, item))
                            else -> scope.launch {
                                val url = when (item.type) {
                                    ContentType.LIVE -> repo.liveUrl(item.id)
                                    ContentType.VOD -> repo.vodUrl(item.id, item.extension)
                                    ContentType.SERIES -> return@launch
                                }
                                val subs = if (item.type == ContentType.VOD) {
                                    repo.fetchExternalSubtitles(item.id)
                                } else emptyList()
                                navController.navigate(
                                    playerRoute(
                                        PlaybackRequest(
                                            title = item.name,
                                            streamUrl = url,
                                            subtitles = subs
                                        ),
                                        gson
                                    )
                                )
                            }
                        }
                    },
                    onRetry = vm::refresh
                )
            }
            composable(Tab.Movies.route) {
                BrowseTab(repo, ContentType.VOD) { navController.navigate(detailsRoute(gson, it)) }
            }
            composable(Tab.Series.route) {
                BrowseTab(repo, ContentType.SERIES) { navController.navigate(detailsRoute(gson, it)) }
            }
            composable(Tab.Live.route) {
                BrowseTab(repo, ContentType.LIVE) { navController.navigate(detailsRoute(gson, it)) }
            }
            composable(Tab.MyList.route) {
                val vm: FavoritesViewModel = viewModel(
                    key = "fav-$profileId",
                    factory = VmFactory(repo, profileId = profileId)
                )
                val favs by vm.favorites.collectAsState()
                FavoritesScreen(favorites = favs) {
                    navController.navigate(detailsRoute(gson, it))
                }
            }
            composable(Tab.Search.route) {
                val vm: SearchViewModel = viewModel(factory = VmFactory(repo))
                val query by vm.query.collectAsState()
                val results by vm.results.collectAsState()
                val suggestions by vm.suggestions.collectAsState()
                val loading by vm.loading.collectAsState()
                SearchScreen(
                    query = query,
                    loading = loading,
                    results = results,
                    suggestions = suggestions,
                    onQueryChange = vm::onQueryChange,
                    onSuggestionClick = vm::applySuggestion,
                    onOpen = { navController.navigate(detailsRoute(gson, it)) }
                )
            }
            composable(
                route = "details/{payload}",
                arguments = listOf(navArgument("payload") { type = NavType.StringType })
            ) { entry ->
                val payload = URLDecoder.decode(entry.arguments?.getString("payload"), StandardCharsets.UTF_8.name())
                val item = gson.fromJson(payload, MediaItem::class.java)
                val vm: DetailsViewModel = viewModel(
                    key = "details-${item.type}-${item.id}-$profileId",
                    factory = VmFactory(repo, profileId = profileId, mediaItem = item)
                )
                val state by vm.state.collectAsState()
                DetailsScreen(
                    state = state,
                    onBack = { navController.popBackStack() },
                    onToggleLike = vm::toggleLike,
                    onSelectSeason = vm::selectSeason,
                    onPlay = { episode ->
                        scope.launch {
                            try {
                                val req = vm.buildPlayback(episode)
                                vm.recordWatch()
                                navController.navigate(playerRoute(req, gson))
                            } catch (_: Exception) {
                            }
                        }
                    }
                )
            }
            composable(
                route = "player/{payload}",
                arguments = listOf(navArgument("payload") { type = NavType.StringType })
            ) { entry ->
                val payload = URLDecoder.decode(entry.arguments?.getString("payload"), StandardCharsets.UTF_8.name())
                val req = gson.fromJson(payload, PlaybackRequest::class.java)
                PlayerScreen(
                    title = req.title,
                    streamUrl = req.streamUrl,
                    subtitles = req.subtitles ?: emptyList(),
                    onBack = { navController.popBackStack() }
                )
            }
            composable("profiles") {
                ProfilesScreen(
                    profiles = appViewModel.profiles.collectAsState().value,
                    onSelect = {
                        appViewModel.selectProfile(it)
                        navController.navigate(Tab.Home.route) {
                            popUpTo(0)
                        }
                    },
                    onCreate = appViewModel::createProfile,
                    onLogout = {
                        appViewModel.logout()
                    }
                )
            }
        }
    }

    // Profile switcher entry on home via top-level: expose through bottom "account" long-press alternative
    // Add a small profile button via Home? Keep switch via navigating to profiles from shell when needed.
}

@Composable
private fun BrowseTab(
    repo: com.streamora.iptv.data.repository.StreamoraRepository,
    type: ContentType,
    onOpen: (MediaItem) -> Unit
) {
    val vm: BrowseViewModel = viewModel(
        key = "browse-$type",
        factory = VmFactory(repo, contentType = type)
    )
    val state by vm.state.collectAsState()
    BrowseScreen(
        type = type,
        state = state,
        onCategory = vm::selectCategory,
        onOpen = onOpen
    )
}

private fun detailsRoute(gson: Gson, item: MediaItem): String {
    val json = gson.toJson(item)
    val encoded = URLEncoder.encode(json, StandardCharsets.UTF_8.name())
    return "details/$encoded"
}

private fun playerRoute(req: PlaybackRequest, gson: Gson): String {
    val encoded = URLEncoder.encode(gson.toJson(req), StandardCharsets.UTF_8.name())
    return "player/$encoded"
}
