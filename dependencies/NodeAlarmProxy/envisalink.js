exports.applicationcommands = {
  '000' : {
    'name':'Poll',
    'pre':'Polled',
    'bytes':0,
    'post':'',
    'send':'500000',
    'action':'forward'
  },
  '001' : {
    'name':'Status Report',
    'pre':'Status Report Requested',
    'bytes':0,
    'post':'',
    'send':'500001',
    'action':'forward'
  },
  '008' : {
    'name':'Dump Zone Timers',
    'pre':'Request Dump of Zone Timers',
    'bytes':0,
    'post':'',
    'send':'500008',
    'action':'forward'
  },
  '005' : {
    'name':'Network Login',
    'pre':'Checking password...',
    'bytes':'1-6',
    'post':'',
    'send':'500005',
    'action':'checkpassword'
  },
  '010' : {
    'name':'Set Time and Date',
    'pre':'Setting time and date to:',
    'bytes':10,
    'post':'',
    'send':'500010',
    'action':'forward'
  },
  '020' : {
    'name':'Command Output Control',
    'pre':'Activating',
    'bytes':2,
    'post':'Command Output',
    'send':'500020',
    'action':'forward'
  },
  '030' : {
    'name':'Partition Arm Control',
    'pre':'Arming Partition',
    'bytes':1,
    'post':'',
    'send':'500030',
    'action':'forward'
  },
  '031' : {
    'name':'Partition Arm Control - Stay Arm',
    'pre':'Arming Partition',
    'bytes':1,
    'post':'to STAY.',
    'send':'500031',
    'action':'forward'
  },
  '032' : {
    'name':'Partition Arm Control - Zero Entry Delay',
    'pre':'Arming Partition',
    'bytes':1,
    'post':'with ZERO Entry Delay',
    'send':'500032',
    'action':'forward'
  },
  '033' : {
    'name':'Partition Arm Control - With Code',
    'pre':'Arming Parition',
    'bytes':7,
    'post':'with Code',
    'send':'500033',
    'action':'forward'
  },
  '040' : {
    'name':'Partition Disarm Control',
    'pre':'Disarming Partition',
    'bytes':7,
    'post':'',
    'send':'500040',
    'action':'forward'
  },
  '055' : {
    'name':'Time Stamp Control',
    'pre':'Time Stamp Control to:',
    'bytes':1,
    'post':'',
    'send':'500055',
    'action':'forward'
  },
  '056' : {
    'name':'Time Broadcast Control',
    'pre':'Time Broadcast Control to:',
    'bytes':1,
    'post':'',
    'send':'500056',
    'action':'forward'
  },
  '057' : {
    'name':'Temperature Broadcast Control',
    'pre':'Temperature Broadcast Control to:',
    'bytes':1,
    'post':'',
    'send':'500057',
    'action':'forward'
  },
  '060' : {
    'name':'Trigger Panic Alarm',
    'pre':'TRIGGERING PANIC ALARM:',
    'bytes':1,
    'post':'',
    'send':'500060',
    'action':'forward'
  },
  '070' : {
    'name':'Single Keystroke - Partition 1',
    'pre':'Partition 1 keystroke:',
    'bytes':1,
    'post':'requested.',
    'send':'500070',
    'action':'forward'
  },
  '071' : {
    'name':'Send Keystroke String',
    'pre':'Paritition 1 keystroke string:',
    'bytes':'2-7',
    'post':'requested',
    'send':'500071',
    'action':'forward'
  },
  '072' : {
    'name':'Enter User Code Programming (*5)',
    'pre':'User Code Programming',
    'bytes':1,
    'post':'requested.',
    'send':'500072',
    'action':'forward'
  },
  '073' : {
    'name':'Enter User Programming (*6)',
    'pre':'User Programming',
    'bytes':1,
    'post':'requested.',
    'send':'500073',
    'action':'forward'
  },
  '074' : {
    'name':'Keep Alive',
    'pre':'Keeping Alive Partition',
    'bytes':1,
    'post':'.',
    'send':'500074',
    'action':'forward'
  },
  '200' : {
    'name':'Code Send',
    'pre':'Send',
    'bytes':'4-6',
    'post':'Code in Response to Request',
    'send':'500200',
    'action':'forward'
  }
}
 
