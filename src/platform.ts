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
                this.alarm = this.initializeNodeAlarmProxy(co.partitions.length, co.zones.length);
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
            } catch (error) {
                this.log.error("Failed to initialize NodeAlarmProxy", error);
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
            proxyenable: !!co.proxyPort,
            atomicEvents: true,
            logging: false
        };
        const nodeAlarm = nap.initConfig(alarmConfig);
        this.log.info(`Node alarm proxy started.  Listening for connections at: ${alarmConfig.serverhost}:${alarmConfig.serverport}`);
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
        this.log.debug(`Inside dataUpdate: ${JSON.stringify(data, null, 2)}`);
        const zoneUpdates: Map<string, ZoneUpdate> = new Map(Object.entries(data.zone));
        Object.values(transformZoneStatuses(this.zoneConfigs, zoneUpdates)).forEach(zone => this.updateZoneAccessory(zone));

        const partitionUpdates: Map<string, PartitionUpdate> = new Map(Object.entries(data.partition));
        transformPartitionStatuses(this.getConfig().partitions, partitionUpdates).forEach(partition => this.updatePartitionAccessory(partition));

    }

    partitionUpdate(data) {
        // Example:
        // {
        //   "partition": 1,
        //   "code": "650"
        // }
        const partition = transformPartitionStatus(this.getConfig().partitions, data.partition, data);
        this.updatePartitionAccessory(partition);
        this.log.debug(`${partition.name} ${partition.status?.verbSuffix}`);
    }

    partitionUserUpdate(data) {
        this.log.info(`Inside partitionUserUpdate: ${this.json(data)}`);
    }

    zoneUpdate(data) {
        // Example:
        // {
        //   "zone": 6,
        //   "code": "610"
        // }
        const zone = transformZoneStatus(this.zoneConfigs, data.zone, data);
        this.updateZoneAccessory(zone);
        this.log.debug(`${zone.name} ${zone.status?.verbSuffix}`);
    }

    /**
     * Haven't actually seen this fire yet. Log it to see if we need to handle.
     * @param data
     */
    systemUpdate(data) {
        this.log.info(`Inside systemUpdate: ${this.json(data)}`);
    }

    json(data) {
        return JSON.stringify(data, null, 2);
    }

    getConfig(): EnvisalinkConfig {
        return this.config as EnvisalinkConfig;
    }

    public async sendAlarmCommand(command: string): Promise<void> {
        this.log.info(`Sending command to NAP ${command}`);
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
