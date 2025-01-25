const TuyaDevice = require('./tuya-device')
const debug = require('debug')('tuya2mqtt:device')
const utils = require('../lib/utils')

class SimpleSwitch extends TuyaDevice {
    async init() {
        // Set device specific variables
        this.config.dpsPower = this.config.dpsPower ? this.config.dpsPower : 1

        this.deviceData.mdl = 'Switch/Socket'

        // Map generic DPS topics to device specific topic names
        this.deviceTopics = {
            state: {
                key: this.config.dpsPower,
                type: 'bool',
                readOnly: false
            }
        }

        // Get initial states and start publishing topics
        this.getStates()
    }
}

module.exports = SimpleSwitch
