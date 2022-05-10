/**
 * @author Pedro Sanders
 * @since v1
 */
const AuthorizationHeader = Java.type('javax.sip.header.AuthorizationHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))
const AuthClient = Java.type('io.routr.core.AuthClient')

// Authentiation object
const digestAuthHost =
  System.getenv('DIGEST_AUTH_ADDR')?.split(':')[0] || 'localhost'
const digestAuthPort =
  System.getenv('DIGEST_AUTH_ADDR')?.split(':')[1] || '50051'
const auth = new AuthClient(digestAuthHost, parseInt(digestAuthPort))

LOG.debug(
  `Connecting to digest auth client at ${digestAuthHost}:${digestAuthPort}`
)

const getUsername = r => r.getHeader(AuthorizationHeader.NAME).getUsername()

function getNonceCount (d) {
  const h = Java.type('java.lang.Integer').toHexString(d)
  const cSize = 8 - h.toString().length
  let nc = ''
  let cnt = 0

  while (cSize > cnt) {
    nc += '0'
    cnt++
  }

  return nc + h
}

function buildAuthHeader (username, authHeader, method) {
  return {
    username,
    realm: authHeader.getRealm(),
    nonce: authHeader.getNonce(),
    // For some weird reason the interface value is an int while original value is a string
    nc: getNonceCount(authHeader.getNonceCount()),
    cnonce: authHeader.getCNonce(),
    uri: authHeader.getURI().toString(),
    method,
    qop: authHeader.getQop(),
    response: authHeader.getResponse(),
    opaque: authHeader.getOpaque()
  }
}

function checkAuthorization (request) {
  const authHeader = request.getHeader(AuthorizationHeader.NAME)

  if (!authHeader) return false

  const username = getUsername(request)

  const authRequest = buildAuthHeader(username, authHeader, request.getMethod())

  try {
    return auth.authenticate(JSON.stringify(authRequest))
  } catch (e) {
    LOG.warn(e.message | e)
  }
  return false
}

module.exports = checkAuthorization
