##Setup##

`npm install nodealarmproxy`

the `nap-example.js` shows a setup configuration.  Replace the init parameters with your own.

Available commands:

`initConfig(Object)` will create the server and a proxy for other things to connect to (Envisalink only allows one connection... this allows for multiple connections via proxy).  The object needs to be of the form:

    { password:'password', //required
        serverpassword:'serverpassword', //optional, will re-use password if not provided
        actualhost:config.host, //required
        actualport:config.port, //optional, will use default port if not provided
        serverhost:'0.0.0.0', //optional, will use '0.0.0.0' if not provided
        serverport:config.port, //optional, will use default port if not provided
        zone:7, //required, this is the number of sensors you have
        partition:1, //required, this is the number of partitions... usually 1
        proxyenable:true, //enable the proxy or not
        atomicEvents:false //optional, will default to false. If true, specific zone/partition/user events will be broadcast.
    }

`getCurrent()` will tell the nodealarmproxy to transmit the last known values.

`manualCommand(command)` will send a command to the Envisalink 3 (do not include the checksum).  Command will be a string based on the envisalink 3 third party interface.

Note:  If you don't want to run the proxy, set `proxyenable:false` or omit it entirely

Note:  My config file has:

    exports.password = '';  //Envisalink password
    exports.serverpassword=''; //Password you want for proxy server
    exports.host = '';  //host IP Address
    //exports.host = 'localhost';
    exports.port = 4025;
    exports.app_id = ""; //smartthings app_id
    exports.access_token = ""; //smartthings access_token

Changes were mostly done to the `nap-example.js`, however if you're adding SmartThings integration... you'll need to setup your own app by following instructions similar to this (I've contributed to this project as well)... [smartthings-dsc-alarm](https://github.com/kholloway/smartthings-dsc-alarm)