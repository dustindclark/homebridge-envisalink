var net = require("net");
var nap = require('nodealarmproxy');
var elink = require('nodealarmproxy/envisalink.js');
var dateFormat = require('dateformat');
var Service, Characteristic, Accessory;
var inherits = require('util').inherits;
var enableSet = true;

/* Register the plugin with homebridge */
module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.hap.Accessory;
    uuid = homebridge.hap.uuid;

    var acc = EnvisalinkAccessory.prototype;
    inherits(EnvisalinkAccessory, Accessory);
    EnvisalinkAccessory.prototype.parent = Accessory.prototype;
    for (var mn in acc) {
        EnvisalinkAccessory.prototype[mn] = acc[mn];
    }

    homebridge.registerPlatform("homebridge-envisalink", "Envisalink", EnvisalinkPlatform);
}

function EnvisalinkPlatform(log, config) {
    this.log = log;
    this.deviceType = config.deviceType;
    this.pin = config.pin;
    this.password = config.password;
    this.partitions = config.partitions;
    this.zones = config.zones;
    this.userPrograms = config.userPrograms;

    this.log("Configuring Envisalink platform,  Host: " + config.host + ", port: " + config.port + ", type: " + this.deviceType);
    this.log("Starting node alarm proxy...");
    this.alarmConfig = {
        password: config.password,
        serverpassword: config.password,
        actualhost: config.host,
        actualport: config.port,
        serverhost: '0.0.0.0',
        serverport: config.serverport ? config.serverport : 4026,
        zone: this.zones && this.zones.length > 0 ? this.zones.length : null,
        userPrograms: this.userPrograms && this.userPrograms.length > 0 ? this.userPrograms.length : null,
        partition: this.partitions ? this.partitions.length : 1,
        proxyenable: true,
        atomicEvents: true
    };
    this.log("Zones: " + this.alarmConfig.zone);
    this.log("User Programs: " + this.alarmConfig.userPrograms);
    this.alarm = nap.initConfig(this.alarmConfig);
    this.log("Node alarm proxy started.  Listening for connections at: " + this.alarmConfig.serverhost + ":" + this.alarmConfig.serverport);
    this.alarm.on('data', this.systemUpdate.bind(this));
    this.alarm.on('zoneupdate', this.zoneUpdate.bind(this));
    this.alarm.on('partitionupdate', this.partitionUpdate.bind(this));
    this.alarm.on('partitionuserupdate', this.partitionUserUpdate.bind(this));
    this.alarm.on('systemupdate', this.systemUpdate.bind(this));

    this.platformPartitionAccessories = [];
    for (var i = 0; i < this.partitions.length; i++) {
        var partition = this.partitions[i];
        partition.pin = config.pin;
        var accessory = new EnvisalinkAccessory(this.log, "partition", partition, i + 1);
        this.platformPartitionAccessories.push(accessory);
    }
    this.platformZoneAccessories = [];
    this.platformZoneAccessoryMap = {};
    var maxZone = 0;
    if (!config.suppressZoneAccessories) {
        for (var i = 0; i < this.zones.length; i++) {
            var zone = this.zones[i];
            if (zone.type == "motion" || zone.type == "window" || zone.type == "door" || zone.type == "leak" || zone.type == "smoke") {
                var zoneNum = zone.zoneNumber ? zone.zoneNumber : (i + 1);
                if (zoneNum > maxZone) {
                    maxZone = zoneNum;
                }
                var accessory = new EnvisalinkAccessory(this.log, zone.type, zone, zone.partition, zoneNum);
                var accessoryIndex = this.platformZoneAccessories.push(accessory) - 1;
                this.platformZoneAccessoryMap['z.' + zoneNum] = accessoryIndex;
            } else {
                this.log("Unhandled accessory type: " + zone.type);
            }
        }
    }
    this.platformProgramAccessories = [];
    for (var i = 0; i < this.userPrograms.length; i++) {
        var program = this.userPrograms[i];
        if (program.type === "smoke") {
            var accessory = new EnvisalinkAccessory(this.log, program.type, program, program.partition, maxZone + i + 1);
            this.platformProgramAccessories.push(accessory);
        } else {
            this.log("Unhandled accessory type: " + program.type);
        }
    }

    if (!config.suppressClockReset) {
        var nextSetTime = function() {
            this.platformPartitionAccessories[0].addDelayedEvent('time');
            setTimeout(nextSetTime.bind(this), 60 * 60 * 1000);
        }
    
        setTimeout(nextSetTime.bind(this), 5000);
    }
}

