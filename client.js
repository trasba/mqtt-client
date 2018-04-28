#!/usr/bin/env node
'use strict';

// require
var events = require('events');
var fs = require('fs');
const bunyan = require('bunyan'); //for logging
const os = require('os');
const mqtt = require('mqtt')
const network = require('network');

var eventEmitter = new events.EventEmitter();
var log = bunyan.createLogger({ name: 'mqtt-client' });
var flags = { 'verbose': 'error' };
var config = {};
var client, strTopic, hostname;

//handle bunyan loglevel default = error, -v = warn, -vv = info, -vvv = trace
flags.verbose = process.argv.find(function (element) {
    return element.startsWith('-v') ;
});
switch (flags.verbose) {
    case '-v':
        log.level('warn');
        break;
    case '-vv':
        log.level('info');
        break;
    case '-vvv':
        log.level('trace');
        break;
    default:
        log.level('error');
}

function main1() {
    log.error('test');
}

eventEmitter.addListener('config-loaded', main);

//include config.json haven't found a better way to do it

fs.readFile('./config.json', 'utf8', function (err, data) {
    if (err) {
        log.error('error in config file -> terminating');
        log.trace(err);
        process.exit();
    }
    data = data.replace(/^\uFEFF/, ''); //handle BOM in json
    config = JSON.parse(data);
    log.info('config file loaded');
    eventEmitter.emit('config-loaded');
});

function getpublicIP() {
    network.get_public_ip(function (err, ip) {
        log.info(err || "public IP is : " + ip); // should return your public IP address
        client.publish(strTopic + '/ip_public', ip, { retain: true })
    })
}

function getlocalIP() {
    network.get_active_interface(function (err, obj) {
        log.info(err || "private ip is: " + obj['ip_address']);
        client.publish(strTopic + '/ip_private', obj['ip_address'], { retain: true })
        /* obj should be:

        { name: 'eth0',
          ip_address: '10.0.1.3',
          mac_address: '56:e5:f9:e4:38:1d',
          type: 'Wired',
          netmask: '255.255.255.0',
          gateway_ip: '10.0.1.1' }

        */
    })
}

function main() {

    hostname = os.hostname();
    //var topic_head = 'fleet';
    strTopic = config.topic_head + '/' + hostname;

    try {
        client = mqtt.connect(config.mqttserver, { username: config.mqtt_username, password: config.mqtt_password, keepalive: 60, will: { topic: strTopic + '/conn', payload: 'false', retain: true } })
    }
    catch (err) {
        log.error('error while connecting to server ' + config.mqttserver + ' -> terminating');
        log.trace(err);
        process.exit();
    }

    client.on('connect', () => {
        log.info("connected to server")
        client.publish(strTopic + '/conn', 'true', { retain: true })
        client.subscribe(strTopic + '/conn')
        getlocalIP()
        getpublicIP()
    })     
}
