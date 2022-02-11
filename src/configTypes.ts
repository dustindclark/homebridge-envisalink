import {PlatformConfig} from "homebridge";
import {ZoneType} from './types';

export type PartitionConfig = {
    name: string;
    enableChimeSwitch?: boolean;
    chimeCommandOverride?: string;
    pin?: string;
};

export type ZoneConfig = {
    name: string;
    partition: number;
    zoneNumber: number;
    type: ZoneType;
};

export type PanicConfig = {
    enabled: boolean;
    name: string;
};

export type CustomCommandConfig = {
    name: string;
    command: string;
};

export type EnvisalinkConfig = {
    host: string;
    password: string;
    port: number,
    proxyPort: number;
    pin: string;
    suppressZoneAccessories: boolean;
    suppressClockReset: boolean;
    policePanic: PanicConfig;
    ambulancePanic: PanicConfig;
    firePanic: PanicConfig;
    partitions: ReadonlyArray<PartitionConfig>;
    zones: ReadonlyArray<ZoneConfig>;
    customCommands: ReadonlyArray<CustomCommandConfig>;
    enableVerboseLogging: boolean;
} & PlatformConfig;