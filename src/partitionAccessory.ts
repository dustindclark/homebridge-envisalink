import {CharacteristicValue, PlatformAccessory} from 'homebridge';

import {EnvisalinkHomebridgePlatform} from './platform';
import {MANUFACTURER, MODEL,} from './constants';
import {Partition, PartitionMode} from "./types";

const STAY_MODES: ReadonlySet<PartitionMode> = new Set([PartitionMode.Stay, PartitionMode.StayZeroEntry]);
const CHIME_SERVICE_NAME = 'Chime';

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
        this.bindChimeSwitch();
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

    bindChimeSwitch() {
        if (!this.partition.enableChimeSwitch) {
            return false;
        }
        const chimeService = this.accessory.getService(CHIME_SERVICE_NAME) ||
            this.accessory.addService(this.platform.Service.Switch, CHIME_SERVICE_NAME, `${this.partition.number}-Chime`);
        chimeService.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setChimeActive.bind(this));
        chimeService.updateCharacteristic(this.platform.Characteristic.On,
            this.partition.chimeActive == undefined ? false : this.partition.chimeActive);
    }

    async setChimeActive(value: CharacteristicValue) {
        try {
            this.platform.log.debug(`setChimeActive to ${value} for partition ${this.partition.number}`);
            await this.platform.sendAlarmCommand(`071${this.partition.number}*4`);
            this.platform.log.debug(`setChimeActive complete.`);
        } catch (error) {
            this.platform.log.error(`Failed setting chime active to ${value}`, error);
        }
    }



    bindSecurityPanel() {
        const service = this.accessory.getService(this.platform.Service.SecuritySystem)
            || this.accessory.addService(this.platform.Service.SecuritySystem);
        service.setCharacteristic(this.platform.Characteristic.Name, this.partition.name);
        let targetState: number | undefined = undefined;
        let currentState: number | undefined = undefined;
        let obstructionDetected = false;
        switch (this.partition.status.text) {
            case 'alarm':
                currentState = this.platform.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
                break;
            case 'partialclosing':
            case 'specialclosing':
            case 'armed':
            case 'armedbypass':
                this.platform.log.debug(`System is armed. Mode: ${this.partition.status.mode}`);
                if (this.partition.status.mode && STAY_MODES.has(this.partition.status.mode)) {
                    currentState = this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM;
                    targetState = this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM;
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
                targetState = this.platform.Characteristic.SecuritySystemTargetState.DISARM;
                obstructionDetected = true;
                break;
            case 'exitdelay':
            case 'entrydelay':
            case 'arming':
            case 'busy':
                break;
            default:
                currentState = this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
                targetState = this.platform.Characteristic.SecuritySystemTargetState.DISARM;
        }

        if (currentState != undefined) {
            service.updateCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState,
                currentState);
        }
        if (targetState != undefined) {
            service.updateCharacteristic(this.platform.Characteristic.SecuritySystemTargetState,
                targetState);
        }
        service.updateCharacteristic(this.platform.Characteristic.ObstructionDetected,
            obstructionDetected);

        service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
            .onSet(this.setPanelState.bind(this));
    }

    async setPanelState(value: CharacteristicValue) {
        try {
            this.platform.log.debug(`setPanelState to ${value} for partition ${this.partition.number}`);
            let command : string | undefined = undefined;
            switch(value) {
                case this.platform.Characteristic.SecuritySystemCurrentState.DISARMED:
                    command = `040${this.partition.number}${this.partition.pin}`;
                    break;
                case this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM:
                    command = `031${this.partition.number}`;
                    break;
                case this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM:
                    command = `032${this.partition.number}${this.partition.pin}`;
                    break;
                case this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM:
                    command = `030${this.partition.number}`;
                    break;
            }
            if (command == undefined) {
                this.platform.log.error(`Unhandled alarm state ${value}. Ignoring command.`);
                return;
            }
            await this.platform.sendAlarmCommand(command);
            this.platform.log.debug(`Successfully set alarm panel state to ${value} on partition ${this.partition.number}`);
        } catch (error) {
            this.platform.log.error(`Failed setting panel state to ${value}`, error);
        }
    }
}
