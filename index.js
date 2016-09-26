var net = require("net");
var nap = require('nodealarmproxy/index.js');
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
        partition: this.partitions ? this.partitions.length : 1,
        proxyenable: true,
        atomicEvents: true
    };
    this.log("Zones: " + this.alarmConfig.zone);
    this.alarm = nap.initConfig(this.alarmConfig);
    this.log("Node alarm proxy started.  Listening for connections at: " + this.alarmConfig.serverhost + ":" + this.alarmConfig.serverport);
    this.alarm.on('data', this.systemUpdate.bind(this));
    this.alarm.on('zone', this.zoneUpdate.bind(this));
    this.alarm.on('partition', this.partitionUpdate.bind(this));

    this.platformAccessories = [];
    for (var i = 0; i < this.partitions.length; i++) {
        var partition = this.partitions[i];
        partition.pin = config.pin;
        this.platformAccessories.push(new EnvisalinkAccessory(this.log, "partition", partition, i + 1));
    }
    if (!config.suppressZoneAccessories) {
        for (var i = 0; i < this.zones.length; i++) {
            var zone = this.zones[i];
            if (zone.type == "motion" || zone.type == "window" || zone.type == "door") {
                this.platformAccessories.push(new EnvisalinkAccessory(this.log, zone.type, zone, zone.partition, i + 1));
            } else {
                console.log("Unhandled accessory type: " + zone.type);
            }
        }
    }

    nap.manualCommand("000");
    nap.manualCommand("001");

    //TODO: this gives incorrect password??
    //hhmmMMDDYY according to docs
    //var date = dateFormat(new Date(), "HHMMmmddyy");
    //this.log("Setting the current time on the alarm system to: " + date)
    //nap.manualCommand("010" + date, function (data) {
    //    this.log("Time set successfully. " + data)
    //}.bind(this));

}


EnvisalinkPlatform.prototype.systemUpdate = function (data) {
    this.log('System status changed to: ', data);
    for (var i = 0; i < this.platformAccessories.length; i++) {
        var accessory = this.platformAccessories[i];
        if (!accessory.zone && accessory.partition == data.partition) {
            accessory.systemStatus = elink.tpicommands[data.code];
            console.log("Set system status on accessory " + accessory.name + ' to ' + JSON.stringify(accessory.status));
            break;
        }
    }
}

EnvisalinkPlatform.prototype.zoneUpdate = function (data) {
    this.log('Zone status changed to:', data);
    for (var i = 0; i < this.platformAccessories.length; i++) {
        var accessory = this.platformAccessories[i];
        if (accessory.zone == data.zone) {
            accessory.status = elink.tpicommands[data.code];
            console.log("Set status on accessory " + accessory.name + ' to ' + JSON.stringify(accessory.status)); 
            
            var accservice = (accessory.getServices())[0];
				
		    if (accservice) {	
				if (accessory.accessoryType == "motion") {
					
					accessory.getMotionStatus(function(nothing, resultat) { 
						accservice.getCharacteristic(Characteristic.MotionDetected).setValue(resultat); 
					});
					   
			    } else if (accessory.accessoryType == "door" || accessory.accessoryType == "window") {
					
					accessory.getContactPosition(function(nothing, resultat) {
						 accservice.getCharacteristic(Characteristic.CurrentPosition).setValue(resultat);
					});
				
			    } 	
		    }
	    
	 	    //console.log("Set status on accessory " + accessory.name + ' to ' + JSON.stringify(accessory.status));
            break;
        }
    }
}

