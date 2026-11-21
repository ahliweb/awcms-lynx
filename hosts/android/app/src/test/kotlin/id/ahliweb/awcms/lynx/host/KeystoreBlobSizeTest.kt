package id.ahliweb.awcms.lynx.host

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** An empty value encrypts to IV (12) + GCM tag (16) = 28 bytes and must be accepted on read. */
class KeystoreBlobSizeTest {
    @Test fun emptyValueBlobIsComplete() = assertTrue(KeystoreSecureStore.isCompleteBlob(28))
    @Test fun truncatedBlobIsRejected() = assertFalse(KeystoreSecureStore.isCompleteBlob(27))
}
