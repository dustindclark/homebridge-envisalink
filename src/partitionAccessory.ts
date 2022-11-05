import {CharacteristicValue, PlatformAccessory} from 'homebridge';

import {EnvisalinkHomebridgePlatform} from './platform';
import {MANUFACTURER, MODEL} from './constants';
import {Partition, PartitionMode} from './types';

const CHIME_SERVICE_NAME = 'Chime';
const BYPASS_SERVICE_NAME = 'Bypass';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class EnvisalinkPartitionAccessory {
    private partition: Partition;

    constructor(
        private readonly platform: EnvisalinkHomebridgePlatform,
        private readonly accessory: PlatformAccessory,
    ) {

        this.partition = this.accessory.context as Partition;

        this.platform.log.debug(`Setting accessory details for zone: ${JSON.stringify(this.partition, null, 2)}`);

        this.bindAccessoryDetails();
        this.bindSecurityPanel();
        this.bindBypassSwitch(1);
        this.bindChimeSwitch(2);
    }

    bindAccessoryDetails() {
        const serialNumber = `Partition ${this.partition.number}`;
        const infoService = this.accessory.getService(this.platform.Service.AccessoryInformation);
        if (infoService) {
            infoService.setCharacteristic(this.platform.Characteristic.Manufacturer, MANUFACTURER)
                .setCharacteristic(this.platform.Characteristic.Model, MODEL)
                .setCharacteristic(this.platform.Characteristic.SerialNumber, serialNumber);
        }
    }

    bindChimeSwitch(index: number) {
        if (!this.partition.enableChimeSwitch) {
            return false;
        }
        let chimeService = this.accessory.getService(CHIME_SERVICE_NAME);
        if (!chimeService) {
            const displayName = `${this.partition.name} ${CHIME_SERVICE_NAME}`;
            chimeService = new this.platform.Service.Switch(displayName, CHIME_SERVICE_NAME);
            chimeService.setCharacteristic(this.platform.Characteristic.Name, displayName);
            chimeService.setCharacteristic(this.platform.Characteristic.ServiceLabelIndex, index);
            this.accessory.addService(chimeService);
        }
        chimeService.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setChimeActive.bind(this));
        chimeService.updateCharacteristic(this.platform.Characteristic.On,
            this.partition.chimeActive === undefined ? false : this.partition.chimeActive);
    }

    bindBypassSwitch(index: number) {
        let bypassService = this.accessory.getService(BYPASS_SERVICE_NAME);
        if (!bypassService) {
            const displayName = `${this.partition.name} ${BYPASS_SERVICE_NAME}`;
            bypassService = new this.platform.Service.Switch(displayName, BYPASS_SERVICE_NAME);
            bypassService.setCharacteristic(this.platform.Characteristic.Name, displayName);
            bypassService.setCharacteristic(this.platform.Characteristic.ServiceLabelIndex, index);
            this.accessory.addService(bypassService);
        }
        bypassService.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setBypassActive.bind(this));
        bypassService.updateCharacteristic(this.platform.Characteristic.On,
            this.partition.bypassEnabled === undefined ? false : this.partition.bypassEnabled);
    }

    async setChimeActive(value: CharacteristicValue) {
        try {
            this.platform.log.debug(`setChimeActive to ${value} for partition ${this.partition.number}`);
            await this.platform.sendAlarmCommand(`071${this.partition.number}*4`);
            this.platform.log.debug('setChimeActive complete.');
        } catch (error) {
            this.platform.log.error(`Failed setting chime active to ${value}`, error);
        }
    }

    async setBypassActive(value: CharacteristicValue) {
        try {
            this.platform.log.info(`setBypassActive to ${value as boolean} for partition ${this.partition.number}`);
            this.partition.bypassEnabled = value as boolean;
            this.platform.log.debug('setBypassActive complete.');
        } catch (error) {
            this.platform.log.error(`Failed setting setBypassActive active to ${value}`, error);
        }
    }

    bindSecurityPanel() {
        const service = this.accessory.getService(this.platform.Service.SecuritySystem)
            || this.accessory.addService(this.platform.Service.SecuritySystem);
        service.setCharacteristic(this.platform.Characteristic.Name, this.partition.name);
        let currentState: number | undefined = undefined;
        let targetState: number | undefined = undefined;
        let obstructionDetected = false;
        this.platform.log.debug(`Partition ${this.partition.number}: ${this.partition.status.text}, ` +
            `mode: ${this.partition.status.mode}.`);

        switch (this.partition.status.text) {
            case 'alarm':
                currentState = this.platform.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
                break;
            case 'partialclosing':
            case 'specialclosing':
            case 'chimedisabled':
            case 'chimeenabled':
                this.platform.log.info(`Ignoring status ${this.partition.status.text}. Waiting for armed/armedbypass`);
                break;
            case 'armed':
            case 'armedbypass':
                if (PartitionMode.Stay === this.partition.status.mode) {
                    currentState = this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM;
                    targetState = this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM;
                } else if (PartitionMode.StayZeroEntry === this.partition.status.mode) {
                    currentState = this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
                    targetState = this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM;
                } else {
                    currentState = this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM;
                    targetState = this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM;
                }
                break;
            case 'disarmed':
            case 'notready':
            case 'failedarm':
            case 'useropening':
                currentState = this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
                obstructionDetected = true;
                break;
            case 'exitdelay':
            case 'entrydelay':
            case 'arming':
            case 'busy':
                break;
            default:
                currentState = this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
        }

        if (currentState !== undefined) {
            this.partition.currentState = currentState;
            service.updateCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState,
                this.partition.currentState as CharacteristicValue);
        }
        if (targetState !== undefined) {
            this.partition.targetState = targetState;
        }
        if (this.partition.targetState !== undefined) {
            service.updateCharacteristic(this.platform.Characteristic.SecuritySystemTargetState,
                this.partition.targetState as CharacteristicValue);
        }
        service.updateCharacteristic(this.platform.Characteristic.ObstructionDetected,
            obstructionDetected);

        service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
            .onSet(this.setPanelState.bind(this));
    }

    async setPanelState(value: CharacteristicValue) {
        try {
            this.platform.log.debug(`setPanelState to ${value} for partition ${this.partition.number}`);
            let command: string | undefined = undefined;
            let arming = true;
            switch (value) {
                case this.platform.Characteristic.SecuritySystemCurrentState.DISARMED:
                    this.partition.targetState = this.platform.Characteristic.SecuritySystemTargetState.DISARM;
                    arming = false;
                    command = `040${this.partition.number}${this.partition.pin}`;
                    break;
                case this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM:
                    this.partition.targetState = this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM;
                    command = `031${this.partition.number}`;
                    break;
                case this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM:
                    this.partition.targetState = this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM;
                    command = `032${this.partition.number}`;
                    break;
                case this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM:
                    this.partition.targetState = this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM;
                    command = `030${this.partition.number}`;
                    break;
            }

            if (command === undefined) {
                this.platform.log.error(`Unhandled alarm state ${value}. Ignoring command.`);
                return;
            }
            if (arming && this.partition.bypassEnabled) {
                await this.platform.bypassAllOpenZones(this.partition.number);
            }

            this.platform.setLastPartitionAction(this.partition);
            await this.platform.sendAlarmCommand(command);
            this.platform.log.debug(`Successfully set alarm panel state to ${value} on partition ${this.partition.number}`);
        } catch (error) {
            this.platform.log.error(`Failed setting panel state to ${value}`, error);
        }
    }
}
