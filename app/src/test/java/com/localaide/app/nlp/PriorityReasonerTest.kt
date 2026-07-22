package com.localaide.app.nlp

import com.localaide.app.data.model.Deliverable
import com.localaide.app.data.model.Sensitivity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.TimeUnit

class PriorityReasonerTest {
    private val reasoner = PriorityReasoner()

    @Test
    fun ranksUrgentSensitiveBlockerFirst() {
        val now = System.currentTimeMillis()
        val items = listOf(
            Deliverable(
                id = "a",
                title = "Polish the wiki page",
                dueEpochMs = now + TimeUnit.DAYS.toMillis(10),
                sourceSnippet = "We should polish the wiki page next week"
            ),
            Deliverable(
                id = "b",
                title = "Fix production blocker for customer launch",
                dueEpochMs = now + TimeUnit.HOURS.toMillis(6),
                sourceSnippet = "Critical production blocker for the customer launch today — this unblocks the go-live"
            ),
            Deliverable(
                id = "c",
                title = "Send internal status update",
                dueEpochMs = now + TimeUnit.DAYS.toMillis(2),
                sourceSnippet = "Send an internal status update by Wednesday"
            )
        )

        val plan = reasoner.prioritize(items, transcript = "customer launch is blocked")
        assertEquals("b", plan.doFirstId)
        assertEquals("b", plan.ranked.first().id)
        assertEquals(Sensitivity.CRITICAL, plan.ranked.first().sensitivity)
        assertTrue(plan.ranked.first().reasoningSteps.size >= 4)
        assertTrue(plan.overallReasoning.contains("deadline", ignoreCase = true))
    }

    @Test
    fun overdueBeatsFarDeadline() {
        val now = System.currentTimeMillis()
        val items = listOf(
            Deliverable(
                id = "late",
                title = "Submit compliance form",
                dueEpochMs = now - TimeUnit.DAYS.toMillis(1),
                sourceSnippet = "Submit the compliance form that was due yesterday"
            ),
            Deliverable(
                id = "later",
                title = "Draft blog post",
                dueEpochMs = now + TimeUnit.DAYS.toMillis(14),
                sourceSnippet = "Draft the blog post next month"
            )
        )
        val plan = reasoner.prioritize(items)
        assertEquals("late", plan.doFirstId)
    }
}
