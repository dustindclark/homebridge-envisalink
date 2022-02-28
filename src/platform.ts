import {
    API as HomebridgeAPI,
    Characteristic,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service,
} from 'homebridge';

import nap = require('nodealarmproxy');
import dateFormat from "dateformat";
import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {EnvisalinkConfig, ZoneConfig} from "./configTypes";
import {
    transformPartitionStatus,
    transformPartitionStatuses,
    transformZoneStatus,
    transformZoneStatuses
} from "./util";
import {Partition, Zone} from "./types";
import {EnvisalinkZoneAccessory} from "./zoneAccessory";
import {EnvisalinkPartitionAccessory} from "./partitionAccessory";
import {NodeAlarmProxy, PartitionUpdate, ZoneUpdate} from "./nodeAlarmProxyTypes";
import {EnvisalinkPanicAccessory} from "./panicAccessory";
import {EnvisalinkCustomCommandAccessory} from "./customCommandAccessory";

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class EnvisalinkHomebridgePlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    // this is used to track restored cached accessories
    public readonly accessories: Map<string, PlatformAccessory> = new Map();

    private alarm?: NodeAlarmProxy;
    private zoneConfigs: Map<string, ZoneConfig>;
    private chimeInitialized = false;

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: HomebridgeAPI,
    ) {
        this.log.debug('Finished initializing platform:', this.config.name);

        const co = this.getConfig();
        this.alarm = undefined;
        this.zoneConfigs = new Map();

        if (!co || !co.host || !co.password || !co.pin) {
            this.log.warn("Platform will be skipped because config is missing host, password, and/or pin.");
            return;
        }

        if (!co.partitions || co.partitions.length == 0) {
            this.log.warn("Platform will be skipped partitions were not configured.");
            return;
        }

        if (!co.zones || co.zones.length == 0) {
            this.log.warn("Platform will be skipped zones were not configured.");
            return;
        }

        // When this event is fired it means Homebridge has restored all cached accessories from disk.
        // Dynamic Platform plugins should only register new accessories after this event was fired,
        // in order to ensure they weren't added to homebridge already. This event can also be used
        // to start discovery of new accessories.
        this.api.on('didFinishLaunching', () => {
            log.debug('Executed didFinishLaunching callback');

            this.log.info(`Configuring Envisalink platform,  Host: ${co.host} Port: ${co.port}`);

            try {
                const maxZoneNumber = Math.max(...co.zones.map((zone) => {
                    return zone.zoneNumber || -1;
                }));
                this.alarm = this.initializeNodeAlarmProxy(co.partitions.length, Math.max(maxZoneNumber, co.zones.length));
                let increment = 0;
                this.zoneConfigs = co.zones.reduce((map, zoneConfig) => {
                    increment++;
                    if (!zoneConfig.zoneNumber) {
                        zoneConfig.zoneNumber = increment;
                    }
                    map.set(`${zoneConfig.zoneNumber}`, zoneConfig);
                    return map;
                }, new Map<string, ZoneConfig>());
                this.discoverPanicAccessories();
                this.discoverCustomCommandAccessories();
                // Wait for full initialization first
                setTimeout(this.setTime.bind(this), 60000);
            } catch (error) {
                this.log.error("Failed to initialize homebridge-envisalink.", error);
                return;
            }
        });
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory) {
        this.log.debug(`Loading accessory from cache: ${accessory.displayName}`);
        this.accessories[accessory.UUID] = accessory;
    }

    initializeNodeAlarmProxy(partitionCount: number, zoneCount: number): NodeAlarmProxy {
        const co = this.getConfig();
        const proxyEnabled = !!co.proxyPort;
        const alarmConfig = {
            password: co.password,
            serverpassword: co.password,
            actualhost: co.host,
            actualport: co.port ? co.port : 4025,
            serverhost: '0.0.0.0',
            serverport: co.proxyPort ? co.proxyPort : 4026,
            zone: zoneCount,
            userPrograms: null,
            partition: partitionCount,
            proxyenable: proxyEnabled,
            atomicEvents: true,
            logging: co.enableVerboseLogging as boolean,
            logger: this.log
        };
        const nodeAlarm = nap.initConfig(alarmConfig);
        if (proxyEnabled) {
            this.log.info(`Node alarm proxy started.  Listening for connections at: ${alarmConfig.serverhost}:${alarmConfig.serverport}`);
        } else {
            this.log.info(`Node alarm proxy started. Proxy is disabled`);
        }
        nodeAlarm.on('data', this.dataUpdate.bind(this));
        nodeAlarm.on('zoneupdate', this.zoneUpdate.bind(this));
        nodeAlarm.on('partitionupdate', this.partitionUpdate.bind(this));
        nodeAlarm.on('partitionuserupdate', this.partitionUserUpdate.bind(this));
        nodeAlarm.on('systemupdate', this.systemUpdate.bind(this));
        return nodeAlarm;
    }

    discoverCustomCommandAccessories() {
        if (!this.getConfig().customCommands || this.getConfig().customCommands.length == 0) {
            this.log.debug('No custom commands configured.');
            return;
        }
        this.getConfig().customCommands.forEach(customCommand => {
            const uuid = this.api.hap.uuid.generate(`envisalink.customCommand.${customCommand.command}`);
            let accessory = this.accessories[uuid];
            if (accessory) {
                this.log.debug('Restoring existing custom command accessory from cache:', accessory.displayName);
                accessory.name = customCommand.name;
                this.api.updatePlatformAccessories([accessory]);
                new EnvisalinkCustomCommandAccessory(this, accessory, customCommand.name, customCommand.command);
            } else {
                this.log.debug('Adding new custom command accessory because accessory was not restored from cache.');
                accessory = new this.api.platformAccessory(customCommand.name, uuid);
                this.accessories[uuid] = accessory;
                new EnvisalinkCustomCommandAccessory(this, accessory, customCommand.name, customCommand.command);
                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }
        });
    }

    discoverPanicAccessories() {
        const co = this.getConfig();
        if (!co.policePanic?.enabled && !co.firePanic?.enabled && !co.ambulancePanic?.enabled) {
            this.log.info('Panic buttons disabled. Will not install panic switches.');
            return;
        }
        const uuid = this.api.hap.uuid.generate(`envisalink.panic`);
        let accessory = this.accessories[uuid];
        if (accessory) {
            this.log.debug('Restoring existing panic accessory from cache:', accessory.displayName);
            this.api.updatePlatformAccessories([accessory]);
            new EnvisalinkPanicAccessory(this, accessory, this.getConfig());
        } else {
            this.log.debug('Adding new panic accessory because accessory was not restored from cache.');
            accessory = new this.api.platformAccessory('Panic', uuid);
            this.accessories[uuid] = accessory;
            new EnvisalinkPanicAccessory(this, accessory, this.getConfig());
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
    }

    async setTime() {
        if (!this.getConfig().suppressClockReset) {
            try {
                const date = dateFormat(new Date(), "HHMMmmddyy");
                this.log.info("Setting the current time on the alarm system to: " + date);

                await this.sendAlarmCommand(`010${date}`);
                this.log.info("Time set successfully");
            } catch (error) {
                this.log.error(`Error setting time:`, error);
            }
            // Once per hour.
            setTimeout(this.setTime.bind(this), 60 * 60 * 1000);
        }
    }

    updateZoneAccessory(zone: Zone) {
        const uuid = this.api.hap.uuid.generate(`envisalink.${zone.partition}.${zone.number}`);
        let accessory = this.accessories[uuid];
        if (accessory) {
            this.log.debug('Restoring existing zone accessory from cache:', accessory.displayName);
            accessory.context = zone;
            this.api.updatePlatformAccessories([accessory]);
            new EnvisalinkZoneAccessory(this, accessory);
        } else {
            this.log.debug(`Adding new zone accessory because ${accessory} was not restored from cache:`, zone.name);
            accessory = new this.api.platformAccessory(zone.name, uuid);
            accessory.context = zone;
            this.accessories[uuid] = accessory;
            new EnvisalinkZoneAccessory(this, accessory);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
    }

    updatePartitionAccessory(partition: Partition) {
        const uuid = this.api.hap.uuid.generate(`envisalink.${partition.number}`);
        let accessory = this.accessories[uuid];
        partition.pin = partition.pin || this.getConfig().pin;
        if (accessory) {
            this.log.debug('Restoring existing partition accessory from cache:', accessory.displayName);
            const previousChimeStatus: boolean | undefined = accessory.context?.chimeActive;
            // Restore chime status in case this update was unrelated to chime.
            if (partition.chimeActive == undefined) {
                partition.chimeActive = previousChimeStatus;
            }
            accessory.context = partition;
            this.api.updatePlatformAccessories([accessory]);
            new EnvisalinkPartitionAccessory(this, accessory);
        } else {
            this.log.debug(`Adding new partition accessory because ${accessory} was not restored from cache:`, partition.name);
            accessory = new this.api.platformAccessory(partition.name, uuid);
            accessory.context = partition;
            this.accessories[uuid] = accessory;
            new EnvisalinkPartitionAccessory(this, accessory);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
        if (partition.enableChimeSwitch && !this.chimeInitialized) {
            this.chimeInitialized = true;
            // Super hacky, but toggle chime such that the initial status is reflected correctly.
            // Wait 10 seconds for initial system startup (i.e. time sync).
            this.sendAlarmCommand(partition.chimeCommand).then(() => {
                // Give the panel a chance to process the command.
                setTimeout(() => {
                    this.sendAlarmCommand(partition.chimeCommand).then(() => {
                        this.log.debug("Chime toggled twice successfully to fetch initial status.");
                    }).catch(error => this.log.error("Second set chime failed while fetching status", error));
                }, 2000);

            }).catch(error => this.log.error("First set chime failed while fetching status", error));
        }
    }

    dataUpdate(data) {
        // Example:
        // {
        //   "zone": {
        //     "1": {
        //       "send": "restore",
        //       "name": "Zone Alarm Restore",
        //       "code": "61000128"
        //     },
        //   },
        //   "partition": {
        //     "1": {
        //       "send": "readyforce",
        //       "name": "Partition Ready - Force Arming Enabled",
        //       "code": "6531CF"
        //     }
        //   },
        //   "user": {}
        // }
        try {
            if (this.getConfig().enableVerboseLogging) {
                this.log.debug(`Inside dataUpdate: ${this.json(data)}`);
            }
            const zoneUpdates: Map<string, ZoneUpdate> = new Map(Object.entries(data.zone));
            Object.values(transformZoneStatuses(this.zoneConfigs, zoneUpdates)).forEach(zone => this.updateZoneAccessory(zone));

            const partitionUpdates: Map<string, PartitionUpdate> = new Map(Object.entries(data.partition));
            transformPartitionStatuses(this.getConfig().partitions, partitionUpdates).forEach(partition => this.updatePartitionAccessory(partition));
        } catch (error) {
            this.log.error(`Caught error in dataUpdate. Data: ${this.json(data)}`, error);
        }

    }

    partitionUpdate(data) {
        // Example:
        // {
        //   "partition": 1,
        //   "code": "650"
        // }
        try {
            if (this.getConfig().enableVerboseLogging) {
                this.log.debug(`Inside partitionUpdate: ${this.json(data)}`);
            }
            const partition = transformPartitionStatus(this.getConfig().partitions, data.partition, data);
            this.updatePartitionAccessory(partition);
            this.log.debug(`${partition.name} ${partition.status?.verbSuffix}`);
        } catch (error) {
            this.log.error(`Caught error in partitionUpdate. Data: ${this.json(data)}`, error);
        }
    }

    partitionUserUpdate(data) {
        try {
            this.log.debug(`Inside partitionUserUpdate: ${this.json(data)}`);
            // TODO.
        } catch (error) {
            this.log.error(`Caught error in systemUpdate. Data: ${this.json(data)}`, error);
        }
    }

    zoneUpdate(data) {
        try {
            // Example:
            // {
            //   "zone": 6,
            //   "code": "610"
            // }
            if (this.getConfig().enableVerboseLogging) {
                this.log.debug(`Inside zoneUpdate: ${this.json(data)}`);
            }
            const zone = transformZoneStatus(this.zoneConfigs, data.zone, data);
            if (zone == null) {
                this.log.debug(`Zone ${data.zone} returned null because of missing config. Assuming non-consecutive zones.`);
                return;
            }
            this.updateZoneAccessory(zone);
            this.log.debug(`${zone.name} ${zone.status?.verbSuffix}`);
        } catch (error) {
            this.log.error(`Caught error in zoneUpdate. Data: ${this.json(data)}`, error);
        }
    }

    /**
     * Haven't actually seen this fire yet. Log it to see if we need to handle.
     * @param data
     */
    systemUpdate(data) {
        try {
            if (this.getConfig().enableVerboseLogging) {
                this.log.debug(`Inside systemUpdate: ${this.json(data)}`);
            }
            // TODO. Handle smoke sensors.
        } catch (error) {
            this.log.error(`Caught error in systemUpdate. Data: ${this.json(data)}`, error);
        }
    }

    json(data) {
        return JSON.stringify(data, null, 2);
    }

    getConfig(): EnvisalinkConfig {
        return this.config as EnvisalinkConfig;
    }

    public async sendAlarmCommand(command: string): Promise<void> {
        this.log.debug(`Sending command to NAP ${command}`);
        await new Promise<void>((resolve, reject) => {
            nap.manualCommand(command, function (errorCode) {
                if (errorCode) {
                    reject(new Error(`Command ${command} resulted in ${errorCode} error from alarm`));
                }
                resolve();
            });
        });
        this.log.debug(`Command ${command} succeeded.`);
    }
}
