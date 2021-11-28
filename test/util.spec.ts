import {
    transformPartitionStatus,
    transformPartitionStatuses,
    transformZoneStatus,
    transformZoneStatuses
} from '../src/util';
import {PartitionConfig, ZoneConfig} from "../src/configTypes";
import {ZoneUpdate} from "../dist/nodeAlarmProxyTypes";
import {ZoneType} from "../dist/types";
import {PartitionUpdate} from "../src/nodeAlarmProxyTypes";
import {PrepareStreamResponse} from "homebridge";


describe('Zone', () => {
    it('Transform Status', () => {
        const zoneConfigs: Map<string, ZoneConfig> = new Map([
            ["1", {"name": "Zone 1", type: "motion", partition: 2} as ZoneConfig]
        ]);
        const zoneUpdate = {
            zone: 1,
            code: "610"
        } as ZoneUpdate;
        const result = transformZoneStatus(zoneConfigs, 1, zoneUpdate);
        expect(result).toBeTruthy();
        expect(result!.number).toEqual(1);
        expect(result!.partition).toEqual(2);
        expect(result!.type).toEqual(ZoneType.Motion);
        expect(result!.name).toEqual("Zone 1");
        expect(result!.status).toBeTruthy();
        expect(result!.status.action).toEqual("updatezone");
        expect(result!.status.description).toEqual("Zone Restore");
        expect(result!.status.shortCode).toEqual("610");
        expect(result!.status.text).toEqual("openrestore");
        expect(result!.status.verbSuffix).toEqual("is restored");
    });

    it('Transform Statuses', () => {
        const zoneConfigs: Map<string, ZoneConfig> = new Map([
            ["1", {name: "Zone 1", type: "motion", partition: 2} as ZoneConfig],
            ["2", {name: "Zone 2", type: "door", partition: 2} as ZoneConfig]
        ]);
        const zoneUpdates = new Map([
            ["1", {zone: 1, code: "610"} as ZoneUpdate],
            ["2", {zone: 2, code: "609"} as ZoneUpdate],
        ]) as Map<string, ZoneUpdate>;

        const result = transformZoneStatuses(zoneConfigs, zoneUpdates);
        expect(result).toBeTruthy();
        expect(result.get(1)).toBeTruthy();
        expect(result.get(1)!.name).toEqual("Zone 1");
        expect(result.get(1)!.status).toBeTruthy();
        expect(result.get(1)!.status.text).toEqual("openrestore")
        expect(result.get(2)).toBeTruthy();
        expect(result.get(2)!.name).toEqual("Zone 2");
        expect(result.get(2)!.status).toBeTruthy();
        expect(result.get(2)!.status.text).toEqual("open")
    });
});

describe('Partition', () => {
    it('Transform Status', () => {
        const partitionConfigs: ReadonlyArray<PartitionConfig> = [
            {name: "Partition 1", enableChimeSwitch: true}
        ];
        const partitionUpdate = {
            partition: 1,
            code: "650"
        } as PartitionUpdate;
        const result = transformPartitionStatus(partitionConfigs, 1, partitionUpdate);
        expect(result).toBeTruthy();
        expect(result.number).toEqual(1);
        expect(result.name).toEqual("Partition 1");
        expect(result.status).toBeTruthy();
        expect(result.enableChimeSwitch).toEqual(true);
        expect(result.status.action).toEqual("updatepartition");
        expect(result.status.description).toEqual("Partition Ready");
        expect(result.status.shortCode).toEqual("650");
        expect(result.status.text).toEqual("ready");
        expect(result.status.verbSuffix).toEqual("Ready");
    });

    it('Transform Statuses', () => {
        const partitionConfigs: ReadonlyArray<PartitionConfig> = [
            {name: "Partition 1"},
            {name: "Partition 2", enableChimeSwitch: true}
        ];
        const partitionUpdates = new Map([
            ["1", {partition: 1, code: "650"} as PartitionUpdate],
            ["2", {partition: 2, code: "651"} as PartitionUpdate],
        ]) as Map<string, ZoneUpdate>;

        const result = transformPartitionStatuses(partitionConfigs, partitionUpdates);
        expect(result).toBeTruthy();
        expect(result.length).toEqual(2);
        expect(result[0]).toBeTruthy();
        expect(result[0].name).toEqual("Partition 1");
        expect(result[0].status).toBeTruthy();
        expect(result[0].status.text).toEqual("ready");
        expect(result[0].enableChimeSwitch).toEqual(false);
        expect(result[1]).toBeTruthy();
        expect(result[1].name).toEqual("Partition 2");
        expect(result[1].status).toBeTruthy();
        expect(result[1].enableChimeSwitch).toEqual(true);
        expect(result[1].status.text).toEqual("notready");
    });
});