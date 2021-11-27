import {PlatformAccessory, Service} from 'homebridge';

import {EnvisalinkHomebridgePlatform} from './platform';
import {MANUFACTURER, MODEL,} from './constants';
import {Zone, ZoneType} from "./types";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class EnvisalinkZoneAccessory {
    private service: Service;
    private zone: Zone;

    constructor(
        private readonly platform: EnvisalinkHomebridgePlatform,
        private readonly accessory: PlatformAccessory,
    ) {

        this.zone = this.accessory.context as Zone;

        this.platform.log.debug(`Setting accessory details for zone: ${JSON.stringify(this.zone, null, 2)}`);

        const serialNumber = `Partition ${this.zone.partition} Zone ${this.zone.number}`;

        const infoService = this.accessory.getService(this.platform.Service.AccessoryInformation);
        if (infoService) {
            infoService.setCharacteristic(this.platform.Characteristic.Manufacturer, MANUFACTURER)
                .setCharacteristic(this.platform.Characteristic.Model, MODEL)
                .setCharacteristic(this.platform.Characteristic.SerialNumber, serialNumber);
        }

        switch (this.zone.type) {
            case ZoneType.Motion:
                this.service = this.bindMotion();
                break;
            case ZoneType.Leak:
                this.service = this.bindLeak();
                break;
            case ZoneType.Smoke:
                this.service = this.bindSmoke();
                break;
            default:
                this.service = this.bindContact();
                break;
        }

    }

    bindContact(): Service {
        this.platform.log.debug(`${this.zone.name} is a contact sensor. Binding.`);
        const service = this.accessory.getService(this.platform.Service.ContactSensor)
            || this.accessory.addService(this.platform.Service.ContactSensor);
        service.setCharacteristic(this.platform.Characteristic.Name, this.zone.name);

        service.updateCharacteristic(this.platform.Characteristic.ContactSensorState,
            this.zone.status.text === 'open' ? this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
                : this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED);
        return service;
    }

    bindMotion(): Service {
        this.platform.log.debug(`${this.zone.name} is a motion sensor. Binding.`);
        const service = this.accessory.getService(this.platform.Service.MotionSensor)
            || this.accessory.addService(this.platform.Service.MotionSensor);
        service.setCharacteristic(this.platform.Characteristic.Name, this.zone.name);

        service.updateCharacteristic(this.platform.Characteristic.MotionDetected,
            this.zone.status.text === 'open');
        return service;
    }

    bindLeak(): Service {
        this.platform.log.debug(`${this.zone.name} is a leak sensor. Binding.`);
        const service = this.accessory.getService(this.platform.Service.LeakSensor)
            || this.accessory.addService(this.platform.Service.LeakSensor);
        service.setCharacteristic(this.platform.Characteristic.Name, this.zone.name);

        service.updateCharacteristic(this.platform.Characteristic.LeakDetected,
            this.zone.status.text === 'open');
        return service;
    }

    bindSmoke(): Service {
        this.platform.log.debug(`${this.zone.name} is a smoke sensor. Binding.`);
        const service = this.accessory.getService(this.platform.Service.SmokeSensor)
            || this.accessory.addService(this.platform.Service.SmokeSensor);
        service.setCharacteristic(this.platform.Characteristic.Name, this.zone.name);

        service.updateCharacteristic(this.platform.Characteristic.SmokeDetected,
            this.zone.status.text === 'open');
        return service;
    }
}
