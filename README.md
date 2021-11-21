# homebridge-envisalink
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![NPM Version](https://img.shields.io/npm/v/homebridge-envisalink.svg)](https://www.npmjs.com/package/homebridge-envisalink)

This Homebridge plugin adds an Envisalink panel and its sensors into HomeKit.
Alarm Panel can be armed (home/away) or disarmed by using Siri or the HomeKit app of your
choice.  Sensors can also be used for automations (i.e. turn on light when door opens).

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
          "name": "Alarm"
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
          "name": "Chime Toggle - Partition 1",
          "command": "0711*4"
        },
        {
          "name": "System Test",
          "command": "071*600004"
        }
      ]
    }
  ]
```

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
See documentation in "docs" folder for crafting a custom command. Examples above are real DSC commands.

<br />
*Note*: Only DSC panels have been tested thus far.  If you'd like to provide a Honeywell device for testing, I'd be glad to add support for this device and ship it back to you.

## Credits
This plugin leverages [Node Alarm Proxy](https://www.npmjs.com/package/nodealarmproxy)
in order to HomeKit/HomeBridge enable the Envisalink device.