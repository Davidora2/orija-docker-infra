package com.localaide.app.nlp

import com.localaide.app.data.model.Deliverable
import org.junit.Assert.assertTrue
import org.junit.Test

class DeliverableExtractorTest {
    private val extractor = DeliverableExtractor()

    @Test
    fun extractsActionItemsWithDueDates() {
        val transcript = """
            Thanks everyone. Action item: Alex will send the pricing deck by Friday.
            Sam needs to schedule the customer call next week.
            Please review the Q3 draft tomorrow.
        """.trimIndent()

        val items: List<Deliverable> = extractor.extract(transcript)
        assertTrue("Expected deliverables, got ${items.size}", items.size >= 2)
        assertTrue(items.any { it.title.contains("pricing", ignoreCase = true) || it.sourceSnippet.contains("pricing") })
        assertTrue(items.any { it.dueEpochMs != null })
    }
}