EnvisalinkPlatform.prototype.partitionUpdate = function (data) {
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
    for (var i = 0; i < this.platformAccessories.length; i++) {
        var accessory = this.platformAccessories[i];
        if (!accessory.zone && accessory.partition == data.partition) {
            accessory.status = elink.tpicommands[data.code];
            
            var accservice = (accessory.getServices())[0];
			var accstatus;
	
		    if (accservice) {	
				if (accessory.accessoryType == "partition") {
					
					if (data.code == "656") { //exit delay 
						enableSet = false;
						var armMode = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
						if (accessory.lastTargetState != null) { armMode = accessory.lastTargetState };
						accservice.getCharacteristic(Characteristic.SecuritySystemTargetState).setValue(armMode);
						enableSet = true;	
					} else if (data.code == "657") { //entry-delay
						enableSet = false;
						accservice.getCharacteristic(Characteristic.SecuritySystemTargetState).setValue(Characteristic.SecuritySystemCurrentState.DISARMED);
						enableSet = true;	
					} else if (data.code == "652" || data.code == "654" || data.code == "655") { //Armed, Alarm, Disarmed
						accessory.getAlarmState(function(nothing, resultat) { 
							enableSet = false;
							accservice.getCharacteristic(Characteristic.SecuritySystemTargetState).setValue(resultat);
							enableSet = true;	
							accservice.getCharacteristic(Characteristic.SecuritySystemCurrentState).setValue(resultat); 
						});					
					} else if (data.code == "626" || data.code == "650" || data.code == "651" || data.code == "653") { //Ready, Not Ready, Ready Force ARM
						accessory.getReadyState(function(nothing, resultat) { 
							accservice.getCharacteristic(Characteristic.ObstructionDetected).setValue(resultat); 
						});
					}		
			    } 	
		    }   
                     
            console.log("Set status on accessory " + accessory.name + ' to ' + JSON.stringify(accessory.status));
            break;
        }
    }
}

EnvisalinkPlatform.prototype.accessories = function (callback) {
    callback(this.platformAccessories);
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
        var service = new Service.Door(this.name);
        service
            .getCharacteristic(Characteristic.CurrentPosition)
            .on('get', this.getContactPosition.bind(this));
        service
            .getCharacteristic(Characteristic.TargetPosition)
            .on('get', this.getContactPosition.bind(this));
        service
            .getCharacteristic(Characteristic.PositionState)
            .on('get', this.getContactState.bind(this));
        this.services.push(service);
    } else if (this.accessoryType == "window") {
        var service = new Service.Window(this.name);
        service
            .getCharacteristic(Characteristic.CurrentPosition)
            .on('get', this.getContactPosition.bind(this));
        service
            .getCharacteristic(Characteristic.TargetPosition)
            .on('get', this.getContactPosition.bind(this));
        service
            .getCharacteristic(Characteristic.PositionState)
            .on('get', this.getContactState.bind(this));
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
      this.log("Getting current ready state...");
      nap.getCurrent(function (currentState) {
        this.log("Current ready state is " + JSON.stringify(currentState));
        if (currentState && currentState.partition && currentState.partition[this.partition]) { //TODO: multiple partition support?
            var partition = currentState.partition[this.partition];
            
            var status = true;
            
	        if (partition.send == "ready" || partition.send == "readyforce") {
                status = false;
            } 
            callback(null, status);
        }
    }.bind(this));
}
EnvisalinkAccessory.prototype.getAlarmState = function (callback) {
    this.log("Getting current alarm state...");
    nap.getCurrent(function (currentState) {
        this.log("Current state is " + JSON.stringify(currentState));
        if (currentState && currentState.partition && currentState.partition[this.partition]) { //TODO: multiple partition support?
            var partition = currentState.partition[this.partition];
            //Default to disarmed

            var status = Characteristic.SecuritySystemCurrentState.DISARMED;
            
	        if (partition.send == "alarm"){
                status = Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
            } else if (partition.send == "armed") {

	    	    //0: AWAY, 1: STAY, 2:  ZERO-ENTRY-AWAY, 3:  ZERO-ENTRY-STAY
	    	    
            	if (partition.code.substring(4,5) == '1' || partition.code.substring(4,5) == '3') {
                	status = Characteristic.SecuritySystemCurrentState.STAY_ARM;
            	} else {
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

    if (enableSet == true) {
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
    } else {
		callback(null);
	}
}

EnvisalinkAccessory.prototype.getContactPosition = function (callback) {
    if (this.status && this.status.send == "open") {
        callback(null, 100);
    } else {
        callback(null, 0);
    }
}

EnvisalinkAccessory.prototype.getContactState = function (callback) {
    callback(null, Characteristic.PositionState.STOPPED);
}
