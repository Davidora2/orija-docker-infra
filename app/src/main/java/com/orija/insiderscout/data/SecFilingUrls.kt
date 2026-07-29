package com.orija.insiderscout.data

/**
 * SEC stores Form 4 ownership docs as raw XML and as an XSL-rendered HTML view.
 * Prefer the HTML viewer for humans.
 *
 * Raw:  .../ownership.xml
 * Nice: .../xslF345X06/ownership.xml
 */
object SecFilingUrls {
    private val xslVersions = listOf("xslF345X06", "xslF345X05", "xslF345X04", "xslF345X03")

    fun isOwnershipXml(url: String): Boolean {
        val name = url.substringAfterLast('/').lowercase()
        return name.endsWith(".xml") && !url.contains("/xslF345", ignoreCase = true)
    }

    fun styledViewerUrl(rawOrAnyUrl: String): String {
        if (rawOrAnyUrl.contains("/xslF345", ignoreCase = true)) return rawOrAnyUrl
        if (!rawOrAnyUrl.endsWith(".xml", ignoreCase = true)) return rawOrAnyUrl
        val file = rawOrAnyUrl.substringAfterLast('/')
        val base = rawOrAnyUrl.substringBeforeLast('/')
        return "$base/${xslVersions.first()}/$file"
    }

    fun alternateViewerUrls(rawOrAnyUrl: String): List<String> {
        val file = rawOrAnyUrl.substringAfterLast('/')
        val lower = rawOrAnyUrl.lowercase()
        val xslIdx = lower.indexOf("/xslf345")
        val base = if (xslIdx >= 0) {
            rawOrAnyUrl.substring(0, xslIdx).trimEnd('/')
        } else {
            rawOrAnyUrl.substringBeforeLast('/')
        }
        val raw = "$base/$file"
        return (xslVersions.map { "$base/$it/$file" } + raw).distinct()
    }
}
