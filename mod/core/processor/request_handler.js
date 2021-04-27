/**
 * @author Pedro Sanders
 * @since v1
 */
const { connectionException } = require('@routr/utils/exception_helpers')
const { sendResponse } = require('@routr/core/processor/processor_utils')
const { Status } = require('@routr/core/status')
const config = require('@routr/core/config_util')()
const postal = require('postal')

const {
  getAdvertisedAddr,
  configureRoute,
  configureVia,
  configureProxyAuthorization,
  configureRequestURI,
  configureMaxForwards,
  configurePrivacy,
  configureRecordRoute,
  configureIdentity,
  configureXHeaders,
  configureCSeq,
  isInDialog
} = require('@routr/core/processor/request_utils')
const { RoutingType } = require('@routr/core/routing_type')
const ObjectId = Java.type('org.bson.types.ObjectId')
const Request = Java.type('javax.sip.message.Request')
const Response = Java.type('javax.sip.message.Response')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const ToHeader = Java.type('javax.sip.header.ToHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const ConcurrentHashMap = Java.type('java.util.concurrent.ConcurrentHashMap')
const requestStore = new ConcurrentHashMap()

const LOG = LogManager.getLogger()

class RequestHandler {
  constructor (sipProvider, contextStorage) {
    this.sipProvider = sipProvider
    this.contextStorage = contextStorage
    const self = this

    postal.subscribe({
      channel: 'locator',
      topic: 'endpoint.find.reply',
      callback: function (data) {
        LOG.debug('SUSPECT 00')
        const requestInfo = requestStore.get(data.requestId)
        requestStore.remove(data.requestId)

        LOG.debug('SUSPECT 01')
        if (requestInfo !== null && data.response) {
          LOG.debug('SUSPECT 02')
          const transaction = requestInfo.serverTransaction
          const routeInfo = requestInfo.routeInfo
          const request = requestInfo.request

          const response = data.response

          if (response.status == Status.NOT_FOUND) {
            LOG.debug('SUSPECT 03')
            return sendResponse(transaction, Response.TEMPORARILY_UNAVAILABLE)
          }

          LOG.debug('SUSPECT 04')
          const route = response.data
          self.processRoute(transaction, request, route, routeInfo)
          LOG.debug('SUSPECT 05')
        }
      }
    })
  }

  doProcess (transaction, request, routeInfo) {
    let requestURI = request.getRequestURI()
    const toURI = request
      .getHeader(ToHeader.NAME)
      .getAddress()
      .getURI()

    // If the requestURI has the form sip:host and the config.spec.patchRequestURI flag
    // is activated, then the server will add the user part of the toHeader as the user for the
    // requestURI
    if (config.spec.patchRequestURI && !requestURI.getUser()) {
      requestURI.setUser(toURI.getUser())
      request.setRequestURI(requestURI)
    }

    const aor = config.spec.useToAsAOR ? toURI : requestURI

    if (isInDialog(request)) {
      this.processRoute(transaction, request, null, routeInfo)
    } else {
      const requestId = new ObjectId().toString()
      requestStore.put(requestId, {
        serverTransaction: transaction,
        request,
        routeInfo
      })
      postal.publish({
        channel: 'locator',
        topic: 'endpoint.find',
        data: {
          addressOfRecord: aor,
          requestId: requestId
        }
      })
    }
  }

  processRoute (transaction, request, route, routeInfo) {
    const transport = request
      .getHeader(ViaHeader.NAME)
      .getTransport()
      .toLowerCase()

    const lp = this.sipProvider.getListeningPoint(transport)
    const localAddr = { host: lp.getIPAddress().toString(), port: lp.getPort() }

    const advertisedAddr = getAdvertisedAddr(request, route, localAddr)

    let requestOut = configureMaxForwards(request)
    requestOut = configureProxyAuthorization(requestOut)
    requestOut = configureRoute(requestOut, localAddr)
    requestOut = configureVia(requestOut, advertisedAddr)
    //requestOut = configureContact(requestOut)

    if (!isInDialog(request)) {
      requestOut = configureRequestURI(requestOut, routeInfo, route)
      //requestOut = configurePrivacy(requestOut, routeInfo)
      //requestOut = configureIdentity(requestOut, route)
      //requestOut = configureXHeaders(requestOut, route)
      requestOut = configureRecordRoute(requestOut, advertisedAddr, localAddr)
    }

    this.sendRequest(transaction, request, requestOut)
  }

  sendRequest (serverTransaction, request, requestOut) {
    // Does not need a transaction
    if (request.getMethod().equals(Request.ACK)) {
      return this.sipProvider.sendRequest(requestOut)
    }
    try {
      // The request must be cloned or the stack will not fork the call
      const clientTransaction = this.sipProvider.getNewClientTransaction(
        requestOut.clone()
      )
      clientTransaction.sendRequest()
    } catch (e) {
      connectionException(e, requestOut.getRequestURI().getHost())
    }
  }
}

module.exports = RequestHandler
