import {PartitionUpdate, ZoneUpdate} from "./nodeAlarmProxyTypes";
import envisalinkCodes = require('nodealarmproxy/envisalink.js');
import {Partition, Zone} from "./types";
import {PartitionConfig, ZoneConfig} from "./configTypes";

enum ChimeStatus {
    ChimeEnabled = "663",
    ChimeDisabled = "664"
}

export const transformZoneStatuses = (zoneConfigs: Map<string, ZoneConfig>, zoneStatuses: Map<string, ZoneUpdate>): Map<number, Zone> => {
    return Array.from(zoneStatuses).reduce((map, [zoneNumberString, zone]) => {
        const zoneNumber: number = +zoneNumberString;
        map.set(zoneNumber, transformZoneStatus(zoneConfigs, zoneNumber, zone));
        return map;
    }, new Map());
};

export const transformZoneStatus = (zoneConfigs: Map<string, ZoneConfig>, number: number, zone: ZoneUpdate): Zone => {
    const zoneConfig = zoneConfigs.get(`${number}`);
    if (!zoneConfig) {
        throw new Error(`Zone config is (${JSON.stringify(zoneConfig)}) for zone ${number}. Check config: ${JSON.stringify(zoneConfigs)}`);
    }
    const statusCode = zone.code && zone.code.length > 2 ? zone.code.substring(0, 3) : zone.code;
    const detailedStatus = envisalinkCodes.tpicommands[statusCode];
    return {
        name: zoneConfig.name,
        type: zoneConfig.type,
        number: number,
        partition: zoneConfig.partition,
        status: {
            shortCode: statusCode,
            longCode: zone.code,
            description: detailedStatus.name,
            text: detailedStatus.send,
            action: detailedStatus.action,
            verbSuffix: detailedStatus.post,
        }
    };
};

export const transformPartitionStatuses = (partitionConfigs: ReadonlyArray<PartitionConfig>, partitionStatuses: Map<string, PartitionUpdate>): ReadonlyArray<Partition> => {
    return Array.from(partitionStatuses).map(([numberString, partition]) => {
        const index: number = +numberString;
        return transformPartitionStatus(partitionConfigs, index, partition);
    }).sort((partitionA, partitionB) => partitionA.number - partitionB.number);
};

export const transformPartitionStatus = (partitionConfigs: ReadonlyArray<PartitionConfig>, number: number, partitionStatus: PartitionUpdate): Partition => {
    const partitionConfig = partitionConfigs[number - 1];
    const statusCode = partitionStatus.code && partitionStatus.code.length > 2 ? partitionStatus.code.substring(0, 3) : partitionStatus.code;
    const detailedStatus = envisalinkCodes.tpicommands[statusCode];
    const chimeEnabled: boolean | undefined = statusCode === ChimeStatus.ChimeEnabled ? true : statusCode === ChimeStatus.ChimeDisabled ? false : undefined;
    return {
        name: partitionConfig.name,
        number: number,
        enableChimeSwitch: partitionConfig.enableChimeSwitch || false,
        chimeActive: chimeEnabled,
        pin: partitionConfig.pin,
        status: {
            shortCode: statusCode,
            longCode: partitionStatus.code,
            description: detailedStatus.name,
            text: detailedStatus.send,
            action: detailedStatus.action,
            verbSuffix: detailedStatus.post,
            mode: partitionStatus.mode,
        }
    };
};