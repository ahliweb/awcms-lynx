package id.ahliweb.awcms.lynx.host

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

/**
 * The two behaviours `contract-test-vectors.json` lists under `notCovered` because they need an
 * injected fault: STORAGE_UNAVAILABLE and HOST_ERROR (with no exception text in the reply).
 */
class HostBridgeFaultTest {
    private class FailingStore(private val failure: () -> Exception) : SecureStore {
        override fun get(key: String): String? = throw failure()
        override fun set(key: String, value: String) = throw failure()
        override fun delete(key: String) = throw failure()
    }

    private val key = "awcms-lynx:contract-test"

    @Test
    fun storeFailureReportsStorageUnavailable() {
        val d = HostBridgeDispatcher(FailingStore { SecureStoreException("boom") }, { true }, "0")
        listOf(
            "secureStorage.get" to mapOf("key" to key),
            "secureStorage.set" to mapOf("key" to key, "value" to "v"),
            "secureStorage.delete" to mapOf("key" to key),
        ).forEach { (method, params) ->
            val reply = JSONObject(d.dispatch(method, params))
            assertFalse(reply.getBoolean("ok"))
            assertEquals("STORAGE_UNAVAILABLE", reply.getJSONObject("error").getString("code"))
        }
    }

    @Test
    fun internalFaultReportsHostErrorWithoutLeaking() {
        val d = HostBridgeDispatcher(FailingStore { IllegalStateException("secret-path /data/x") }, { true }, "0")
        val raw = d.dispatch("secureStorage.get", mapOf("key" to key))
        assertEquals("HOST_ERROR", JSONObject(raw).getJSONObject("error").getString("code"))
        assertFalse("exception text must not reach the reply", raw.contains("secret-path"))
    }
}
