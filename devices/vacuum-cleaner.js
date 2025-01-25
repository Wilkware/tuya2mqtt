const TuyaDevice = require('./tuya-device')
const debug = require('debug')('tuya2mqtt:device')
const utils = require('../lib/utils')

class VacuumCleaner extends TuyaDevice {
    async init() {
        // Set device specific variables
        this.config.dpsPower = this.config.dpsPower ? this.config.dpsPower : 2
        this.config.dpsMode = this.config.dpsMode ? this.config.dpsMode : 3
        this.config.dpsDirection = this.config.dpsDirection ? this.config.dpsDirection : 4
        this.config.dpsStatus = this.config.dpsStatus ? this.config.dpsStatus : 5   // Report only
        this.config.dpsBattery = this.config.dpsBattery ? this.config.dpsBattery : 6    // Report only
        this.config.dpsEdge = this.config.dpsEdge ? this.config.dpsEdge : 7 // Report only
        this.config.dpsRoll = this.config.dpsRoll ? this.config.dpsRoll : 8 // Report only
        this.config.dpsFilter = this.config.dpsFilter ? this.config.dpsFilter : 9   // Report only
        this.config.dpsSuction = this.config.dpsSuction ? this.config.dpsSuction : 14
        this.config.dpsArea = this.config.dpsArea ? this.config.dpsArea : 16    // Report only
        this.config.dpsTime = this.config.dpsTime ? this.config.dpsTime : 17    // Report only
        this.config.dpsVolumn = this.config.dpsVolumn ? this.config.dpsVolumn : 28
        this.config.dpsLang = this.config.dpsLang ? this.config.dpsLang : 29
        this.config.dpsSpeed = this.config.dpsSpeed ? this.config.dpsSpeed : 101

        this.config.volumnScale = this.config.volumnScale ? this.config.volumnScale : 0
        this.config.volumnStep = this.config.volumnStep ? this.config.volumnStep : 5

        this.deviceData.mdl = 'Vacuum Cleaner'

        // Map generic DPS topics to device specific topic names
        this.deviceTopics = {
            power: {
                key: this.config.dpsPower,
                type: 'bool',
                readOnly: false
            },
            mode: {
                key: this.config.dpsMode,
                type: 'str',
                readOnly: false
            },
            direction_control: {
                key: this.config.dpsDirection,
                type: 'str',
                readOnly: false
            },
            working_status: {
                key: this.config.dpsStatus,
                type: 'str'
            },
            battery_left: {
                key: this.config.dpsBattery,
                type: 'int',
                topicMin: 0,
                topicMax: 100
            },
            edge_brush: {
                key: this.config.dpsEdge,
                type: 'int',
                topicMin: 0,
                topicMax: 100
            },
            roll_brush: {
                key: this.config.dpsRoll,
                type: 'int',
                topicMin: 0,
                topicMax: 100
            },
            filter: {
                key: this.config.dpsFilter,
                type: 'int',
                topicMin: 0,
                topicMax: 100
            },
            suction: {
                key: this.config.dpsSuction,
                type: 'str',
                readOnly: false
            },
            clean_area: {
                key: this.config.dpsArea,
                type: 'int',
                topicMin: 0,
                topicMax: 9999
            },
            clean_time: {
                key: this.config.dpsTime,
                type: 'int',
                topicMin: 0,
                topicMax: 9999
            },
            volume_set: {
                key: this.config.dpsVolumn,
                type: 'int',
                topicMin: 0,
                topicMax: 100,
                readOnly: false
            },
            language: {
                key: this.config.dpsLang,
                type: 'str',
                readOnly: false
            },
            clean_speed: {
                key: this.config.dpsSpeed,
                type: 'str',
                readOnly: false
            }
        }

        // Get initial states and start publishing topics
        this.getStates()
    }
}

module.exports = VacuumCleaner
