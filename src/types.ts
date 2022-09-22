export enum ZoneType {
    Door = "door",
    Window = "window",
    Leak = "leak",
    Smoke = "smoke",
    Motion = "motion",
}

//0: AWAY, 1: STAY, 2:  ZERO-ENTRY-AWAY, 3:  ZERO-ENTRY-STAY
export enum PartitionMode {
    Away = "away",
    Stay = "stay",
    AwayZeroEntry = "zero-entry-away",
    StayZeroEntry = "zero-entry-stay",
}

type Status = {
    shortCode: string; //610
    longCode: string; //6100082F
    description?: string; //Zone Alarm Restore
    text?: string; //restore
    action?: string; //updatezone
    verbSuffix?: string; //is restored.
}

export type ZoneStatus = | Status;

export type PartitionStatus = {
    mode?: PartitionMode;
} & Status;

export type Zone = {
    name: string;
    number: number;
    partition: number;
    type: ZoneType;
    status: ZoneStatus;
};

export type Partition = {
    name: string;
    number: number;
    status: PartitionStatus;
    enableChimeSwitch: boolean;
    chimeCommand: string;
    pin?: string;
    chimeActive?: boolean;
};