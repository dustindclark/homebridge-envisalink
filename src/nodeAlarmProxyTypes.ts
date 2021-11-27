import {PartitionMode} from "./types";

export type AreaUpdate = {
    send?: string;
    name?: string;
    code: string;
};

export type ZoneUpdate = {
    zone?: number;
} & AreaUpdate;

export type PartitionUpdate = {
    partition?: number;
    armMode?: PartitionMode;
} & AreaUpdate;

export interface NodeAlarmProxy {
    (command: string, callback: () => void): void;
}