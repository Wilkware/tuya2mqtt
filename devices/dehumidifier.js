const TuyaDevice = require('./tuya-device')
const debug = require('debug')('tuya2mqtt:device')
const utils = require('../lib/utils')

class Dehumidifier extends TuyaDevice {
    async init() {
        // Set device specific variables
        this.config.dpsPower = this.config.dpsPower ? this.config.dpsPower : 1
        this.config.dpsDehumidify = this.config.dpsDehumidify ? this.config.dpsDehumidify : 3
        this.config.dpsSpeed = this.config.dpsSpeed ? this.config.dpsSpeed : 4
        this.config.dpsHumidity = this.config.dpsHumidity ? this.config.dpsHumidity : 6   // Report only
        this.config.dpsTemp = this.config.dpsTemp ? this.config.dpsTemp : 7 // Report only
        this.config.dpsCountdown = this.config.dpsCountdown ? this.config.dpsCountdown : 17
        this.config.dpsTank = this.config.dpsTank ? this.config.dpsTank : 101 // Report only
        this.config.dpsDefrost = this.config.dpsDefrost ? this.config.dpsDefrost : 102 // Report only
 
        this.config.humidityScale = this.config.humidityScale ? this.config.humidityScale : 0
        this.config.humidityStep = this.config.humidityStep ? this.config.humidityStep : 1

        this.config.tempScale = this.config.tempScale ? this.config.tempScale : 0
        this.config.tempStep = this.config.tempStep ? this.config.tempStep : 1

        this.deviceData.mdl = 'Dehumidifier'

        // Map generic DPS topics to device specific topic names
        this.deviceTopics = {
            switch: {
                key: this.config.dpsPower,
                type: 'bool',
                readOnly: false
            },
            dehumidify_set_enum: {
                key: this.config.dpsDehumidify,
                type: 'str',
                readOnly: false
            },
            fan_speed_enum: {
                key: this.config.dpsSpeed,
                type: 'str',
                readOnly: false
            },
            humidity_indoor: {
                key: this.config.dpsHumidity,
                type: 'int',
                topicMin: 30,
                topicMax: 90,
                readOnly: true
            },
            temp_indoor: {
                key: this.config.dpsTemp,
                type: 'int',
                topicMin: 0,
                topicMax: 60,
                readOnly: true
            },
            countdown_set: {
                key: this.config.dpsCountdown,
                type: 'str',
                readOnly: false
            },
            tank_full: {
                key: this.config.dpsTank,
                type: 'bool',
                readOnly: true
            },
            defrost_status: {
                key: this.config.dpsDefrost,
                type: 'bool',
                readOnly: true
            }
        }

        // Get initial states and start publishing topics
        this.getStates()
    }
}

module.exports = Dehumidifier