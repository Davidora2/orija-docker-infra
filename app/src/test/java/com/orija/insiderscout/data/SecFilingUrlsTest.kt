package com.orija.insiderscout.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SecFilingUrlsTest {
    @Test
    fun convertsRawOwnershipXmlToStyledViewer() {
        val raw = "https://www.sec.gov/Archives/edgar/data/1303873/000121390026082543/ownership.xml"
        val styled = SecFilingUrls.styledViewerUrl(raw)
        assertEquals(
            "https://www.sec.gov/Archives/edgar/data/1303873/000121390026082543/xslF345X06/ownership.xml",
            styled,
        )
        assertTrue(SecFilingUrls.isOwnershipXml(raw))
        assertFalse(SecFilingUrls.isOwnershipXml(styled))
    }

    @Test
    fun alternateUrlsPreferXslThenRaw() {
        val raw = "https://www.sec.gov/Archives/edgar/data/1303873/000121390026082543/ownership.xml"
        val alts = SecFilingUrls.alternateViewerUrls(raw)
        assertTrue(alts.first().contains("/xslF345X06/"))
        assertEquals(raw, alts.last())
    }
}
