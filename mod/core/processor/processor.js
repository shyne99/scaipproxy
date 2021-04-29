/**
 * @author Pedro Sanders
 * @since v1
 */
const RequestProcessor = require('@routr/core/processor/request_processor')
const ResponseProcessor = require('@routr/core/processor/response_processor')
const SipListener = Java.type('javax.sip.SipListener')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

class Processor {
  constructor (sipProvider, dataAPIs, contextStorage) {
    this.requestProcessor = new RequestProcessor(
      sipProvider,
      dataAPIs,
      contextStorage
    )
    this.responseProcessor = new ResponseProcessor(sipProvider, contextStorage)
  }

  get listener () {
    return new SipListener({
      processRequest: event => {
        try {
          this.requestProcessor.process(event)
        } catch (e) {
          LOG.error(e)
        }
      },

      processResponse: event => {
        try {
          this.responseProcessor.process(event)
        } catch (e) {
          LOG.error(e)
        }
      },

      processTimeout: event => {
        LOG.debug('Entered processTimeout')
      },

      processTransactionTerminated: event => {
        LOG.debug('Entered processTransactionTerminated')
      },

      processIOException: event => {
        LOG.debug('Entered processIOException')
      },

      processDialogTerminated: event => {
        LOG.debug('Entered processDialogTerminated')
      }
    })
  }
}

module.exports = Processor
