# homebridge-envisalink

This is a homebridge plugin leverages Node Alarm Proxy (https://www.npmjs.com/package/nodealarmproxy) in order to HomeKit/HomeBridge enable the Envisalink device.  Example configuration is below:

```javascript
 "platforms": [
    {
      "platform": "Envisalink",
      "host": "192.168.0.XXX",
      "deviceType": "DSC",
      "password": "---envisalink password (default is user)---",
      "pin": "---panel pin for disarming---",
      "suppressZoneAccessories": false,
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
          "name": "Upstairs Windows",
          "type": "window",
          "partition": 1
        },
        {
          "name": "Back Door",
          "type": "door",
          "partition": 1
        },
        {
          "name": "Living Room Motion",
          "type": "motion",
          "partition": 1
        }
      ]
    }
  ]
```

Only DSC panels have been tested thus far.  If you'd like to provide a Honeywell device for testing, I'd be glad to add support for this device and ship it back to you.