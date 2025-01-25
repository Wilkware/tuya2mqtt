const TuyaDevice = require('./tuya-device')
const debug = require('debug')('tuya2mqtt:device')
const utils = require('../lib/utils')

class SimpleDimmer extends TuyaDevice {
    async init() {
        // Set device specific variables
        this.config.dpsPower = this.config.dpsPower ? this.config.dpsPower : 1
        this.config.dpsBrightness = this.config.dpsBrightness ? this.config.dpsBrightness : 2
        this.config.brightnessScale = this.config.brightnessScale ? this.config.brightnessScale : 255

        this.deviceData.mdl = 'Dimmer Switch'

        // Set white value transform math
        let brightnessStateMath
        let brightnessCommandMath
        if (this.config.brightnessScale === 255) {
            // Devices with brightness scale of 255 seem to not allow values
            // less then 25 (10%) without producing timeout errors.
            brightnessStateMath = '/2.3-10.86'
            brightnessCommandMath = '*2.3+25'
        } else {
            // For other scale (usually 1000), 10-1000 seems OK.
            brightnessStateMath = '/('+this.config.brightnessScale+'/100)'
            brightnessCommandMath = '*('+this.config.brightnessScale+'/100)'
        }

        // Map generic DPS topics to device specific topic names
        this.deviceTopics = {
            state: {
                key: this.config.dpsPower,
                type: 'bool',
                readOnly: false
            },
            brightness: { 
                key: this.config.dpsBrightness,
                type: 'int',
                topicMin: 0,
                topicMax: 100,
                stateMath: brightnessStateMath,
                commandMath: brightnessCommandMath,
                readOnly: false
            }
        }

        // Get initial states and start publishing topics
        this.getStates()
    }
}

module.exports = SimpleDimmer
