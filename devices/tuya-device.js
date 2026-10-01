const TuyAPI = require('tuyapi')
const { evaluate } = require('mathjs')
const utils = require('../lib/utils')
const debug = require('debug')('tuya2mqtt:tuyapi')
const debugState = require('debug')('tuya2mqtt:state')
const debugCommand = require('debug')('tuya2mqtt:command')
const debugError = require('debug')('tuya2mqtt:error')

// Seconds to wait for a connection (incl. 3.4/3.5 session key negotiation)
const CONNECT_TIMEOUT = 20

class TuyaDevice {
    constructor(deviceInfo) {
        this.config = deviceInfo.configDevice
        this.mqttClient = deviceInfo.mqttClient
        this.topic = deviceInfo.topic
        this.qos = (typeof deviceInfo.qos != 'undefined') ? deviceInfo.qos : 1
        this.retain = !!deviceInfo.retain

        // Build TuyAPI device options from device config info
        this.options = {
            id: this.config.id,
            key: this.config.key,
            // Defaults stay as before: refresh on connect only for devices without fixed IP
            issueRefreshOnConnect: (typeof this.config.issueRefreshOnConnect != 'undefined') ? !!this.config.issueRefreshOnConnect : !this.config.ip,
            issueRefreshOnPing: !!this.config.issueRefreshOnPing
        }
        if (this.config.name) { this.options.name = this.config.name.toLowerCase().replace(/\s|\+|#|\//g, '_') }
        if (this.config.ip) {
            this.options.ip = this.config.ip
            this.options.version = this.config.version ? this.config.version : '3.3'
        }
        if (typeof this.config.issueGenericDpsTopics == 'undefined') {
            this.config.issueGenericDpsTopics = true
        }

        // Initialize properties to hold cached device state data
        this.dps = {}
        this.color = { 'h': 0, 's': 0, 'b': 0 }

        // Device friendly topics
        this.deviceTopics = {}

        // Missed heartbeat monitor
        this.heartbeatsMissed = 0
        this.connecting = false
        this.stopped = false

        // Build the MQTT topic for this device (friendly name or device id)
        if (this.options.name) {
            this.baseTopic = this.topic + this.options.name + '/'
        } else {
            this.baseTopic = this.topic + this.options.id + '/'
        }

        // Create the new Tuya Device
        this.device = new TuyAPI(JSON.parse(JSON.stringify(this.options)))

        // Some new devices don't send data updates if the app isn't open.
        // These devices need to be "forced" to send updates. You can do so by calling refresh() (see tuyapi docs), which will emit a dp-refresh event.
        this.device.on('dp-refresh', (data) => {
            if (typeof data === 'object') {
                if (data.cid) {
                    debug('Received dp-refresh data from device ' + this.options.id + ' cid: ' + data.cid + ' ->', JSON.stringify(data.dps))
                } else {
                    debug('Received dp-refresh data from device ' + this.options.id + ' ->', JSON.stringify(data.dps))
                }
                this.updateState(data)
            } else {
                if (data !== 'json obj data unvalid') {
                    debug('Received string data from device ' + this.options.id + ' ->', data.replace(/[^a-zA-Z0-9 ]/g, ''))
                }
            }
        })

        // Listen for device data and call update DPS function if valid
        this.device.on('data', (data) => {
            if (typeof data === 'object') {
                debug('Received JSON data from device ' + this.options.id + ' ->', JSON.stringify(data.dps))
                this.updateState(data)
            } else {
                if (data !== 'json obj data unvalid') {
                    debug('Received string data from device ' + this.options.id + ' ->', data.replace(/[^a-zA-Z0-9 ]/g, ''))
                }
            }
        })

        // Attempt to find/connect to device and start heartbeat monitor
        this.connectDevice()
        this.monitorHeartbeat()

        // On connect perform device specific init
        this.device.on('connected', async () => {
            // Sometimes TuyAPI reports connection even on socket error
            // Wait one second to check if device is really connected before initializing
            await utils.sleep(1)
            if (this.device.isConnected()) {
                debug('Connected to device ' + this.toString())
                this.heartbeatsMissed = 0
                this.publishStatus('online')
                this.runInit()
            }
        })

        // On disconnect perform device specific disconnect
        this.device.on('disconnected', async () => {
            this.connected = false
            // TuyAPI clears but does not reset the pong timeout, which disables its own
            // dead connection detection after a reconnect until the first pong arrives
            clearTimeout(this.device._pingPongTimeout)
            this.device._pingPongTimeout = null
            this.publishStatus('offline')
            debug('Disconnected from device ' + this.toString())
            if (!this.stopped) {
                this.reconnect()
            }
        })

        // On connect error call reconnect
        this.device.on('error', (err) => {
            debugError(err)
            if (!this.stopped && !this.device.isConnected()) {
                this.reconnect()
            }
        })

        // On heartbeat reset heartbeat timer
        this.device.on('heartbeat', () => {
            this.heartbeatsMissed = 0
        })
    }

    // Get and update cached values of all configured/known dps value for device
    async getStates() {
        // Suppress topic updates while syncing device state with cached state
        this.connected = false
        for (let topic in this.deviceTopics) {
            const key = this.deviceTopics[topic].key
            if (!this.dps[key]) { this.dps[key] = {} }
            try {
                this.dps[key].val = await this.device.get({ "dps": key })
                this.dps[key].updated = true
            } catch {
                debugError('Could not get value for device DPS key ' + key)
            }
        }
        this.connected = true
        // Force topic update now that all states are fully syncronized
        this.publishTopics()
    }

    // Update cached DPS values on data updates
    updateState(data) {
        if (typeof data.dps != 'undefined') {
            // Update cached device state data
            for (let key in data.dps) {
                // Only update if the received value is different from previous value
                if (!this.dps[key] || this.dps[key].val !== data.dps[key]) {
                    this.dps[key] = {
                        'val': data.dps[key],
                        'updated': true
                    }
                }
                if (this.isRgbtwLight) {
                    if (this.config.hasOwnProperty('dpsColor') && this.config.dpsColor == key) {
                        this.updateColorState(data.dps[key])
                    } else if (this.config.hasOwnProperty('dpsMode') && this.config.dpsMode == key && this.dps.hasOwnProperty(this.config.dpsColor)) {
                        // If color/white mode is changing, force sending color state
                        // Allows overriding saturation value to 0% for white mode for the HSB device topics
                        this.dps[this.config.dpsColor].updated = true
                    }
                }
            }
            if (this.connected) {
                this.publishTopics()
            }
        }
    }

    // Publish device specific state topics
    publishTopics() {
        // Don't publish if device is not connected
        if (!this.connected) return

        // Loop through and publish all device specific topics
        for (let topic in this.deviceTopics) {
            const deviceTopic = this.deviceTopics[topic]
            const key = deviceTopic.key
            // Only publish values if different from previous value
            if (this.dps[key] && this.dps[key].updated) {
                const state = this.getTopicState(deviceTopic, this.dps[key].val)
                if (state) {
                    this.publishMqtt(this.baseTopic + topic, state, true)
                }
            }
        }

        // Publish Generic Dps Topics
        if (this.config.issueGenericDpsTopics) {
            this.publishDpsTopics()
        }

        // Mark all values as published, also when generic DPS topics are disabled
        for (let key in this.dps) {
            this.dps[key].updated = false
        }
    }

    // Publish all dps-values to topic
    publishDpsTopics() {
        try {
            if (!Object.keys(this.dps).length) { return }

            const dpsTopic = this.baseTopic + 'dps'
            // Publish DPS JSON data if not empty
            let data = {}
            for (let key in this.dps) {
                // Only publish values if different from previous value
                if (this.dps[key].updated) {
                    data[key] = this.dps[key].val
                }
            }
            data = JSON.stringify(data)
            const dpsStateTopic = dpsTopic + '/state'
            debugState('MQTT DPS JSON: ' + dpsStateTopic + ' -> ', data)
            this.publishMqtt(dpsStateTopic, data, false)

            // Publish dps/<#>/state value for each device DPS
            for (let key in this.dps) {
                // Only publish values if different from previous value
                if (this.dps[key].updated) {
                    const dpsKeyTopic = dpsTopic + '/' + key + '/state'
                    const val = this.dps[key].val
                    const data = (val === undefined || val === null) ? 'None' : val.toString()
                    debugState('MQTT DPS' + key + ': ' + dpsKeyTopic + ' -> ', data)
                    this.publishMqtt(dpsKeyTopic, data, false)
                    this.dps[key].updated = false
                }
            }
        } catch (e) {
            debugError(e);
        }
    }

    // Get the friendly topic state based on configured DPS value type
    getTopicState(deviceTopic, value) {
        let state
        switch (deviceTopic.type) {
            case 'bool':
                state = value ? 'on' : 'off'
                break;
            case 'int':
            case 'float':
                state = this.parseNumberState(value, deviceTopic)
                break;
            case 'hsb':
            case 'hsbhex':
                // Return comma separate array of component values for specific topic
                state = new Array()
                const components = deviceTopic.components.split(',')
                for (let i in components) {
                    // If light is in white mode always report saturation 0%, otherwise report actual value
                    state.push((components[i] === 's' && this.dps.hasOwnProperty(this.config.dpsMode) && this.dps[this.config.dpsMode].val === 'white') ? 0 : this.color[components[i]])
                }
                state = (state.join(','))
                break;
            case 'str':
                state = value ? value : ''
                break;
        }
        return state
    }

    // Parse the received state numeric value based on deviceTopic rules
    parseNumberState(value, deviceTopic) {
        // Check if it's a number and it's not outside of defined range
        if (isNaN(value)) {
            return ''
        }

        // Perform any required math transforms before returing command value
        switch (deviceTopic.type) {
            case 'int':
                value = (deviceTopic.stateMath) ? parseInt(Math.round(evaluate(value + deviceTopic.stateMath))) : parseInt(value)
                break;
            case 'float':
                value = (deviceTopic.stateMath) ? parseFloat(evaluate(value + deviceTopic.stateMath)) : parseFloat(value)
                break;
        }

        return value.toString()
    }

    // Process MQTTT all states command
    processCommand(message) {
        let command
        if (utils.isJsonString(message)) {
            debugCommand('Received MQTT command message is a JSON string')
            command = JSON.parse(message);
        } else {
            debugCommand('Received MQTT command message is a text string')
            command = message.toLowerCase()
        }

        // If get-states command, then updates all states and re-publish topics
        if (command === 'get-states') {
            // Handle "get-states" command to update device state
            debugCommand('Received command: ', command)
            this.getStates()
        } else {
            debugCommand('Invalid message for device id: ' + this.config.id)
        }
    }

    // Process MQTT commands for all device command topics
    processDeviceCommand(message, topic) {
        let command
        if (utils.isJsonString(message)) {
            debugCommand('Individual device topics do not accept JSON values')
        } else {
            command = message.toLowerCase()
            // Determine if topic valid
            const deviceTopic = this.deviceTopics.hasOwnProperty(topic) ? this.deviceTopics[topic] : ''
            debugCommand('Device Topic: ', deviceTopic)
            if (deviceTopic) {
                debugCommand('Device ' + this.options.id + ' received device topic: ' + topic + ', message: ' + command)
                const readOnly = deviceTopic.hasOwnProperty('readOnly') ? deviceTopic.readOnly : true
                if (readOnly === false) {
                    let commandResult = this.sendTuyaCommand(command, deviceTopic)
                    if (!commandResult) {
                        debugCommand('Device topic ' + this.baseTopic + topic + ' received invalid value: ' + command)
                    }
                } else {
                    debugCommand('Readonly device topic ' + this.baseTopic + topic + ' for device id: ' + this.config.id)
                }
                
            } else {
                debugCommand('Invalid device topic ' + this.baseTopic + topic + ' for device id: ' + this.config.id)
                return
            }
        }
    }

    // Process Tuya JSON commands via DPS command topic
    processDpsCommand(message) {
        if (utils.isJsonString(message)) {
            const command = JSON.parse(message)
            debugCommand('Parsed Tuya JSON command: ' + JSON.stringify(command))
            this.set(command)
        } else {
            debugCommand('DPS command topic requires Tuya style JSON value')
        }
    }

    // Process text based Tuya commands via DPS key command topics
    processDpsKeyCommand(message, dpsKey) {
        if (utils.isJsonString(message)) {
            debugCommand('Individual DPS command topics do not accept JSON values')
        } else {
            const dpsMessage = this.parseDpsMessage(message)
            debugCommand('Received command for DPS' + dpsKey + ': ', message)
            const command = {
                dps: dpsKey,
                set: dpsMessage
            }
            this.set(command)
        }
    }

    // Parse string message into boolean and number types
    parseDpsMessage(message) {
        if (typeof message === 'boolean') {
            return message;
        } else if (message === 'true' || message === 'false') {
            return (message === 'true') ? true : false
        } else if (!isNaN(message)) {
            return Number(message)
        } else {
            return message
        }
    }

    // Set state based on command topic
    sendTuyaCommand(message, deviceTopic) {
        let command = message.toLowerCase()
        const tuyaCommand = new Object()
        tuyaCommand.dps = deviceTopic.key
        switch (deviceTopic.type) {
            case 'bool':
                if (command === 'toggle') {
                    // Toggle requires a known current state
                    tuyaCommand.set = this.dps[tuyaCommand.dps] ? !this.dps[tuyaCommand.dps].val : '!!!INVALID!!!'
                } else {
                    command = this.parseBoolCommand(command)
                    if (typeof command.set === 'boolean') {
                        tuyaCommand.set = command.set
                    } else {
                        tuyaCommand.set = '!!!INVALID!!!'
                    }
                }
                break;
            case 'int':
            case 'float':
                tuyaCommand.set = this.parseNumberCommand(command, deviceTopic)
                break;
            case 'hsb':
                this.updateCommandColor(command, deviceTopic.components)
                tuyaCommand.set = this.parseTuyaHsbColor()
                break;
            case 'hsbhex':
                this.updateCommandColor(command, deviceTopic.components)
                tuyaCommand.set = this.parseTuyaHsbHexColor()
                break;
            case 'rgbToHsb':
                command = this.rgbToHsb(command)
                debug('converted to hsb', command)
                this.updateCommandColor(command, deviceTopic.components)
                tuyaCommand.set = this.parseTuyaHsbColor()
                break;
            default:
                // If type is not one of the above just use the raw string as is
                tuyaCommand.set = message
        }
        if (tuyaCommand.set === '!!!INVALID!!!') {
            return false
        } else {
            if (this.isRgbtwLight) {
                this.setLight(deviceTopic, tuyaCommand)
            } else {
                this.set(tuyaCommand)
            }
            return true
        }
    }

    rgbToHsb(rgb) {
        // Remove any leading "#" if present
        rgb = rgb.replace(/^#/, '')

        // Parse the hex string into RGB components
        const r = parseInt(rgb.substring(0, 2), 16) / 255
        const g = parseInt(rgb.substring(2, 4), 16) / 255
        const b = parseInt(rgb.substring(4, 6), 16) / 255
        const v = Math.max(r, g, b)
        const n = v - Math.min(r, g, b)

        const h =
            n === 0
                ? 0
                : n && v === r
                    ? (g - b) / n
                    : v === g
                        ? 2 + (b - r) / n
                        : 4 + (r - g) / n

        const hue = Math.round(60 * (h < 0 ? h + 6 : h))
        const saturation = Math.round(v && (n / v) * 100)
        const brightness = Math.round(v * 100)
        return hue + ',' + saturation + ',' + brightness
    }

    // Convert simple bool commands to true/false
    parseBoolCommand(command) {
        switch (command) {
            case 'on':
            case 'off':
            case '0':
            case '1':
            case 'true':
            case 'false':
                return {
                    set: (command === 'on' || command === '1' || command === 'true' || command === 1) ? true : false
                }
            default:
                return command
        }
    }

    // Validate/transform set interger values 
    parseNumberCommand(command, deviceTopic) {
        let value = undefined
        const invalid = '!!!INVALID!!!'

        // Check if it's a number and it's not outside of defined range
        if (isNaN(command)) {
            return invalid
        } else if (deviceTopic.hasOwnProperty('topicMin') && command < deviceTopic.topicMin) {
            debugError('Received command value "' + command + '" that is less than the configured minimum value')
            debugError('Overriding command with minimum value ' + deviceTopic.topicMin)
            command = deviceTopic.topicMin
        } else if (deviceTopic.hasOwnProperty('topicMax') && command > deviceTopic.topicMax) {
            debugError('Received command value "' + command + '" that is greater than the configured maximum value')
            debugError('Overriding command with maximum value: ' + deviceTopic.topicMax)
            command = deviceTopic.topicMax
        }

        // Perform any required math transforms before returing command value
        switch (deviceTopic.type) {
            case 'int':
                if (deviceTopic.commandMath) {
                    value = parseInt(Math.round(evaluate(command + deviceTopic.commandMath)))
                } else {
                    value = parseInt(command)
                }
                break;
            case 'float':
                if (deviceTopic.commandMath) {
                    value = parseFloat(evaluate(command + deviceTopic.commandMath))
                } else {
                    value = parseFloat(command)
                }
                break;
        }

        return value
    }

    // Takes Tuya color value in HSB or HSBHEX format and updates cached HSB color state for device
    // Credit homebridge-tuya project for HSB/HSBHEX conversion code
    updateColorState(value) {
        let h, s, b
        if (this.config.colorType === 'hsbhex') {
            [, h, s, b] = (value || '0000000000ffff').match(/^.{6}([0-9a-f]{4})([0-9a-f]{2})([0-9a-f]{2})$/i) || [0, '0', 'ff', 'ff'];
            this.color.h = parseInt(h, 16)
            this.color.s = Math.round(parseInt(s, 16) / 2.55) // Convert saturation to 100 scale
            this.color.b = Math.round(parseInt(b, 16) / 2.55) // Convert brightness to 100 scale
        } else {
            [, h, s, b] = (value || '000003e803e8').match(/^([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})$/i) || [0, '0', '3e8', '3e8']
            // Convert from Hex to Decimal and cache values
            this.color.h = parseInt(h, 16)
            this.color.s = Math.round(parseInt(s, 16) / 10)   // Convert saturation to 100 Scale
            this.color.b = Math.round(parseInt(b, 16) / 10)   // Convert brightness to 100 scale
        }

        // Initialize the command color values with existing color state
        if (!this.hasOwnProperty('cmdColor')) {
            this.cmdColor = {
                'h': this.color.h,
                's': this.color.s,
                'b': this.color.b
            }
        }
    }

    // Caches color updates when HSB components have separate device topics
    // cmdColor property always contains the desired HSB color state based on received 
    // command topic messages vs actual device color state, which may be pending
    updateCommandColor(value, components) {
        // Without a received color state yet, start from the cached (default) color
        if (!this.cmdColor) {
            this.cmdColor = { 'h': this.color.h, 's': this.color.s, 'b': this.color.b }
        }
        // Update any HSB component with a changed value
        components = components.split(',')
        const values = value.split(',')
        for (let i in components) {
            this.cmdColor[components[i]] = Math.round(values[i])
        }
    }

    // Returns Tuya HSB format value from current cmdColor HSB values
    // Credit homebridge-tuya project for HSB conversion code
    parseTuyaHsbColor() {
        let { h, s, b } = this.cmdColor
        const hexColor = h.toString(16).padStart(4, '0') + (10 * s).toString(16).padStart(4, '0') + (10 * b).toString(16).padStart(4, '0')
        return hexColor
    }

    // Returns Tuya HSBHEX format value from current cmdColor HSB values
    // Credit homebridge-tuya project for HSBHEX conversion code
    parseTuyaHsbHexColor() {
        let { h, s, b } = this.cmdColor
        const hsb = h.toString(16).padStart(4, '0') + Math.round(2.55 * s).toString(16).padStart(2, '0') + Math.round(2.55 * b).toString(16).padStart(2, '0');
        h /= 60;
        s /= 100;
        b *= 2.55;
        const
            i = Math.floor(h),
            f = h - i,
            p = b * (1 - s),
            q = b * (1 - s * f),
            t = b * (1 - s * (1 - f)),
            rgb = (() => {
                switch (i % 6) {
                    case 0:
                        return [b, t, p];
                    case 1:
                        return [q, b, p];
                    case 2:
                        return [p, b, t];
                    case 3:
                        return [p, q, b];
                    case 4:
                        return [t, p, b];
                    case 5:
                        return [b, p, q];
                }
            })().map(c => Math.round(c).toString(16).padStart(2, '0')),
            hex = rgb.join('');

        return hex + hsb;
    }

    // Set white/colour mode based on received commands
    async setLight(topic, command) {
        let targetMode = undefined

        if (topic.key === this.config.dpsWhiteValue || topic.key === this.config.dpsColorTemp) {
            // If setting white level or color temperature, light should be in white mode
            targetMode = 'white'
        } else if (topic.key === this.config.dpsColor) {
            // Split device topic HSB components into array
            const components = topic.components.split(',')

            // If device topic inlucdes saturation check for changes
            if (components.includes('s')) {
                if (this.cmdColor.s < 10) {
                    // Saturation changed to < 10% = white mode
                    targetMode = 'white'
                } else {
                    // Saturation changed to >= 10% = color mode
                    targetMode = 'colour'
                }
            } else {
                // For other cases stay in existing mode
                targetMode = this.dps[this.config.dpsMode].val
            }
        }

        // Send the issued command
        this.set(command)

        // Make sure the bulb stays in the correct mode
        if (targetMode) {
            command = {
                dps: this.config.dpsMode,
                set: targetMode
            }
            this.set(command)
        }
    }

    // Simple function to help debug output 
    toString() {
        // Never log the local key
        return this.config.name + ' (' + (this.options.ip ? this.options.ip + ', ' : '') + this.options.id + ')'
    }

    set(command) {
        debug('Set device ' + this.options.id + ' -> ' + JSON.stringify(command))
        return this.device.set(command).catch((error) => {
            debugError('Set device ' + this.options.id + ' failed: ' + (error && error.message ? error.message : error))
        })
    }

    // Search for and connect to device, retry until connected (only one attempt loop at a time)
    async connectDevice(delay = 0) {
        if (this.connecting || this.stopped) return
        this.connecting = true
        try {
            if (delay) {
                debugError('Connection to device id ' + this.options.id + ' lost...retry in ' + delay + ' seconds.')
                await utils.sleep(delay)
            }
            while (!this.stopped && !this.device.isConnected()) {
                debug('Search for device id ' + this.options.id)
                try {
                    await this.device.find()
                } catch (error) {
                    debugError(error.message)
                    debugError('Will attempt to find device again in 60 seconds')
                    await utils.sleep(60)
                    continue
                }
                debug('Found device id ' + this.options.id)
                try {
                    await this.connectWithTimeout()
                } catch (error) {
                    debugError(error.message)
                    this.resetConnection()
                    debugError('Error connecting to device id ' + this.options.id + '...retry in 10 seconds.')
                    await utils.sleep(10)
                }
            }
        } finally {
            this.connecting = false
        }
    }

    // Reconnect after a short delay to give the device time to release the old session
    reconnect() {
        return this.connectDevice(10)
    }

    // TuyAPI's connect promise can stay pending forever, e.g. if the device closes the socket
    // during the 3.4/3.5 session key negotiation (the socket timeout is already cleared then)
    connectWithTimeout() {
        let timer
        const timeout = new Promise((resolve, reject) => {
            timer = setTimeout(() => reject(new Error('Connection to device id ' + this.options.id + ' timed out')), CONNECT_TIMEOUT * 1000)
        })
        return Promise.race([this.device.connect(), timeout]).finally(() => clearTimeout(timer))
    }

    // Drop a stale socket and pending connect promise, otherwise TuyAPI keeps returning the dead promise
    resetConnection() {
        if (this.device.isConnected()) return
        if (this.device.client) {
            this.device.client.destroy()
        }
        delete this.device.connectPromise
    }

    // Stop reconnecting and disconnect from the device (used on shutdown)
    stop() {
        this.stopped = true
        clearInterval(this.heartbeatInterval)
        if (this.device.isConnected()) {
            // Emits 'disconnected', which publishes the offline status
            this.device.disconnect()
        } else {
            this.publishStatus('offline')
        }
    }

    // Run device specific init, a failing device query must not crash the whole bridge
    runInit() {
        Promise.resolve()
            .then(() => this.init())
            .catch((error) => debugError('Init of device id ' + this.options.id + ' failed: ' + (error && error.message ? error.message : error)))
    }

    // Simple function to monitor heartbeats to determine if 
    monitorHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (!this.device.isConnected()) {
                // Watchdog: never stay offline without an active reconnect loop
                if (!this.connecting) {
                    this.reconnect()
                }
                return
            }
            if (this.connected) {
                if (this.heartbeatsMissed > 3) {
                    debugError('Device id ' + this.options.id + ' not responding to heartbeats...disconnecting')
                    this.heartbeatsMissed = 0
                    // Emits 'disconnected', which triggers the reconnect
                    this.device.disconnect()
                    return
                } else if (this.heartbeatsMissed > 0) {
                    const errMessage = this.heartbeatsMissed > 1 ? " heartbeats" : " heartbeat"
                    debugError('Device id ' + this.options.id + ' has missed ' + this.heartbeatsMissed + errMessage)
                }
                this.heartbeatsMissed++
            }
        }, 10000)
    }

    // Publish device online/offline status, always retained so late subscribers get the current status
    publishStatus(status) {
        this.publishMqtt(this.baseTopic + 'status', status, false, true)
    }

    // Publish MQTT (qos and retain from config.json unless retain is given explicitly)
    publishMqtt(topic, message, isDebug, retain = this.retain) {
        if (isDebug) { debugState(topic, message) }
        this.mqttClient.publish(topic, message, { qos: this.qos, retain: retain });
    }
}

module.exports = TuyaDevice
