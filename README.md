# homebridge-envisalink
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![NPM Version](https://img.shields.io/npm/v/homebridge-envisalink.svg)](https://www.npmjs.com/package/homebridge-envisalink)

This Homebridge plugin adds an Envisalink panel and its sensors into HomeKit.
Alarm Panel can be armed (home/away) or disarmed by using Siri or the HomeKit app of your
choice.  Sensors can also be used for automations (i.e. turn on light when door opens).

This plugin has been tested with both Envisalink 3 and Envisalink 4. Envisalink 3 firmware
should be upgraded to 1.12.182 or higher.

##Installation
Example configuration is below.  See [config.schema.json](./blob/master/config.schema.json) for more info, including valid values.

```javascript
 "platforms": [
    {
      "platform": "Envisalink",
      "host": "192.168.0.XXX",
      "deviceType": "DSC",
      "password": "---envisalink password (default is user)---",
      "pin": "---panel pin for disarming---",
      "suppressZoneAccessories": false,
      "suppressClockReset": false,
      "ambulancePanic": {
          "enabled": true,
          "name": "Ambulance Panic"
      },
      "firePanic": {
          "enabled": true,
          "name": "Fire Panic"
      },
      "policePanic": {
          "enabled": true,
          "name": "Police Panic"
      },
      "partitions": [
        {
          "name": "Alarm",
          "enableChimeSwitch": true,
          "pin": "1243"
        }
      ],
      "zones": [
        {
          "name": "Front Door",
          "type": "door",
          "partition": 1
        },
        {
          "name": "Master Bedroom Door",
          "type": "door",
          "partition": 1
        },
        {
          "name": "Downstairs Windows",
          "type": "window",
          "partition": 1
        },
        {
          "name": "Basement Leak",
          "type": "leak",
          "partition": 1
        },
        {
          "name": "Upstairs Smoke",
          "type": "smoke",
          "partition": 1
        },
        {
          "name": "Living Room Motion",
          "type": "motion",
          "partition": 1
        }
      ],
      "customCommands": [
        {
          "name": "System Test",
          "command": "071*600004"
        }
      ]
    }
  ]
```

## Password

The password field is the password you use to login to the Envislink locally.
In order the find/change this password, access the IP address of your Envisalink in a browser.
The password that you use to login is the password that should be used here. Default is 'user'
but should be changed in settings for security.

##Home vs. Night
DSC does not distinguish between these 2 arm modes that are provided in HomeKit. The behavior of the plugin
(as of 1.1.0) is as follows:

- *Home*: Arm to stay with entry delay.
- *Night*: Arm to stay with no entry delay (if any door is opened, alarm will immediately sound)

## Advanced Config
### Disabling Clock Reset
This plugin will update the date/time of your alarm system hourly unless you set "suppressClockReset" to true in the config.

### Non-Consecutive Zones
If your system has unused zones, simply include a *zoneNumber* integer property on ***each*** zone you have in the config. Make sure you put the property on each zone.

Ex:
```javascript
...
"zones": [
  {
    "name": "Front Entry",
    "type": "door",
    "partition": 1,
    "zoneNumber": 1
  },
  {
    "name": "Patio Door",
    "type": "door",
    "partition": 1,
    "zoneNumber": 2
  },
  {
    "name": "Garage Door",
    "type": "door",
    "partition": 1,
    "zoneNumber": 5
  }
]
...
```

### Custom Commands
See documentation in "docs" folder for crafting a custom command. Examples above are real DSC commands. Checksum will the added automatically. Do not suffix with checksum.

<br />
*Note*: I have only tested with DSC panels. This should work with Honeywell devices since the Envisalink API is the same, but this has not been tested. 

### PINs
By default, all partitions use the same top level PIN. You can override this PIN at the partition level config. 

## Credits
This plugin leverages [Node Alarm Proxy](https://www.npmjs.com/package/nodealarmproxy)
in order to HomeKit/HomeBridge enable the Envisalink device.