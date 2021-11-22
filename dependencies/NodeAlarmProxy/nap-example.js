var nap = require('./nodealarmproxy.js');
var config = require('./config.js'); //comment this out
if (config.access_token && config.app_id) {
	//SmartThings is setup/enabled
	var https = require('https');
}

var alarm = nap.initConfig({ password:config.password, //replace config.* with appropriate items
	serverpassword:config.serverpassword,
	actualhost:config.host,
	actualport:config.port,
	serverhost:'0.0.0.0',
	serverport:config.port,
	zone:7,
	partition:1,
	proxyenable:true,
	atomicEvents:true
});

var watchevents = ['601','602','609','610','650','651','652','654','656','657'];

alarm.on('data', function(data) {
	console.log('npmtest data:',data);
});

alarm.on('zone', function(data) {
	console.log('npmtest zoneupdate:',data);
	if (watchevents.indexOf(data.code) != -1) {
		var smartURL = "https://graph.api.smartthings.com/api/smartapps/installations/"+config.app_id+"/panel/"+data.code+"/zone"+data.zone+"?access_token="+config.access_token;
		console.log('smartURL:',smartURL);
		https.get(smartURL, function(res) {
			console.log("Got response: " + res.statusCode);
		}).on('error', function(e) {
			console.log("Got error: " + e.message);
		});
	}
});

alarm.on('partition', function(data) {
	console.log('npmtest partitionupdate:',data);
	if (watchevents.indexOf(data.code) != -1) {	
		var smartURL = "https://graph.api.smartthings.com/api/smartapps/installations/"+config.app_id+"/panel/"+data.code+"/partition"+data.partition+"?access_token="+config.access_token;
		console.log('smartURL:',smartURL);
		https.get(smartURL, function(res) {
			console.log("Got response: " + res.statusCode);
		}).on('error', function(e) {
			console.log("Got error: " + e.message);
		});
	}
});