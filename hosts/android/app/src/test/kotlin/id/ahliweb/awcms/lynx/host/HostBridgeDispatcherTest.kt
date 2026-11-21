package id.ahliweb.awcms.lynx.host

import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/**
 * Replays hosts/contract-test-vectors.json (the specification every native host is written
 * against) against [HostBridgeDispatcher] with an in-memory [SecureStore] and a recording
 * [LinkOpener]. One test per vector case, each with a fresh dispatcher. Semantics follow the
 * file's `semantics` block: subset match, `$string` / `$platform.*` matchers, `$repeat`
 * generator, `error.message` never compared.
 */
@RunWith(Parameterized::class)
class HostBridgeDispatcherTest(private val id: String, private val case: JSONObject) {

    private class MemoryStore : SecureStore {
        val map = HashMap<String, String>()
        override fun get(key: String): String? = map[key]
        override fun set(key: String, value: String) { map[key] = value }
        override fun delete(key: String) { map.remove(key) }
    }

    @Test
    fun vector() {
        val store = MemoryStore()
        val opened = ArrayList<String>()
        val opensReturn = case.optJSONObject("linkOpener")?.getBoolean("returns") ?: false
        val dispatcher = HostBridgeDispatcher(
            store = store,
            links = LinkOpener { url -> opened.add(url); opensReturn },
            appVersion = "0.0.0-test",
        )
        val steps = case.getJSONArray("steps")
        for (i in 0 until steps.length()) {
            val step = steps.getJSONObject(i)
            val request = step.getJSONObject("request")
            val method = if (request.has("method")) toKotlin(expand(request.get("method"))) else null
            // The Lynx bridge only ever delivers an object (or nothing) for `params`; a
            // non-object value is rejected before the dispatcher, so it reaches it as null.
            val rawParams = if (request.has("params")) toKotlin(expand(request.get("params"))) else null
            @Suppress("UNCHECKED_CAST")
            val params = rawParams as? Map<String, Any?>
            val reply = JSONObject(dispatcher.dispatch(method, params))
            val problem = matches(toKotlin(reply), toKotlin(expand(step.get("expect"))), "reply")
            if (problem != null) fail("$id step $i: $problem")
        }
        val expectedOpened = case.optJSONArray("expectOpenedUrls")
        if (expectedOpened != null) {
            val expected = (0 until expectedOpened.length()).map { expectedOpened.getString(it) }
            assertEquals("$id: opened URLs", expected.map { it.lowercase() }, opened.map { it.lowercase() })
        } else {
            assertTrue("$id: opener must not be reached", opened.isEmpty())
        }
    }

    companion object {
        private val platform = mapOf("host" to "android", "secureStorage" to "android-keystore")

        private fun vectorsFile(): File {
            val path = System.getProperty("awcms.contractVectors")
                ?: error("system property awcms.contractVectors is not set")
            return File(path)
        }

        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun cases(): List<Array<Any>> {
            val cases = JSONObject(vectorsFile().readText()).getJSONArray("cases")
            return (0 until cases.length()).map {
                val c = cases.getJSONObject(it)
                arrayOf(c.getString("id"), c)
            }
        }

        /** Expands `{ "$repeat": { prefix, text, count } }` anywhere in a value. */
        fun expand(value: Any?): Any? = when (value) {
            is JSONArray -> JSONArray().also { out -> for (i in 0 until value.length()) out.put(expand(value.get(i))) }
            is JSONObject -> {
                val repeat = value.optJSONObject("\$repeat")
                if (repeat != null) {
                    repeat.getString("prefix") + repeat.getString("text").repeat(repeat.getInt("count"))
                } else {
                    JSONObject().also { out -> value.keys().forEach { k -> out.put(k, expand(value.get(k))) } }
                }
            }
            else -> value
        }

        fun toKotlin(value: Any?): Any? = when (value) {
            JSONObject.NULL, null -> null
            is JSONObject -> value.keys().asSequence().associateWith { toKotlin(value.get(it)) }
            is JSONArray -> (0 until value.length()).map { toKotlin(value.get(it)) }
            else -> value
        }

        /** Subset match with the vector matchers; returns a problem description or null. */
        fun matches(actual: Any?, expected: Any?, path: String): String? {
            when (expected) {
                "\$string" ->
                    return if (actual is String && actual.isNotEmpty()) null else "$path: not a non-empty string"
                "\$platform.host" ->
                    return if (actual == platform["host"]) null else "$path: $actual"
                "\$platform.secureStorage" ->
                    return if (actual == platform["secureStorage"]) null else "$path: $actual"
            }
            if (expected is Map<*, *>) {
                if (actual !is Map<*, *>) return "$path: expected object"
                for ((k, v) in expected) {
                    if (!actual.containsKey(k)) return "$path.$k: missing"
                    matches(actual[k], v, "$path.$k")?.let { return it }
                }
                return null
            }
            if (expected is List<*>) {
                if (actual !is List<*> || actual.size != expected.size) return "$path: array mismatch"
                for (i in expected.indices) matches(actual[i], expected[i], "$path[$i]")?.let { return it }
                return null
            }
            if (expected is Number && actual is Number) {
                return if (expected.toDouble() == actual.toDouble()) null else "$path: $actual != $expected"
            }
            return if (expected == actual) null else "$path: expected <$expected> got <$actual>"
        }
    }
}
