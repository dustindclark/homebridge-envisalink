# homebridge-envisalink

This is a homebridge plugin leverages Node Alarm Proxy (https://www.npmjs.com/package/nodealarmproxy) in order to HomeKit/HomeBridge enable the Envisalink device.  Example configuration is below:

```javascript
"accessories" : [
        {
                "accessory": "Envisalink",
                "name": "Alarm Partition 1",
                "host": "x.x.x.x",
                "deviceType": "DSC",
                "password": "***",
                "pin": "***",
                "partition": "1",
                "zones": 7
        }
]
```

Only DSC panels have been tested thus far.  If you'd like to provide a Honeywell device for testing, I'd be glad to add support for this device and ship it back to you.

Additionally, only arm/disarm support is currently enabled.  More features (i.e. zone accessories) are coming soon.