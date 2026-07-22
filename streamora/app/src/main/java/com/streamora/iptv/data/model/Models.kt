package com.streamora.iptv.data.model

import com.google.gson.annotations.SerializedName

data class XtreamAuthResponse(
    @SerializedName("user_info") val userInfo: UserInfo? = null,
    @SerializedName("server_info") val serverInfo: ServerInfo? = null
)

data class UserInfo(
    @SerializedName("username") val username: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("exp_date") val expDate: String? = null,
    @SerializedName("is_trial") val isTrial: String? = null,
    @SerializedName("active_cons") val activeCons: String? = null,
    @SerializedName("max_connections") val maxConnections: String? = null,
    @SerializedName("auth") val auth: Int? = null
)

data class ServerInfo(
    @SerializedName("url") val url: String? = null,
    @SerializedName("port") val port: String? = null,
    @SerializedName("https_port") val httpsPort: String? = null,
    @SerializedName("server_protocol") val serverProtocol: String? = null,
    @SerializedName("timezone") val timezone: String? = null
)

data class Category(
    @SerializedName("category_id") val categoryId: String = "",
    @SerializedName("category_name") val categoryName: String = "",
    @SerializedName("parent_id") val parentId: Int = 0
)

data class LiveStream(
    @SerializedName("num") val num: Int = 0,
    @SerializedName("name") val name: String = "",
    @SerializedName("stream_type") val streamType: String? = null,
    @SerializedName("stream_id") val streamId: Int = 0,
    @SerializedName("stream_icon") val streamIcon: String? = null,
    @SerializedName("epg_channel_id") val epgChannelId: String? = null,
    @SerializedName("category_id") val categoryId: String? = null,
    @SerializedName("tv_archive") val tvArchive: Int = 0,
    @SerializedName("direct_source") val directSource: String? = null
)

data class VodStream(
    @SerializedName("num") val num: Int = 0,
    @SerializedName("name") val name: String = "",
    @SerializedName("stream_type") val streamType: String? = null,
    @SerializedName("stream_id") val streamId: Int = 0,
    @SerializedName("stream_icon") val streamIcon: String? = null,
    @SerializedName("rating") val rating: String? = null,
    @SerializedName("rating_5based") val rating5based: Double? = null,
    @SerializedName("category_id") val categoryId: String? = null,
    @SerializedName("container_extension") val containerExtension: String? = null,
    @SerializedName("plot") val plot: String? = null,
    @SerializedName("cast") val cast: String? = null,
    @SerializedName("director") val director: String? = null,
    @SerializedName("genre") val genre: String? = null,
    @SerializedName("releasedate") val releaseDate: String? = null,
    @SerializedName("youtube_trailer") val youtubeTrailer: String? = null,
    @SerializedName("episode_run_time") val episodeRunTime: String? = null,
    @SerializedName("direct_source") val directSource: String? = null
)

data class SeriesItem(
    @SerializedName("num") val num: Int = 0,
    @SerializedName("name") val name: String = "",
    @SerializedName("series_id") val seriesId: Int = 0,
    @SerializedName("cover") val cover: String? = null,
    @SerializedName("plot") val plot: String? = null,
    @SerializedName("cast") val cast: String? = null,
    @SerializedName("director") val director: String? = null,
    @SerializedName("genre") val genre: String? = null,
    @SerializedName("releaseDate") val releaseDate: String? = null,
    @SerializedName("rating") val rating: String? = null,
    @SerializedName("rating_5based") val rating5based: Double? = null,
    @SerializedName("category_id") val categoryId: String? = null,
    @SerializedName("youtube_trailer") val youtubeTrailer: String? = null,
    @SerializedName("episode_run_time") val episodeRunTime: String? = null
)

data class SeriesInfoResponse(
    @SerializedName("seasons") val seasons: List<SeasonInfo>? = null,
    @SerializedName("info") val info: SeriesInfoDetail? = null,
    @SerializedName("episodes") val episodes: Map<String, List<Episode>>? = null
)

data class SeasonInfo(
    @SerializedName("air_date") val airDate: String? = null,
    @SerializedName("episode_count") val episodeCount: Int? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("overview") val overview: String? = null,
    @SerializedName("season_number") val seasonNumber: Int? = null,
    @SerializedName("cover") val cover: String? = null,
    @SerializedName("cover_big") val coverBig: String? = null
)

data class SeriesInfoDetail(
    @SerializedName("name") val name: String? = null,
    @SerializedName("cover") val cover: String? = null,
    @SerializedName("plot") val plot: String? = null,
    @SerializedName("cast") val cast: String? = null,
    @SerializedName("director") val director: String? = null,
    @SerializedName("genre") val genre: String? = null,
    @SerializedName("releaseDate") val releaseDate: String? = null,
    @SerializedName("rating") val rating: String? = null,
    @SerializedName("youtube_trailer") val youtubeTrailer: String? = null
)

data class Episode(
    @SerializedName("id") val id: String = "",
    @SerializedName("episode_num") val episodeNum: Int = 0,
    @SerializedName("title") val title: String? = null,
    @SerializedName("container_extension") val containerExtension: String? = null,
    @SerializedName("info") val info: EpisodeInfo? = null,
    @SerializedName("custom_sid") val customSid: String? = null,
    @SerializedName("added") val added: String? = null,
    @SerializedName("season") val season: Int = 1,
    @SerializedName("direct_source") val directSource: String? = null
)

data class EpisodeInfo(
    @SerializedName("movie_image") val movieImage: String? = null,
    @SerializedName("plot") val plot: String? = null,
    @SerializedName("releasedate") val releaseDate: String? = null,
    @SerializedName("rating") val rating: Double? = null,
    @SerializedName("duration_secs") val durationSecs: Int? = null,
    @SerializedName("duration") val duration: String? = null
)

enum class ContentType { LIVE, VOD, SERIES }

data class MediaItem(
    val id: Int,
    val name: String,
    val posterUrl: String?,
    val type: ContentType,
    val categoryId: String? = null,
    val rating: String? = null,
    val plot: String? = null,
    val extension: String? = null
)
