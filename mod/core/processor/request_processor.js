/**
 * @author Pedro Sanders
 * @since v1
 */
const {
  sendResponse,
  sendUnauthorized
} = require('@routr/core/processor/processor_utils')
const RegisterHandler = require('@routr/core/processor/register_handler')
const CancelHandler = require('@routr/core/processor/cancel_handler')
const RequestHandler = require('@routr/core/processor/request_handler')
const config = require('@routr/core/config_util')()
const FromHeader = Java.type('javax.sip.header.FromHeader')
const SynthRegistrar = require('@routr/registrar/synth_reg')
const Registrar = require('@routr/registrar/registrar')

const Request = Java.type('javax.sip.message.Request')
const Response = Java.type('javax.sip.message.Response')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

// Experimental feature
const isScaipMessage = r => r.getHeader(FromHeader.NAME).getTag() === '286524'

class RequestProcessor {
  constructor (sipProvider, dataAPIs, contextStorage) {
    this.sipProvider = sipProvider
    this.contextStorage = contextStorage
    this.dataAPIs = dataAPIs
    this.domainsAPI = dataAPIs.DomainsAPI
    this.synthRegistrar = new SynthRegistrar()
    this.registrar = new Registrar()
    this.messageHandler = new RequestHandler(
      this.sipProvider,
      this.contextStorage
    )
    this.registerHandler = new RegisterHandler()
  }

  process (event) {
    const request = event.getRequest()
    let transaction = event.getServerTransaction()

    if (
      transaction === null &&
      request.getMethod().equals(Request.ACK) === false
    ) {
      transaction = this.sipProvider.getNewServerTransaction(request)
    }

    LOG.debug(
      `core.processor.RequestProcessor.process [running handler for method \`${request.getMethod()}\`]`
    )

    switch (request.getMethod()) {
      case Request.MESSAGE:
        if (
          request.getMethod() === Request.MESSAGE &&
          isScaipMessage(request)
        ) {
          // Check if message is authenticated
          if (config.spec.ex_scaipAuthEnabled) {
            LOG.debug(
              `core.processor.RequestProcessor.process [scaip auth provider = ${config.spec.ex_scaipAuthProvider.toLowerCase()}]`
            )

            if (!this.registrar.isAuthorized(request)) {
              sendUnauthorized(transaction)
              // Prevent rejecting request with same CSeq
              // this.sipProvider.getSipStack().removeTransaction(transaction)
              break
            }
          }

          this.synthRegistrar.register(request)
        }
        this.messageHandler.doProcess(transaction, request, null)
      case Request.REGISTER:
        this.registerHandler.doProcess(transaction)
        break
      default:
        sendResponse(transaction, Response.METHOD_NOT_ALLOWED)
    }
  }
}

module.exports = RequestProcessor
