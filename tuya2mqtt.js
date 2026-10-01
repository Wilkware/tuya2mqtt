#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const mqtt = require('mqtt')
const json5 = require('json5')
const debugInfo = require('debug')('tuya2mqtt:info')
const debugCommand = require('debug')('tuya2mqtt:command')
const debugError = require('debug')('tuya2mqtt:error')
const GenericDevice = require('./devices/generic-device')
const RGBTWLight = require('./devices/rgbtw-light')
const SimpleSwitch = require('./devices/simple-switch')
const SimpleDimmer = require('./devices/simple-dimmer')
const CeilingFan = require('./devices/ceiling-fan')
const VacuumCleaner = require('./devices/vacuum-cleaner')
const Dehumidifier = require('./devices/dehumidifier')

var CONFIG = undefined
// Directory with config.json and devices.conf (defaults to the application directory)
const CONFIG_DIR = process.env.CONFIG_DIR || __dirname
var tuyaDevices = new Array()

var mqttClient = undefined
var shuttingDown = false

// Setup Exit Handlers
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('uncaughtException', (error) => {
    console.error(error)
    debugError(error)
    shutdown(1)
})

// Topic for the online/offline status of the bridge itself (also used as MQTT last will)
function bridgeStatusTopic() {
    return CONFIG.topic + 'bridge/status'
}

// Disconnect from all devices, publish offline status and exit
function shutdown(exitCode) {
    if (shuttingDown) return
    shuttingDown = true
    debugInfo('Shutting down, exit code: ' + exitCode)
    for (let tuyaDevice of tuyaDevices) {
        tuyaDevice.stop()
    }
    // Exit even if the broker does not acknowledge the last messages
    setTimeout(() => process.exit(exitCode), 2000).unref()
    if (mqttClient && mqttClient.connected) {
        mqttClient.publish(bridgeStatusTopic(), 'offline', { qos: 1, retain: true }, () => {
            mqttClient.end(false, () => process.exit(exitCode))
        })
    } else {
        process.exit(exitCode)
    }
}

// Get new deivce based on configured type
function getDevice(configDevice, mqttClient) {
    const deviceInfo = {
        configDevice: configDevice,
        mqttClient: mqttClient,
        topic: CONFIG.topic,
        qos: CONFIG.qos,
        retain: CONFIG.retain
    }
    switch (configDevice.type) {
        case 'SimpleSwitch':
            return new SimpleSwitch(deviceInfo)
        case 'SimpleDimmer':
            return new SimpleDimmer(deviceInfo)
        case 'RGBTWLight':
            return new RGBTWLight(deviceInfo)
        case 'VacuumCleaner':
            return new VacuumCleaner(deviceInfo)
        case 'CeilingFan':
            return new CeilingFan(deviceInfo)
        case 'Dehumidifier':
            return new Dehumidifier(deviceInfo)
    }
    return new GenericDevice(deviceInfo)
}

// Initialisation of all defined devices
function initDevices(configDevices, mqttClient) {
    for (let configDevice of configDevices) {
        const newDevice = getDevice(configDevice, mqttClient)
        tuyaDevices.push(newDevice)
    }
}

// Main code function
const main = async () => {
    let configDevices

    try {
        CONFIG = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'config.json'), 'utf8'))
    } catch (e) {
        console.error('Configuration file ' + path.join(CONFIG_DIR, 'config.json') + ' not found or invalid!')
        debugError(e)
        process.exit(1)
    }

    if (typeof CONFIG.qos == 'undefined') {
        CONFIG.qos = 1
    }
    if (typeof CONFIG.retain == 'undefined') {
        CONFIG.retain = false
    }
    if (typeof CONFIG.topic != 'string' || !CONFIG.topic) {
        CONFIG.topic = 'tuya2mqtt/'
    }
    if (!CONFIG.topic.endsWith('/')) {
        CONFIG.topic += '/'
    }

    try {
        configDevices = fs.readFileSync(path.join(CONFIG_DIR, 'devices.conf'), 'utf8')
        configDevices = json5.parse(configDevices)
    } catch (e) {
        console.error('Devices file ' + path.join(CONFIG_DIR, 'devices.conf') + ' not found or invalid!')
        debugError(e)
        process.exit(1)
    }

    if (!configDevices.length) {
        console.error('No devices found in devices file!')
        process.exit(1)
    }

    mqttClient = mqtt.connect({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.mqtt_user,
        password: CONFIG.mqtt_pass,
        will: {
            topic: bridgeStatusTopic(),
            payload: 'offline',
            qos: 1,
            retain: true
        }
    })

    mqttClient.on('connect', function (err) {
        debugInfo('Connection established to MQTT server')
        mqttClient.publish(bridgeStatusTopic(), 'online', { qos: 1, retain: true })
        // Only subscribe to command topics, not to the state topics published by tuya2mqtt itself
        mqttClient.subscribe([
            CONFIG.topic + '+/command',
            CONFIG.topic + '+/+/command',
            CONFIG.topic + '+/dps/+/command'
        ])
        // Devices keep running across MQTT reconnects, so only create them once
        if (!tuyaDevices.length) {
            initDevices(configDevices, mqttClient)
        }
    })

    mqttClient.on('reconnect', function (error) {
        if (mqttClient.connected) {
            debugInfo('Connection to MQTT server lost. Attempting to reconnect...')
        } else {
            debugInfo('Unable to connect to MQTT server')
        }
    })

    mqttClient.on('error', function (error) {
        debugInfo('Unable to connect to MQTT server', error)
    })

    mqttClient.on('message', function (topic, message) {
        try {
            message = message.toString()
            if (!topic.startsWith(CONFIG.topic)) return
            // Topic levels below the configured base topic, e.g. [device, dps, 1, command]
            const levels = topic.slice(CONFIG.topic.length).split('/')
            if (levels[levels.length - 1] !== 'command') {
                debugError('Only command messages allowed!!!')
                return
            }

            debugInfo('Received MQTT message -> ', JSON.stringify({
                topic: topic,
                message: message
            }))

            // Use device topic level to find matching device
            const deviceLevel = levels[0]
            const device = tuyaDevices.find(d => d.options.name === deviceLevel || d.options.id === deviceLevel)
            if (!device) {
                debugError('No device found for topic ' + topic)
                return
            }

            switch (levels.length) {
                case 2:
                    debugCommand('processCommand -> ' + message)
                    device.processCommand(message)
                    break;
                case 3:
                    if (levels[1].toLowerCase() !== 'dps') {
                        debugCommand('processDeviceCommand -> ' + levels[1])
                        device.processDeviceCommand(message, levels[1])
                    } else {
                        debugCommand('processDpsCommand -> ' + message)
                        device.processDpsCommand(message)
                    }
                    break;
                case 4:
                    if (levels[1].toLowerCase() === 'dps') {
                        debugCommand('processDpsKeyCommand - DPS Key = ' + levels[2])
                        device.processDpsKeyCommand(message, levels[2])
                    }
                    break;
            }
        } catch (e) {
            debugError(e)
        }
    })
}

// Call the main code
main()
