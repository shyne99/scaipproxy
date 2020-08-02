/**
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const RegistrarUtils = require('@routr/registrar/utils')
const DSSelector = require('@routr/data_api/ds_selector')
const AgentsAPI = require('@routr/data_api/agents_api')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const SipFactory = Java.type('javax.sip.SipFactory')
const { isBehindNat } = require('@routr/core/processor/processor_utils')

const LOG = LogManager.getLogger()

// Experimental feature to cover SCAIP protocol
class SynthRegistrar {
  constructor () {
    this.agentsAPI = new AgentsAPI(DSSelector.getDS())
    this.headerFactory = SipFactory.getInstance().createHeaderFactory()
    this.addressFactory = SipFactory.getInstance().createAddressFactory()
  }

  register (r) {
    const request = r.clone()
    const aor = request
      .getHeader(FromHeader.NAME)
      .getAddress()
      .getURI()
      .toString()
    this.addEndpoint(aor, request)
    return true
  }

  addEndpoint (aor, request) {
    postal.publish({
      channel: 'locator',
      topic: 'endpoint.add',
      data: {
        addressOfRecord: aor,
        route: this.buildRoute(aor, request)
      }
    })
  }

  buildRoute (addressOfRecord, request) {
    const viaHeader = request.getHeader(ViaHeader.NAME)
    return {
      addressOfRecord,
      isLinkAOR: false,
      thruGw: false,
      sentByAddress: viaHeader.getHost(),
      sentByPort: viaHeader.getPort() === -1 ? 5060 : viaHeader.getPort(),
      received: viaHeader.getReceived(),
      rport: viaHeader.getRPort(),
      contactURI: this.createContactURI(request),
      registeredOn: Date.now(),
      expires: 30,
      nat: isBehindNat(request)
    }
  }

  createContactURI (request) {
    const username = request
      .getHeader(FromHeader.NAME)
      .getAddress()
      .getURI()
      .getUser()
    const viaHeader = request.getHeader(ViaHeader.NAME)
    const host =
      RegistrarUtils.useInternalInterface(request) && viaHeader.getReceived()
        ? viaHeader.getReceived()
        : viaHeader.getHost()
    const port =
      RegistrarUtils.useInternalInterface(request) &&
      viaHeader.getRPort() !== -1
        ? viaHeader.getRPort()
        : viaHeader.getPort() === -1
        ? 5060
        : viaHeader.getPort()

    const contactAddress = this.addressFactory.createAddress(
      `sip:${username}@${host}:${port}`
    )
    const contactHeader = this.headerFactory.createContactHeader(contactAddress)
    return contactHeader.getAddress().getURI()
  }
}

module.exports = SynthRegistrar
