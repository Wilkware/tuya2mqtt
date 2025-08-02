const TuyaDevice = require('./tuya-device')
const debug = require('debug')('tuya2mqtt:device')
const utils = require('../lib/utils')

class CeilingFan extends TuyaDevice {
    async init() {
        // Set device specific variables
        this.config.dpsLight = this.config.dpsLight ? this.config.dpsLight : 20
        this.config.dpsColorTemp = this.config.dpsColorTemp ? this.config.dpsColorTemp : 23
        this.config.dpsFan = this.config.dpsFan ? this.config.dpsFan : 60
        this.config.dpsSpeed = this.config.dpsSpeed ? this.config.dpsSpeed : 62
        this.config.dpsDirection = this.config.dpsDirection ? this.config.dpsDirection : 63
        this.config.dpsCountdown = this.config.dpsCountdown ? this.config.dpsCountdown : 64
        this.config.dpsBeep = this.config.dpsBeep ? this.config.dpsBeep : 66

        this.deviceData.mdl = 'Ceiling Fan'

        // Map generic DPS topics to device specific topic names
        this.deviceTopics = {
            light: {
                key: this.config.dpsLight,
                type: 'bool',
                readOnly: false
            },
            color_temp: {
                key: this.config.dpsColorTemp,
                type: 'int',
                topicMin: 0,
                topicMax: 1000,
                readOnly: false
            },
            fan: {
                key: this.config.dpsFan,
                type: 'bool',
                readOnly: false
            },
            speed: {
                key: this.config.dpsSpeed,
                type: 'int',
                topicMin: 1,
                topicMax: 6,
                readOnly: false
            },
            direction: {
                key: this.config.dpsDirection,
                type: 'str',
                readOnly: false
            },
            countdown_left: {
                key: this.config.dpsCountdown,
                type: 'int',
                topicMin: 0,
                topicMax: 540,
                readOnly: false
            },
            beep: {
                key: this.config.dpsBeep,
                type: 'bool',
                readOnly: false
            }
        }

        // Get initial states and start publishing topics
        this.getStates()
    }
}

module.exports = CeilingFan
