var net = require("net");
var nap = require('./node_modules/nodealarmproxy/index.js');
var dateFormat = require('dateformat');
var Service, Characteristic;

/* Register the plugin with homebridge */
module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-envisalink", "Envisalink", EnvisalinkAccessory);
}

function EnvisalinkAccessory(log, config) {
    this.log = log;
    this.name = config.name;
    this.deviceType = config.deviceType;
    this.pin = config.pin;
    this.partition = config.partition ? config.partition : "1";
    this.log("Configuring Envisalink accessory.  Name: " + this.name + ", Host: " + config.host + ", port: " + config.port + ", type: " + this.deviceType);
    this.log("Starting node alarm proxy...");
    this.alarmConfig = {
        password: config.password,
        serverpassword: config.password,
        actualhost: config.host,
        actualport: config.port,
        serverhost: '0.0.0.0',
        serverport: (config.serverport ? config.serverport : 4026),
        zone: config.zones ? config.zones : 7,
        partition: this.partition,
        proxyenable: true,
        atomicEvents: true
    };
    this.alarm = nap.initConfig(this.alarmConfig);
    this.log("Node alarm proxy started.  Listening for connections at: " + this.alarmConfig.serverhost + ":" + this.alarmConfig.serverport);
    this.alarm.on('data', this.systemUpdate.bind(this));
    this.alarm.on('zone', this.zoneUpdate.bind(this));
    this.alarm.on('partition', this.partitionUpdate.bind(this));

    this.service = new Service.SecuritySystem(this.name);
    this.service
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .on('get', this.getAlarmState.bind(this));
    this.service
        .getCharacteristic(Characteristic.SecuritySystemTargetState)
        .on('get', this.getAlarmState.bind(this))
        .on('set', this.setAlarmState.bind(this));
    this.service
        .addCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getBatteryLevel.bind(this));
    this.log(JSON.stringify(this.alarm));
    //hhmmMMDDYY according to docs
    //var date = dateFormat(new Date(), "HHMMmmddyy");
    //this.log("Setting the current time on the alarm system to: " + date)
    //nap.manualCommand("010" + date, function(data) {
    //});
}

EnvisalinkAccessory.prototype.systemUpdate = function (data) {
    this.log('System status changed to: ', data);
}

EnvisalinkAccessory.prototype.zoneUpdate = function (data) {
    this.log('Zone status changed to:', data);
}


EnvisalinkAccessory.prototype.partitionUpdate = function (data) {
    var watchevents = ['601', '602', '609', '610', '650', '651', '652', '654', '656', '657'];
    this.log('Partition status changed to:', data);
    if (data.code == "652") {
        //0: AWAY, 1: STAY, 2:  ZERO-ENTRY-AWAY, 3:  ZERO-ENTRY-STAY
        if (data.mode == '1' || data.mode == "3") {
            this.awayStay = Characteristic.SecuritySystemCurrentState.STAY_ARM;
        } else {
            this.awayStay = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
        }
    }
    if (watchevents.indexOf(data.code) != -1) {

    }
}

EnvisalinkAccessory.prototype.getServices = function () {
    return [this.service];
}

EnvisalinkAccessory.prototype.getAlarmState = function (callback) {
    this.log("Getting current alarm state...")
    nap.getCurrent(function (currentState) {
        this.log("Current state is " + JSON.stringify(currentState));
        if (currentState && currentState.partition && currentState.partition[this.partition]) { //TODO: multiple partition support?
            var partition = currentState.partition[this.partition];
            //Default to disarmed
            var status = Characteristic.SecuritySystemCurrentState.DISARMED;
            if (partition.send == "alarm" || partition.send == "entrydelay") {
                status = Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
            } else if (partition.send == "armed") {
                if (this.awayStay) {
                    status = this.awayStay;
                } else if(this.lastTargetState == Characteristic.SecuritySystemCurrentState.AWAY_ARM ||
                    this.lastTargetState == Characteristic.SecuritySystemCurrentState.STAY_ARM ||
                    this.lastTargetState == Characteristic.SecuritySystemCurrentState.NIGHT_ARM) {
                    status = this.lastTargetState;
                } else { //Unknown...just assume away
                    status = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
                }
            } else if (partition.send == "exitdelay") { //Use the target alarm state during the exit delay.
                status = this.lastTargetState;
            }
            callback(null, status);
        }
    }.bind(this));
}

EnvisalinkAccessory.prototype.setAlarmState = function (state, callback) {
    this.log("Attempting to set alarm state to: " + state);
    var command = null;
    this.lastTargetState = state;
    if (state == Characteristic.SecuritySystemCurrentState.DISARMED) {
        this.log("Disarming alarm with PIN.");
        command = "040" + this.partition + this.pin;
    } else if (state == Characteristic.SecuritySystemCurrentState.STAY_ARM || state == Characteristic.SecuritySystemCurrentState.NIGHT_ARM) {
        this.log("Arming alarm to Stay/Night.");
        command = "031" + this.partition;
    } else if (state == Characteristic.SecuritySystemCurrentState.AWAY_ARM) {
        this.log("Arming alarm to Away.");
        command = "030" + this.partition;
    }
    if (command) {
        nap.manualCommand(command, function () {
            callback(null, state);
        });
    } else {
        this.log("Unhandled alarm state: " + state);
        callback(null);
    }
}

EnvisalinkAccessory.prototype.getBatteryLevel = function (callback) {
    callback(null, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
}