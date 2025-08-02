#!/usr/bin/env node
const fs = require('fs')
const mqtt = require('mqtt')
const json5 = require('json5')
const debugInfo = require('debug')('tuya2mqtt:info')
const debugCommand = require('debug')('tuya2mqtt:command')
const debugError = require('debug')('tuya2mqtt:error')
const SimpleSwitch = require('./devices/simple-switch')
const SimpleDimmer = require('./devices/simple-dimmer')
const RGBTWLight = require('./devices/rgbtw-light')
const VacuumCleaner = require('./devices/vacuum-cleaner')
const CeilingFan = require('./devices/ceiling-fan')
const GenericDevice = require('./devices/generic-device')
const utils = require('./lib/utils')

var CONFIG = undefined
var tuyaDevices = new Array()

// Setup Exit Handlers
process.on('exit', processExit.bind(0))
process.on('SIGINT', processExit.bind(0))
process.on('SIGTERM', processExit.bind(0))
process.on('uncaughtException', processExit.bind(1))

// Disconnect from and publish offline status for all devices on exit
async function processExit(exitCode) {
    for (let tuyaDevice of tuyaDevices) {
        tuyaDevice.device.disconnect()
    }
    if (exitCode || exitCode === 0) debugInfo('Exit code: ' + exitCode)
    await utils.sleep(1)
    process.exit()
}

// Get new deivce based on configured type
function getDevice(configDevice, mqttClient) {
    const deviceInfo = {
        configDevice: configDevice,
        mqttClient: mqttClient,
        topic: CONFIG.topic
    }
    switch (configDevice.type) {
        case 'SimpleSwitch':
            return new SimpleSwitch(deviceInfo)
            break;
        case 'SimpleDimmer':
            return new SimpleDimmer(deviceInfo)
            break;
        case 'RGBTWLight':
            return new RGBTWLight(deviceInfo)
            break;
        case 'VacuumCleaner':
            return new VacuumCleaner(deviceInfo)
            break;
        case 'CeilingFan':
            return new CeilingFan(deviceInfo)
            break;
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
    let mqttClient

    try {
        CONFIG = require('./config')
    } catch (e) {
        console.error('Configuration file not found!')
        debugError(e)
        process.exit(1)
    }

    if (typeof CONFIG.qos == 'undefined') {
        CONFIG.qos = 1
    }
    if (typeof CONFIG.retain == 'undefined') {
        CONFIG.retain = false
    }

    try {
        configDevices = fs.readFileSync('./devices.conf', 'utf8')
        configDevices = json5.parse(configDevices)
    } catch (e) {
        console.error('Devices file not found!')
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
    })

    mqttClient.on('connect', function (err) {
        debugInfo('Connection established to MQTT server')
        let topic = CONFIG.topic + '#'
        mqttClient.subscribe(topic)
        initDevices(configDevices, mqttClient)
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
            const splitTopic = topic.split('/')
            const topicLength = splitTopic.length
            const commandTopic = splitTopic[topicLength - 1]
            const deviceLevel = splitTopic[1]

            // Check, if it a valid command topic try to process it
            if (commandTopic === 'command') {
                debugInfo('Received MQTT message -> ', JSON.stringify({
                    topic: topic,
                    message: message
                }))

                // Use device topic level to find matching device
                const device = tuyaDevices.find(d => d.options.name === deviceLevel || d.options.id === deviceLevel)
                switch (topicLength) {
                    case 3:
                        debugCommand('3:processCommand -> ' + message)
                        device.processCommand(message)
                        break;
                    case 4:
                        const deviceTopic = splitTopic[topicLength - 2]
                        if(deviceTopic.toLowerCase() !== 'dps') {
                            debugCommand('4:processDeviceCommand -> ' + deviceTopic)
                            device.processDeviceCommand(message, deviceTopic)
                        } else {
                            debugCommand('4:processDpsCommand ->' + message)
                            device.processDpsCommand(message)
                        }
                        break;
                    case 5:
                        const dpsKey = splitTopic[topicLength - 2]
                        debugCommand('5:processDpsKeyCommand - DPS Key = ' + dpsKey)
                        device.processDpsKeyCommand(message, dpsKey)
                        break;
                }
            } else {
                debugError('Only command messages allowed!!!')
            }
        } catch (e) {
            debugError(e)
        }
    })
}

// Call the main code
main()