EnvisalinkPlatform.prototype.partitionUserUpdate = function (users) {
    this.log('Partition User Update changed to: ', users);
}

EnvisalinkPlatform.prototype.systemUpdate = function (data) {
    this.log('System status changed to: ', data);

    var systemStatus = data.system;
    if (!systemStatus) {
        systemStatus = data;
    }

    if (systemStatus) {
        for (var i = 0; i < this.platformProgramAccessories.length; i++) {
            var programAccessory = this.platformProgramAccessories[i];
            var accservice = (programAccessory.getServices())[0];
            if (accservice) {
                var code = systemStatus.code && systemStatus.code.substring(0, 3);
                if (programAccessory.accessoryType === 'smoke' && code === '631') {
                    accservice.getCharacteristic(Characteristic.SmokeDetected).setValue(Characteristic.SmokeDetected.SMOKE_DETECTED);

                    var partition = this.platformPartitionAccessories[parseInt(programAccessory.partition) - 1];
                    var partitionService = partition && (partition.getServices())[0];
                    partitionService && partitionService.getCharacteristic(Characteristic.SecuritySystemTargetState).getValue(function (context, value) {
                        partitionService.getCharacteristic(Characteristic.SecuritySystemTargetState).setValue(Characteristic.SecuritySystemTargetState.STAY_ARM);
                        partition.currentState = value;
                    });
                } else if (programAccessory.accessoryType === 'smoke' && code === '632') {
                    accservice.getCharacteristic(Characteristic.SmokeDetected).setValue(Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
                    var partition = this.platformPartitionAccessories[parseInt(programAccessory.partition) - 1];
                    var partitionService = partition && (partition.getServices())[0];
                    if (partition && partition.currentState !== undefined) {
                        partitionService && partitionService.getCharacteristic(Characteristic.SecuritySystemTargetState).setValue(partition.currentState);
                        delete partition.currentState;
                    }
                }
            }
        }
    }
    if (data.partition) {
        for (var i = 0; i < this.platformPartitionAccessories.length; i++) {
            var partitionAccessory = this.platformPartitionAccessories[i];
            var systemStatus = data.partition['' + (i + 1)];
            if (systemStatus) {
                var code = systemStatus.code.substring(0, 3);
                partitionAccessory.systemStatus = elink.tpicommands[code];
                partitionAccessory.systemStatus.code = code;
                console.log("Set system status on accessory " + partitionAccessory.name + ' to ' + JSON.stringify(partitionAccessory.systemStatus));
            }
        }
    }
}

EnvisalinkPlatform.prototype.zoneUpdate = function (data) {
    var accessoryIndex = this.platformZoneAccessoryMap['z.' + data.zone];
    if (accessoryIndex !== undefined) {
        var accessory = this.platformZoneAccessories[accessoryIndex];
        if (accessory) {
            accessory.status = elink.tpicommands[data.code];
            accessory.status.code = data.code;
            accessory.status.mode = data.mode;
            console.log("Set status on accessory " + accessory.name + ' to ' + JSON.stringify(accessory.status));

            var accservice = (accessory.getServices())[0];

            if (accservice) {
                if (accessory.accessoryType == "motion") {

                    accessory.getMotionStatus(function (nothing, resultat) {
                        accservice.getCharacteristic(Characteristic.MotionDetected).setValue(resultat);
                    });

                } else if (accessory.accessoryType == "door" || accessory.accessoryType == "window") {

                    accessory.getContactSensorState(function (nothing, resultat) {
                        accservice.getCharacteristic(Characteristic.ContactSensorState).setValue(resultat);
                    });

                } else if (accessory.accessoryType == "leak") {

                    accessory.getLeakStatus(function (nothing, resultat) {
                        accservice.getCharacteristic(Characteristic.LeakDetected).setValue(resultat);
                    });

                } else if (accessory.accessoryType == "smoke") {

                    accessory.getSmokeStatus(function (nothing, resultat) {
                        accservice.getCharacteristic(Characteristic.SmokeDetected).setValue(resultat);
                    });

                }
            }
        }
    }
}

EnvisalinkPlatform.prototype.partitionUpdate = function (data) {
    var watchevents = ['601', '602', '609', '610', '650', '651', '652', '654', '656', '657'];
    if (data.code == "652") {
        //0: AWAY, 1: STAY, 2:  ZERO-ENTRY-AWAY, 3:  ZERO-ENTRY-STAY
        if (data.mode == '1' || data.mode == "3") {
            this.awayStay = Characteristic.SecuritySystemCurrentState.STAY_ARM;
        } else {
            this.awayStay = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
        }
    }

    var partition = this.platformPartitionAccessories[data.partition - 1];
    if (partition) {
        partition.status = elink.tpicommands[data.code];
        partition.status.code = data.code;
        partition.status.mode = data.mode;
        partition.status.partition = data.partition;

        var accservice = (partition.getServices())[0];
        var accstatus;

        if (accservice) {
            if (data.code == "656") { //exit delay
                enableSet = false;
                var armMode = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
                if (partition.lastTargetState != null) {
                    armMode = partition.lastTargetState;
                }
                partition.lastTargetState = null;
                accservice.getCharacteristic(Characteristic.SecuritySystemTargetState).setValue(armMode);
                enableSet = true;
            } else if (data.code == "657") { //entry-delay
            } else if (data.code == "652" || data.code == "654" || data.code == "655") { //Armed, Alarm, Disarmed
                partition.getAlarmState(function (nothing, resultat) {

                    if (partition.currentState !== undefined) {
                        delete partition.currentState;
                    }

                    partition.lastTargetState = null;
                    enableSet = false;
                    accservice.getCharacteristic(Characteristic.SecuritySystemTargetState).setValue(resultat);
                    enableSet = true;
                    accservice.getCharacteristic(Characteristic.SecuritySystemCurrentState).setValue(resultat);
                });
            } else if (data.code == "626" || data.code == "650" || data.code == "651" || data.code == "653") { //Ready, Not Ready, Ready Force ARM
                partition.getReadyState(function (nothing, resultat) {
                    console.log('Setting Obstructed', resultat);
                    accservice.getCharacteristic(Characteristic.ObstructionDetected).setValue(resultat);
                });
            }
        }
    }
}

EnvisalinkPlatform.prototype.accessories = function (callback) {
    callback(this.platformPartitionAccessories.concat(this.platformZoneAccessories).concat(this.platformProgramAccessories));
}

function EnvisalinkAccessory(log, accessoryType, config, partition, zone) {
    this.log = log;
    this.name = config.name;
    var id = 'envisalink.' + partition;
    if (zone) {
        id += "." + zone;
    }
    this.uuid_base = uuid.generate(id);
    Accessory.call(this, this.name, this.uuid_base);

    this.accessoryType = accessoryType;
    this.partition = partition;
    this.pin = config.pin;
    this.zone = zone;
    this.status = null;

    this.services = [];
    if (this.accessoryType == "partition") {
        var service = new Service.SecuritySystem(this.name);
        service
            .getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .on('get', this.getAlarmState.bind(this));
        service
            .getCharacteristic(Characteristic.SecuritySystemTargetState)
            .on('get', this.getAlarmState.bind(this))
            .on('set', this.setAlarmState.bind(this));
        service
            .addCharacteristic(Characteristic.ObstructionDetected)
            .on('get', this.getReadyState.bind(this));
        this.services.push(service);
    } else if (this.accessoryType == "motion") {
        var service = new Service.MotionSensor(this.name);
        service
            .getCharacteristic(Characteristic.MotionDetected)
            .on('get', this.getMotionStatus.bind(this));
        this.services.push(service);
    } else if (this.accessoryType == "door") {
        var service = new Service.ContactSensor(this.name);
        service
            .getCharacteristic(Characteristic.ContactSensorState)
            .on('get', this.getContactSensorState.bind(this));
        this.services.push(service);
    } else if (this.accessoryType == "window") {
        var service = new Service.ContactSensor(this.name);
        service
            .getCharacteristic(Characteristic.ContactSensorState)
            .on('get', this.getContactSensorState.bind(this));
        this.services.push(service);
    } else if (this.accessoryType == "leak") {
        var service = new Service.LeakSensor(this.name);
        service
            .getCharacteristic(Characteristic.LeakDetected)
            .on('get', this.getLeakStatus.bind(this));
        this.services.push(service);
    } else if (this.accessoryType == "smoke") {
        var service = new Service.SmokeSensor(this.name);
        service
            .getCharacteristic(Characteristic.SmokeDetected)
            .on('get', this.getSmokeStatus.bind(this));
        this.services.push(service);
    }
}

EnvisalinkAccessory.prototype.getServices = function () {
    return this.services;
}

EnvisalinkAccessory.prototype.getMotionStatus = function (callback) {
    if (this.status && this.status.send == "open") {
        callback(null, true);
    } else {
        callback(null, false);
    }
}

EnvisalinkAccessory.prototype.getReadyState = function (callback) {
    var currentState = this.status;
    var status = true;
    if (currentState && currentState.bytes === this.partition) {
        if (currentState.send == "ready" || currentState.send == "readyforce") {
            status = false;
        }
    }
    callback(null, status);
}
EnvisalinkAccessory.prototype.getAlarmState = function (callback) {
    var currentState = this.status;
    var status = Characteristic.SecuritySystemCurrentState.DISARMED;

    if (currentState && currentState.bytes === this.partition) {
        //Default to disarmed

        if (currentState.send == "alarm") {
            status = Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
        } else if (currentState.send == "armed") {

            //0: AWAY, 1: STAY, 2:  ZERO-ENTRY-AWAY, 3:  ZERO-ENTRY-STAY

            if (currentState.mode === '1' || currentState.mode === '3') {
                status = Characteristic.SecuritySystemCurrentState.STAY_ARM;
            } else {
                status = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
            }

        } else if (currentState.send == "exitdelay" || currentState.send == "entrydelay") {
            //Use the target alarm state during the exit and entrance delays.
            status = this.lastTargetState;
        }
    }
    callback(null, status);
}

EnvisalinkAccessory.prototype.setAlarmState = function (state, callback) {
    this.addDelayedEvent('alarm', state, callback);
}

EnvisalinkAccessory.prototype.getContactSensorState = function (callback) {
    if (this.status && this.status.send == "open") {
        callback(null, Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    } else {
        callback(null, Characteristic.ContactSensorState.CONTACT_DETECTED);
    }
}

EnvisalinkAccessory.prototype.getLeakStatus = function (callback) {
    if (this.status && this.status.send == "open") {
        callback(null, Characteristic.LeakDetected.LEAK_DETECTED);
    } else {
        callback(null, Characteristic.LeakDetected.LEAK_NOT_DETECTED);
    }
}

EnvisalinkAccessory.prototype.getSmokeStatus = function (callback) {
    if (this.status && this.status.send == "open") {
        callback(null, Characteristic.SmokeDetected.SMOKE_DETECTED);
    } else {
        callback(null, Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
    }
}

EnvisalinkAccessory.prototype.processAlarmState = function (nextEvent, callback) {
    if (nextEvent.enableSet == true) {
        if (nextEvent.data !== Characteristic.SecuritySystemCurrentState.DISARMED && this.status && this.status.code === '651') {
            var accservice = this.getServices()[0];
            accservice.getCharacteristic(Characteristic.SecuritySystemTargetState).setValue(Characteristic.SecuritySystemCurrentState.DISARMED);
            nextEvent.callback(null, Characteristic.SecuritySystemCurrentState.DISARMED);
            return;
        }

        this.log("Attempting to set alarm state to: ", nextEvent.data);
        var command = null;
        this.lastTargetState = nextEvent.data;
        if (nextEvent.data == Characteristic.SecuritySystemCurrentState.DISARMED) {
            this.log("Disarming alarm with PIN.");
            command = "040" + this.partition + this.pin;
        } else if (nextEvent.data == Characteristic.SecuritySystemCurrentState.STAY_ARM || nextEvent.data == Characteristic.SecuritySystemCurrentState.NIGHT_ARM) {
            this.log("Arming alarm to Stay/Night.");
            command = "031" + this.partition;
        } else if (nextEvent.data == Characteristic.SecuritySystemCurrentState.AWAY_ARM) {
            this.log("Arming alarm to Away.");
            command = "030" + this.partition;
        }
        if (command) {
            var self = this;
            nap.manualCommand(command, function (msg) {
                if (msg === '024') {
                    if (nextEvent.attempts > 5) {
                        nextEvent.callback(null);
                        callback();
                        return;
                    }
                    var eventData = {
                        data: nextEvent.data,
                        enableSet: nextEvent.enableSet,
                        attempts: (nextEvent.attempts || 0) + 1
                    };

                    self.insertDelayedEvent('alarm', eventData, nextEvent.callback, 1000);
                } else {
                    nextEvent.callback(null, nextEvent.data);
                    callback();
                }
            });
        } else {
            this.log("Unhandled alarm state: " + nextEvent.data);
            nextEvent.callback(null);
            callback();
        }
    } else {
        nextEvent.callback(null);
        callback();
    }
}

EnvisalinkAccessory.prototype.processTimeChange = function (nextEvent, callback) {
    var self = this;
    var date = dateFormat(new Date(), "HHMMmmddyy");
    this.log("Setting the current time on the alarm system to: " + date);
    nap.manualCommand("010" + date, function (data) {
        if (data) {
            self.log("Time not set successfully.");
        } else {
            self.log("Time set successfully.");
        }

        callback();

    }.bind(self));
}

EnvisalinkAccessory.prototype.insertDelayedEvent = function (type, data, callback, delay, pushEndBool) {
    var eventData;
    if (typeof data === 'object') {
        eventData = data;
        eventData.type = type;
        eventData.callback = callback;
    } else {
        eventData = {
            id: Math.floor((Math.random() * 10000) + 1),
            type: type,
            data: data,
            enableSet: enableSet,
            callback: callback
        };
    }

    if (pushEndBool) {
        this.delayedEvents = this.delayedEvents || [];
        this.delayedEvents.push(eventData);
    } else {
        this.delayedEvents = [eventData].concat(this.delayedEvents || []);
    }

    if (this.delayedEvents.length === 1) {
        setTimeout(this.processDelayedEvents.bind(this), delay || 0);
    }
}

EnvisalinkAccessory.prototype.addDelayedEvent = function (type, data, callback, delay) {
    this.insertDelayedEvent.call(this, type, data, callback, delay, true);
}

EnvisalinkAccessory.prototype.processDelayedEvents = function () {
    if (this.delayedEvents && this.delayedEvents.length > 0) {
        var nextEvent = this.delayedEvents[0];
        this.delayedEvents = this.delayedEvents.slice(1);
        var callback = function () {
            if (this.delayedEvents.length > 0) {
                setTimeout(this.processDelayedEvents.bind(this), 0);
            }
        };
        if (nextEvent.type === 'alarm') {
            this.processAlarmState(nextEvent, callback.bind(this));
        } else if (nextEvent.type === 'time') {
            this.processTimeChange(nextEvent, callback.bind(this));
        }
    }
}
