import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';

import {EnvisalinkHomebridgePlatform} from './platform';
import {MANUFACTURER, MODEL} from './constants';
import {EnvisalinkConfig} from './configTypes';

enum PanicType {
    Fire = 1,
    Ambulance = 2,
    Police = 3
}

const PANIC_SERVICE_NAME = 'panic';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class EnvisalinkPanicAccessory {
    constructor(
        private readonly platform: EnvisalinkHomebridgePlatform,
        private readonly accessory: PlatformAccessory,
        private readonly config: EnvisalinkConfig,
    ) {
        if (config.firePanic?.enabled) {
            this.bindPanicSwitch(PanicType.Fire, config.firePanic.name);
        }

        if (config.ambulancePanic?.enabled) {
            this.bindPanicSwitch(PanicType.Ambulance, config.ambulancePanic.name);
        }

        if (config.policePanic?.enabled) {
            this.bindPanicSwitch(PanicType.Police, config.policePanic.name);
        }
    }

    bindPanicSwitch(panicType: PanicType, name: string): void {
        const infoService = this.accessory.getService(this.platform.Service.AccessoryInformation);
        if (infoService) {
            infoService.setCharacteristic(this.platform.Characteristic.Manufacturer, MANUFACTURER)
                .setCharacteristic(this.platform.Characteristic.Model, MODEL)
                .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Panic');
        }
        const panicTypeString = PanicType[panicType];
        const panicServiceId = `${PANIC_SERVICE_NAME}.${panicTypeString}`;
        const panicService = this.accessory.getService(panicServiceId) ||
            this.accessory.addService(this.platform.Service.Switch, name || `${panicTypeString} Panic`, panicServiceId );
        panicService.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.activatePanic.bind(this, panicType, panicService));
        panicService.updateCharacteristic(this.platform.Characteristic.On,
            false);
    }

    async activatePanic(panicType: PanicType, service: Service, value: CharacteristicValue) {
        try {
            if (value as boolean) {
                this.platform.log.warn(`Activating panic alarm. Panic Type: ${PanicType[panicType]}`);
                await this.platform.sendAlarmCommand(`060${panicType}`);
            } else if (panicType === PanicType.Fire) {
                this.platform.log.warn('Panic alarm switched off. Attempting disarm on partition 1.');
                await this.platform.sendAlarmCommand(`0401${this.config.pin}`);
            } else {
                this.platform.log.info('Ignoring disarm panic because only fire alarms can be disarmed.');
            }
            service.updateCharacteristic(this.platform.Characteristic.On, value);
        } catch (error) {
            this.platform.log.error('Failed activating panic alarm', error);
        }
    }
}
