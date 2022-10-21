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
import dateFormat from 'dateformat';
import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {EnvisalinkConfig, ZoneConfig} from './configTypes';
import {
    transformPartitionStatus,
    transformPartitionStatuses,
    transformZoneStatus,
    transformZoneStatuses
} from './util';
import {CONTACT_SENSORS, EnvisalinkStatusCode, ERROR_CODES, Partition, PartitionStatus, Zone} from './types';
import {EnvisalinkZoneAccessory} from './zoneAccessory';
import {EnvisalinkPartitionAccessory} from './partitionAccessory';
import {NodeAlarmProxy, PartitionUpdate, ZoneUpdate} from './nodeAlarmProxyTypes';
import {EnvisalinkPanicAccessory} from './panicAccessory';
import {EnvisalinkCustomCommandAccessory} from './customCommandAccessory';
import envisalinkCodes = require('nodealarmproxy/envisalink.js');
import * as util from 'util';

const MILLIS_BETWEEN_WAIT = 100;
const MILLIS_MAX_WAIT = 30000;
const MILLIS_BETWEEN_RECONNECTS = 60000;

const promisifiedNapCommand = util.promisify(nap.manualCommand);

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
    private lastPartitionAction?: Partition;

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
        this.api.on('didFinishLaunching', async () => {
            log.debug('Executed didFinishLaunching callback');

            this.log.info(`Configuring Envisalink platform,  Host: ${co.host} Port: ${co.port}`);

            try {
                await this.resetConnection(null);
                let increment = 0;
                this.zoneConfigs = co.zones.reduce((map, zoneConfig) => {
                    increment++;
                    if (!zoneConfig.zoneNumber) {
                        zoneConfig.zoneNumber = increment;
                    }
                    if (!zoneConfig.name) {
                        zoneConfig.name = `Zone ${increment}`;
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
        this.accessories.set(accessory.UUID, accessory);
    }


    async resetConnection(err) {
        try {
            this.log.info('Attempting connect to Envisalink..');
            if (err) {
                this.log.error(`Caught connection error. Sleeping ${MILLIS_BETWEEN_RECONNECTS / 1000} seconds and trying again. `, err);
                await new Promise(f => setTimeout(f, MILLIS_BETWEEN_RECONNECTS));
            }
            const co = this.getConfig();
            const maxZoneNumber = Math.max(...co.zones.map((zone) => {
                return zone.zoneNumber || -1;
            }));
            this.alarm = this.initializeNodeAlarmProxy(co.partitions.length, Math.max(maxZoneNumber, co.zones.length));
        } catch (e) {
            this.log.error('Fatal error in reset connection', e);
        }
    }

    initializeNodeAlarmProxy(partitionCount: number, zoneCount: number) {
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
            logger: this.log
        };
        const nodeAlarm = nap.initConfig(alarmConfig);
        if (proxyEnabled) {
            this.log.info(`Node alarm proxy started.  Listening for connections at: ${alarmConfig.serverhost}:${alarmConfig.serverport}`);
        } else {
            this.log.info(`Node alarm proxy started. Proxy is disabled`);
        }
        nodeAlarm.on('data', this.dataUpdate.bind(this));
        nodeAlarm.on('connecterror', this.resetConnection.bind(this));
        nodeAlarm.on('zoneupdate', this.zoneUpdate.bind(this));
        nodeAlarm.on('partitionupdate', this.partitionUpdate.bind(this));
        nodeAlarm.on('partitionuserupdate', this.partitionUserUpdate.bind(this));
        nodeAlarm.on('systemupdate', this.systemUpdate.bind(this));
        nodeAlarm.on('coderequired', this.codeRequired.bind(this));
        return nodeAlarm;
    }

    discoverCustomCommandAccessories() {
        if (!this.getConfig().customCommands || this.getConfig().customCommands.length == 0) {
            this.log.debug('No custom commands configured.');
            return;
        }
        this.getConfig().customCommands.forEach(customCommand => {
            const uuid = this.api.hap.uuid.generate(`envisalink.customCommand.${customCommand.command}`);
            let accessory = this.accessories.get(uuid);
            if (accessory) {
                this.log.debug('Restoring existing custom command accessory from cache:', accessory.displayName);
                accessory.displayName = customCommand.name;
                this.api.updatePlatformAccessories([accessory]);
                new EnvisalinkCustomCommandAccessory(this, accessory, customCommand.name, customCommand.command);
            } else {
                this.log.debug('Adding new custom command accessory because accessory was not restored from cache.');
                accessory = new this.api.platformAccessory(customCommand.name, uuid);
                this.accessories.set(uuid, accessory);
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
        let accessory = this.accessories.get(uuid);
        if (accessory) {
            this.log.debug('Restoring existing panic accessory from cache:', accessory.displayName);
            this.api.updatePlatformAccessories([accessory]);
            new EnvisalinkPanicAccessory(this, accessory, this.getConfig());
        } else {
            this.log.debug('Adding new panic accessory because accessory was not restored from cache.');
            accessory = new this.api.platformAccessory('Panic', uuid);
            this.accessories.set(uuid, accessory);
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
        let accessory = this.accessories.get(uuid);
        if (accessory) {
            this.log.debug('Restoring existing zone accessory from cache:', accessory.displayName);
            accessory.context = zone;
            this.api.updatePlatformAccessories([accessory]);
            new EnvisalinkZoneAccessory(this, accessory);
        } else {
            this.log.debug(`Adding new zone accessory because ${accessory} was not restored from cache:`, zone.name);
            accessory = new this.api.platformAccessory(zone.name, uuid);
            accessory.context = zone;
            this.accessories.set(uuid, accessory);
            new EnvisalinkZoneAccessory(this, accessory);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
    }

    async bypassAllOpenZones(partition: number) {
        try {
            this.log.debug(`Bypassing open zones in partition: ${partition}. Checking ${this.accessories.size} accessories.`);
            let bypassedCount = 0;
            for (const accessory of this.accessories.values()) {
                if (accessory.context && Object.prototype.hasOwnProperty.call(accessory.context, 'type')) {
                    const zone = accessory.context as Zone;
                    if (zone.partition === partition && CONTACT_SENSORS.has(zone.type) && zone.status.text === 'open') {
                        this.log.info(`Bypassing open zone: ${zone.name}`);
                        const zoneString = String(zone.number).padStart(2, '0');
                        await this.sendAlarmCommand(`071${partition}*1${zoneString}#`, partition);
                        bypassedCount++;
                    }
                }
            }
            this.log.info(`${bypassedCount} open zones were bypassed.`);
        } catch (error) {
            this.log.error('Failed to bypass open zones', error);
        }
    }

    getPartitionStatus(partitionNumber: number): PartitionStatus {
        for (const accessory of this.accessories.values()) {
            //Hack.
            if (accessory.context && Object.prototype.hasOwnProperty.call(accessory.context, 'enableChimeSwitch')) {
                const partition = accessory.context as Partition;
                if (partition.number === partitionNumber) {
                    return partition.status;
                }
            }
        }
        throw new Error(`Could not find partition: ${partitionNumber}`);
    }

    updatePartitionAccessory(partition: Partition) {
        const uuid = this.api.hap.uuid.generate(`envisalink.${partition.number}`);
        let accessory = this.accessories.get(uuid);
        partition.pin = partition.pin || this.getConfig().pin;
        if (accessory) {
            this.log.debug('Restoring existing partition accessory from cache:', accessory.displayName);
            const previousChimeStatus: boolean | undefined = accessory.context?.chimeActive;
            // Restore chime status in case this update was unrelated to chime.
            if (partition.chimeActive == undefined) {
                partition.chimeActive = previousChimeStatus;
            }

            const previousBypassEnabled: boolean | undefined = accessory.context?.bypassEnabled;
            // Restore bypass enabled in case this update was unrelated to bypass.
            if (partition.bypassEnabled == undefined) {
                partition.bypassEnabled = previousBypassEnabled;
            }
            accessory.context = partition;
            this.api.updatePlatformAccessories([accessory]);
            new EnvisalinkPartitionAccessory(this, accessory);
        } else {
            this.log.debug(`Adding new partition accessory because ${accessory} was not restored from cache:`, partition.name);
            accessory = new this.api.platformAccessory(partition.name, uuid);
            accessory.context = partition;
            this.accessories.set(uuid, accessory);
            new EnvisalinkPartitionAccessory(this, accessory);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
        if (partition.enableChimeSwitch && !this.chimeInitialized) {
            this.chimeInitialized = true;
            // Super hacky, but toggle chime such that the initial status is reflected correctly.
            // Wait 10 seconds for initial system startup (i.e. time sync)

            const waitForStatusCodes = new Set([EnvisalinkStatusCode.ChimeEnabled, EnvisalinkStatusCode.ChimeDisabled]);
            this.sendAlarmCommand(partition.chimeCommand, partition.number, waitForStatusCodes).then(() => {
                this.sendAlarmCommand(partition.chimeCommand, partition.number, waitForStatusCodes).then(() => {
                    this.log.debug("Chime toggled twice successfully to fetch initial status.");
                }).catch(error => this.log.error("Second set chime failed while fetching status", error));

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

    setPartitionStatus(partitionNumber: number, statusCode: string) {
        this.log.debug(`Forcing partition status to ${statusCode}: ${envisalinkCodes.tpicommands[statusCode].name}`)
        const partition = transformPartitionStatus(this.getConfig().partitions, partitionNumber, {
            code: statusCode
        });
        this.updatePartitionAccessory(partition);
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
        } catch (error) {
            this.log.error(`Caught error in systemUpdate. Data: ${this.json(data)}`, error);
        }
    }

    async codeRequired() {
        try {
            if (this.getConfig().enableVerboseLogging) {
                this.log.debug(`Inside codeRequired.`);
            }
            if (!this.lastPartitionAction) {
                this.log.error(`Can't handle pin request from panel because last partition is null. ` +
                    `Previous command will be ignored.`);
                return;
            }
            this.log.info(`Panel has requested code (900 response). Sending PIN...`);
            await this.sendAlarmCommand(`200${this.lastPartitionAction.pin}`);
        } catch (error) {
            this.log.error(`Caught error in codeRequired.`, error);
        }
    }

    json(data) {
        return JSON.stringify(data, null, 2);
    }

    getConfig(): EnvisalinkConfig {
        return this.config as EnvisalinkConfig;
    }

    public setLastPartitionAction(partition: Partition): void {
        this.lastPartitionAction = partition;
    }

    public sleep(millis: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, millis));
    }

    public async sendAlarmCommand(command: string, waitForReadyPartition?: number, waitForStatusCodes?: Set<string>): Promise<void> {
        if (waitForReadyPartition) {
            // Force to busy.
            this.setPartitionStatus(waitForReadyPartition, EnvisalinkStatusCode.Busy);
        }
        this.log.debug(`Sending command to NAP ${command}`);
        try {
            await promisifiedNapCommand(command);
        } catch (err) {
            const errorMessage = ERROR_CODES.get(err as string);
            throw new Error(`Command ${command} resulted in error from alarm: ${err}: ${errorMessage}`);
        }
        if (waitForReadyPartition) {
            let status = this.getPartitionStatus(waitForReadyPartition).shortCode;
            this.log.debug(`Command ${command} succeeded. Waiting until partition is ready. Current: ${status}`);
            let totalSleepTime = 0;
            while(MILLIS_MAX_WAIT > totalSleepTime && (waitForStatusCodes ? !waitForStatusCodes.has(status) : status === EnvisalinkStatusCode.Busy)) {
                this.log.debug(`Partition still ${this.getPartitionStatus(waitForReadyPartition).shortCode}. ` +
                    `Waiting for ${(waitForStatusCodes ? Array.from(waitForStatusCodes).join(',') : EnvisalinkStatusCode.Busy)}`);
                totalSleepTime += MILLIS_BETWEEN_WAIT;
                await this.sleep(MILLIS_BETWEEN_WAIT);
                status = this.getPartitionStatus(waitForReadyPartition).shortCode;
            }
            this.log.debug(`Partition status is ${status} after wait. Continuing.`);
        } else {
            this.log.debug(`Command ${command} succeeded.`);
        }
    }
}
