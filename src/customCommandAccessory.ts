import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';

import {EnvisalinkHomebridgePlatform} from './platform';
import {MANUFACTURER, MODEL,} from './constants';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class EnvisalinkCustomCommandAccessory {
    private readonly service: Service;

    constructor(
        private readonly platform: EnvisalinkHomebridgePlatform,
        private readonly accessory: PlatformAccessory,
        private readonly name: string,
        private readonly command: string,
    ) {
        const infoService = this.accessory.getService(this.platform.Service.AccessoryInformation);
        if (infoService) {
            infoService.setCharacteristic(this.platform.Characteristic.Manufacturer, MANUFACTURER)
                .setCharacteristic(this.platform.Characteristic.Model, MODEL)
                .setCharacteristic(this.platform.Characteristic.SerialNumber, command);
        }
        this.service = this.accessory.getService(this.platform.Service.Switch) ||
            this.accessory.addService(this.platform.Service.Switch, this.name);
        this.service.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.invokeCommand.bind(this));
        this.service.updateCharacteristic(this.platform.Characteristic.On,
            false);
    }

    async invokeCommand(value: CharacteristicValue) {
        try {
            if (value as boolean) {
                this.platform.log.debug(`Invoking custom command: ${this.command}`);
                await this.platform.sendAlarmCommand(this.command);
            } else {
                this.platform.log.debug('Ignoring false value for custom command');
            }
        } catch (error) {
            this.platform.log.error('Failed invoking custom command', error);
        } finally {
            // Wait a second. Update doesn't work otherwise?
            setTimeout(() => {
                this.service.updateCharacteristic(this.platform.Characteristic.On, false);
            }, 1000);
        }
        return false;
    }
}