exports.tpicommands = {
  '500' : {
    'name':'Command Acknowledge',
    'pre':'Command',
    'bytes':3,
    'post':'Acknowledged',
    'send':'',
    'action':'command-completed'
  },
  '501' : {
    'name':'Command Error',
    'pre':'Bad Checksum Received',
    'bytes':0,
    'post':'',
    'send':'',
    'action': 'command-error'
  },
  '502' : {
    'name':'System Error',
    'pre':'System Error',
    'bytes':3,
    'post':'has been detected.',
    'send':'',
    'action':'command-error'
  },
  '505' : {
    'name':'Login Interaction',
    'pre':'Login Request Response:',
    'bytes':1,
    'post':'',
    'send':'',
    'action':'loginresponse'
  },
  '510' : {
    'name':'Keypad LED State - Partition 1 Only',
    'pre':'Keypad LED State:',
    'bytes':2,
    'post':'',
    'send':'',
    'action':''
  },
  '511' : {
    'name':'Keypad LED FLASH State - Partition 1 Only',
    'pre':'Keypad LED Flash State:',
    'bytes':2,
    'post':'',
    'send':'',
    'action':''
  },
  '550' : {
    'name':'Time/Date Broadcast',
    'pre':'The Time/Date is:',
    'bytes':10,
    'post':'',
    'send':'',
    'action':''
  },
  '560' : {
    'name':'Ring Detected',
    'pre':'Panel has detected a ring on phone line.',
    'bytes':0,
    'post':'',
    'send':'',
    'action':''
  },
  '561' : {
    'name':'Indoor Temperature Broadcast',
    'pre':'Indoor Temperature is:',
    'bytes':4,
    'post':'',
    'send':'',
    'action':''
  },
  '562' : {
    'name':'Outdoor Temperature Broadcast',
    'pre':'Outdoor Temperature is:',
    'bytes':4,
    'post':'',
    'send':'',
    'action':''
  },
  '601' : {
    'name':'Zone Alarm',
    'pre':'Zone',
    'bytes':4,
    'post':'has gone into alarm',
    'send':'alarm',
    'action':'updatezone'
  },
  '602' : {
    'name':'Zone Alarm Restore',
    'pre':'Zone',
    'bytes':4,
    'post':'has been restored',
    'send':'alarmrestore',
    'action':'updatezone'
  },
  '603' : {
    'name':'Zone Tamper',
    'pre':'Zone',
    'bytes':4,
    'post':'has been tampered with',
    'send':'tamper',
    'action':'updatezone'
  },
  '604' : {
    'name':'Zone Tamper Restore',
    'pre':'Zone',
    'bytes':4,
    'post':'tamper condition has been restored',
    'send':'tamperrestore',
    'action':'updatezone'
  },
  '605' : {
    'name':'Zone Fault',
    'pre':'Zone',
    'bytes':3,
    'post':'has a fault condition',
    'send':'fault',
    'action':'updatezone'
  },
  '606' : {
    'name':'Zone Fault Restore',
    'pre':'Zone',
    'bytes':3,
    'post':'fault condition has been restored',
    'send':'faultrestore',
    'action':'updatezone'
  },
  '609' : {
    'name':'Zone Open',
    'pre':'Zone',
    'bytes':3,
    'post':'is open',
    'send':'open',
    'action':'updatezone'
  },
  '610' : {
    'name':'Zone Restore',
    'pre':'Zone',
    'bytes':4,
    'post':'is restored',
    'send':'openrestore',
    'action':'updatezone'
  },
  '615' : {
    'name':'Envisalink Zone Timer Dump',
    'pre':'Zone Timer Dump:',
    'bytes':256,
    'post':'',
    'send':'',
    'action':''
  },
  '620' : {
    'name':'Duress Alarm',
    'pre':'Duress Alarm Received:',
    'bytes':4,
    'post':'',
    'send':'duress',
    'action':'updatesystem'
  },
  '621' : {
    'name':'Fire Key Alarm',
    'pre':'Fire key alarm has been activated',
    'bytes':0,
    'post':'',
    'send':'firekeyalarm',
    'action':'updatesystem'
  },
  '622' : {
    'name':'Fire Key Restore',
    'pre':'Fire key alarm has been restored',
    'bytes':0,
    'post':'',
    'send':'firekeyrestore',
    'action':'updatesystem'
  },
  '623' : {
    'name':'Auxiliary Key Alarm',
    'pre':'Auxiliary key alarm has been activated',
    'bytes':0,
    'post':'',
    'send':'auxkeyalarm',
    'action':'updatesystem'
  },
  '624' : {
    'name':'Auxiliary Key Restore',
    'pre':'Auxiliary key alarm has been restored',
    'bytes':0,
    'post':'',
    'send':'auxkeyrestore',
    'action':'updatesystem'
  },
  '625' : {
    'name':'Panic Key Alarm',
    'pre':'Panic key alarm has been activated',
    'bytes':0,
    'post':'',
    'send':'panickeyalarm',
    'action':'updatesystem'
  },
  '626' : {
    'name':'Panic Key Restore',
    'pre':'Panic key alarm has been restored',
    'bytes':0,
    'post':'',
    'send':'panickeyrestore',
    'action':'updatesystem'
  },
  '631' : {
    'name':'2-Wire Smoke/Aux Alarm',
    'pre':'2-Wire Smoke/Aux alarm has been activated',
    'bytes':0,
    'post':'',
    'send':'twowiresmokealarm',
    'action':'updatesystem'
  },
  '632' : {
    'name':'2-Wire Smoke/Aux Restore',
    'pre':'2-Wire Smoke/Aux alarm has been restore',
    'bytes':0,
    'post':'',
    'send':'twowiresmokerestore',
    'action':'updatesystem'
  },
  '650' : {
    'name':'Partition Ready',
    'pre':'Partition',
    'bytes':1,
    'post':'Ready',
    'send':'ready',
    'action':'updatepartition'
  },
  '651' : {
    'name':'Partition Not Ready',
    'pre':'Partition',
    'bytes':1,
    'post':'is NOT Ready',
    'send':'notready',
    'action':'updatepartition'
  },
  '652' : {
    'name':'Partition Armed',
    'pre':'Partition',
    'bytes':1,
    'post':'is Armed',
    'send':'armed',
    'action':'updatepartition'
  },
  '653' : {
    'name':'Partition Ready - Force Arming Enabled',
    'pre':'Partition',
    'bytes':1,
    'post':'is Ready and Force Arming is Enabled',
    'send':'readyforce',
    'action':'updatepartition'
  },
  '654' : {
    'name':'Partition In Alarm',
    'pre':'Partition',
    'bytes':1,
    'post':'IS IN ALARM!',
    'send':'alarm',
    'action':'updatepartition'
  },
  '655' : {
    'name':'Partition Disarmed',
    'pre':'Partition',
    'bytes':1,
    'post':'has been Disarmed',
    'send':'disarmed',
    'action':'updatepartition'
  },
  '656' : {
    'name':'Exit Delay in Progress',
    'pre':'Exit Delay of Partition',
    'bytes':1,
    'post':'in Progress',
    'send':'exitdelay',
    'action':'updatepartition'
  },
  '657' : {
    'name':'Entry Delay in Progress',
    'pre':'Entry Delay of Partition',
    'bytes':1,
    'post':'in Progress',
    'send':'entrydelay',
    'action':'updatepartition'
  },
  '658' : {
    'name':'Keypad Lock-out',
    'pre':'Keypad at Partition',
    'bytes':1,
    'post':'is locked out due to too many failed user code attempts',
    'send':'keypadlockout',
    'action':'updatepartition'
  },
  '659' : {
    'name':'Partition Failed to Arm',
    'pre':'Partition',
    'bytes':1,
    'post':'FAILED to Arm',
    'send':'failedtoarm',
    'action':'updatepartition'
  },
  '660' : {
    'name':'PGM Output is in Progress',
    'pre':'PGM Output of Partition',
    'bytes':1,
    'post':'is in Progress',
    'send':'pgmoutputinprogress',
    'action':'updatepartition'
  },
  '663' : {
    'name':'Chime Enabled',
    'pre':'Door Chime on Partition',
    'bytes':1,
    'post':'is Enabled',
    'send':'chimeenabled',
    'action':'updatepartition'
  },
  '664' : {
    'name':'Chime Disabled',
    'pre':'Door Chime on Partition',
    'bytes':1,
    'post':'is Disabled',
    'send':'chimedisabled',
    'action':'updatepartition'
  },
  '670' : {
    'name':'Invalid Access Code',
    'pre':'Invalid Access Code on Partition',
    'bytes':1,
    'post':'',
    'send':'invalidcode',
    'action':'updatepartition'
  },
  '671' : {
    'name':'Function Not Available',
    'pre':'A Function Selected on Partition',
    'bytes':1,
    'post':'is not Available',
    'send':'functionnotavailable',
    'action':'updatepartition'
  },
  '672' : {
    'name':'Failure to Arm',
    'pre':'An Attempt to Arm Partition',
    'bytes':1,
    'post':'Failed',
    'send':'failedtoarm',
    'action':'updatepartition'
  },
  '673' : {
    'name':'Partition is Busy',
    'pre':'Partition',
    'bytes':1,
    'post':'is Busy',
    'send':'busy',
    'action':'updatepartition'
  },
  '674' : {
    'name':'System Arming in Progress',
    'pre':'System is auto-arming and in arm warning delay on Partition',
    'bytes':1,
    'post':'',
    'send':'autoarming',
    'action':'updatepartition'
  },
  '680' : {
    'name':'System in Installers Mode',
    'pre':'System is in Installer Mode',
    'bytes':0,
    'post':'',
    'send':'installersmode',
    'action':'updatesystem'
  },
  '700' : {
    'name':'User Closing',
    'pre':'Partition has been armed by user:',
    'bytes':5,
    'post':'',
    'send':'userclosing',
    'action':'updatepartition'
  },
  '701' : {
    'name':'Special Closing',
    'pre':'Partition',
    'bytes':1,
    'post':'has been armed by Quick Arm, Auto Arm, Keyswitch, DLS or Wireless Key',
    'send':'specialclosing',
    'action':'updatepartition'
  },
  '702' : {
    'name':'Partial Closing',
    'pre':'Partition',
    'bytes':1,
    'post':'is armed with one or more zones bypassed',
    'send':'partialclosing',
    'action':'updatepartition'
  },
  '750' : {
    'name':'User Opening',
    'pre':'Partition Opened by User:',
    'bytes':5,
    'post':'',
    'send':'useropening',
    'action':'updatepartition'
  },
  '751' : {
    'name':'Special Opening',
    'pre':'Partition',
    'bytes':1,
    'post':'has been disarmed by Keyswitch, DLS or Wireless Key',
    'send':'specialopening',
    'action':'updatepartition'
  },
  '800' : {
    'name':'Panel Battery Trouble',
    'pre':'The panel has a low battery',
    'bytes':0,
    'post':'',
    'send':'batterytrouble',
    'action':'updatesystem'
  },
  '801' : {
    'name':'Panel Battery Trouble Restore',
    'pre':'The panel battery has been restored',
    'bytes':0,
    'post':'',
    'send':'batterytroublerestore',
    'action':'updatesystem'
  },
  '802' : {
    'name':'Panel AC Trouble',
    'pre':'AC Power to the Panel has been removed',
    'bytes':0,
    'post':'',
    'send':'actrouble',
    'action':'updatesystem'
  },
  '803' : {
    'name':'Panel AC Restored',
    'pre':'AC Power to the panel has been restored',
    'bytes':0,
    'post':'',
    'send':'actroublerestore',
    'action':'updatesystem'
  },
  '806' : {
    'name':'System Bell Trouble',
    'pre':'An open circuit has been detected across the bell terminals',
    'bytes':0,
    'post':'',
    'send':'systembelltrouble',
    'action':'updatesystem'
  },
  '807' : {
    'name':'System Bell Trouble Restored',
    'pre':'Bell Trouble has been Restored',
    'bytes':0,
    'post':'',
    'send':'systembelltroublerestore',
    'action':'updatesystem'
  },
  '814' : {
    'name':'FTC Trouble',
    'pre':'Panel has failed to communicate to the monitoring station',
    'bytes':0,
    'post':'',
    'send':'communicationtrouble',
    'action':'updatesystem'
  },
  '816' : {
    'name':'Buffer Near Full',
    'pre':'Event Buffer is 75% full',
    'bytes':0,
    'post':'',
    'send':'buffernearfull',
    'action':'updatesystem'
  },
  '829' : {
    'name':'General System Tamper',
    'pre':'A tamper has occured with a module',
    'bytes':0,
    'post':'',
    'send':'tamper',
    'action':'updatesystem'
  },
  '830' : {
    'name':'General System Tamper Restore',
    'pre':'General System Tamper Restored',
    'bytes':0,
    'post':'',
    'send':'tamperrestore',
    'action':'updatesystem'
  },
  '840' : {
    'name':'Trouble LED On',
    'pre':'Trouble LED of Partition',
    'bytes':1,
    'post':'is ON',
    'send':'troubleledon',
    'action':'updatepartition'
  },
  '841' : {
    'name':'Trouble LED Off',
    'pre':'Trouble LED of Partition',
    'bytes':1,
    'post':'is OFF',
    'send':'troubleledoff',
    'action':'updatepartition'
  },
  '842' : {
    'name':'Fire Trouble Alarm',
    'pre':'Fire Trouble Alarm',
    'bytes':0,
    'post':'',
    'send':'firetroublealarm',
    'action':'updatesystem'
  },
  '843' : {
    'name':'Fire Trouble Alarm Restored',
    'pre':'Fire Trouble Alarm Restored',
    'bytes':0,
    'post':'',
    'send':'firetroublealarmrestore',
    'action':'updatesystem'
  },
  '849' : {
    'name':'Verbose Trouble Status',
    'pre':'Verbose Trouble Status Code:',
    'bytes':2,
    'post':'',
    'send':'verbosetroublestatus',
    'action':'updatesystem'
  },
  '900' : {
    'name':'Code Required',
    'pre':'Code is Required',
    'bytes':0,
    'post':'',
    'send':'',
    'action':'coderequired'
  },
  '912' : {
    'name':'Command Output Pressed',
    'pre':'Code is Required',
    'bytes':1,
    'post':'',
    'send':'',
    'action':'coderequired'
  },
  '921' : {
    'name':'Master Code Required',
    'pre':'Master Code is Required',
    'bytes':0,
    'post':'',
    'send':'',
    'action':'coderequired'
  },
  '922' : {
    'name':'Installers Code Required',
    'pre':'Installers Code Required',
    'bytes':0,
    'post':'',
    'send':'',
    'action':'coderequired'
  }
}
