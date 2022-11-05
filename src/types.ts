export enum ZoneType {
    Door = 'door',
    Window = 'window',
    Leak = 'leak',
    Smoke = 'smoke',
    Motion = 'motion',
}

export const CONTACT_SENSORS = new Set([ZoneType.Door, ZoneType.Window]);

//0: AWAY, 1: STAY, 2:  ZERO-ENTRY-AWAY, 3:  ZERO-ENTRY-STAY
export enum PartitionMode {
    Away = 'away',
    Stay = 'stay',
    AwayZeroEntry = 'zero-entry-away',
    StayZeroEntry = 'zero-entry-stay',
}

type Status = {
    shortCode: string; //610
    longCode: string; //6100082F
    description?: string; //Zone Alarm Restore
    text?: string; //restore
    action?: string; //updatezone
    verbSuffix?: string; //is restored.
};

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
    bypassEnabled?: boolean;
    currentState?: number;
    targetState?: number;
};

export const ERROR_CODES: Map<string, string> = new Map([
    ['000', 'No Error'],
    ['001', 'Receive Buffer Overrun (a command is received while another is still being processed)'],
    ['002', 'Receive Buffer Overflow'],
    ['003', 'Transmit Buffer Overflow'],
    ['010', 'Keybus Transmit Buffer Overrun'],
    ['011', 'Keybus Transmit Time Timeout'],
    ['012', 'Keybus Transmit Mode Timeout'],
    ['013', 'Keybus Transmit Keystring Timeout'],
    ['014', 'Keybus Interface Not Functioning (the TPI cannot communicate with the security system)'],
    ['015', 'Keybus Busy (Attempting to Disarm or Arm with user code)'],
    ['016', 'Keybus Busy – Lockout (The panel is currently in Keypad Lockout – too many disarm attempts)'],
    ['017', 'Keybus Busy – Installers Mode (Panel is in installers mode, most functions are unavailable)'],
    ['018', 'Keybus Busy – General Busy (The requested partition is busy)'],
    ['020', 'API Command Syntax Error'],
    ['021', 'API Command Partition Error (Requested Partition is out of bounds)'],
    ['022', 'API Command Not Supported'],
    ['023', 'API System Not Armed (sent in response to a disarm command)'],
    ['024', 'API System Not Ready to Arm (system is either not-secure, in exit-delay, or already armed)'],
    ['025', 'API Command Invalid Length'],
    ['026', 'API User Code not Required'],
    ['027', 'API Invalid Characters in Command (no alpha characters are allowed except for checksum)'],
]);

export enum EnvisalinkStatusCode {
    Busy = '673',
    ChimeEnabled = '663',
    ChimeDisabled = '664',
    Ready = '650',
    NotReady = '651',
}