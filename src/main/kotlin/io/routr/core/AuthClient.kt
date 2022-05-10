package io.routr.core

import io.grpc.ManagedChannel
import io.grpc.ManagedChannelBuilder
import io.grpc.StatusRuntimeException
import io.routr.core.DigestAuthenticationGrpc.DigestAuthenticationBlockingStub
import java.io.Closeable
import java.util.concurrent.TimeUnit
import org.apache.logging.log4j.LogManager
import org.json.simple.JSONObject
import org.json.simple.parser.*

/**
 * @author Pedro Sanders
 * @since v1
 */
class AuthClient internal constructor(private val channel: ManagedChannel) : Closeable {
  private val blockingStub: DigestAuthenticationBlockingStub =
      DigestAuthenticationGrpc.newBlockingStub(channel)

  constructor(
      host: String?,
      port: Int
  ) : this(ManagedChannelBuilder.forAddress(host, port).usePlaintext().build()) {}

  override fun close() {
    channel.shutdown().awaitTermination(5, TimeUnit.SECONDS)
  }

  fun authenticate(auth: String?): Boolean {
    val jo = JSONParser().parse(auth) as JSONObject
    val builder =
        AuthenticationRequest.newBuilder()
            .setUsername(jo.get("username") as String)
            .setRealm(jo.get("realm") as String)
            .setNonce(jo.get("nonce") as String)
            .setUri(jo.get("uri") as String)
            .setMethod(jo.get("method") as String)
            .setQop(jo.get("qop") as String)
            .setResponse(jo.get("response") as String)
            .setCNonce(jo.get("cnonce") as String)
            .setNonceCount(jo.get("nc") as String)

    if (jo.get("opaque") != null) {
      builder.setOpaque(jo.get("opaque") as String)
    }

    if (jo.get("algorithm") != null) {
      builder.setAlgorithm(jo.get("algorithm") as String)
    }

    try {
      val result = blockingStub.authenticate(builder.build())
      return result.isValid
    } catch (e: StatusRuntimeException) {
      LOG.warn("rpc request failed: ${e.status.getCode()}")
      return false
    }
  }

  companion object {
    private val LOG = LogManager.getLogger(AuthClient::class.java)
  }
}