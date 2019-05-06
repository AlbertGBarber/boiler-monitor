var BoilerEvents = require('../models/boilerEvent');
var mongoose = require('mongoose');
var moment = require('moment');
const { body,validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');

//gpio and sensor libs below
//-------------------------------
const Gpio = require('pigpio').Gpio;

//servo setup
const motor = new Gpio(14, {mode: Gpio.OUTPUT});

//neopixel initialization
var ws281x = require('rpi-ws281x-native');
var NUM_LEDS = 1;
var pixelData = new Uint32Array(NUM_LEDS);

var brightness = 128;

ws281x.init(NUM_LEDS); //pin 18

//initialize stuff for ADC and light sensor
const Raspi = require('raspi');
const I2C = require('raspi-i2c').I2C;
const ADS1x15 = require('raspi-kit-ads1x15');

Raspi.init(() => {

});

//new instance of raspi i2c
const i2c = new I2C();
//instance of ADC1115 chip //pin 2 and 3
const adc = new ADS1x15({
        i2c,                                    // i2c interface
        chip: ADS1x15.chips.IC_ADS1115,         // chip model
        address: ADS1x15.address.ADDRESS_0x48,  // i2c address on the bus
        
        // Defaults for future readings
        pga: ADS1x15.pga.PGA_4_096V,            // power-gain-amplifier range
        sps: ADS1x15.spsADS1015.SPS_250         // data rate (samples per second)
});

//initialize ds18b20 temp sensor
const tempSensor = require('ds18b20-raspi'); //pin 4 enable pullup on 4 using wiringpi: gpio -g mode 4 up

setInterval( function () { 
	//const tempF = tempSensor.readSimpleF();
	//console.log(`${tempF} degF`);  
}, 1000);
//----------------------------------------------


//delay to give the servo time to move before sending ok reply to client
const servoMoveDelayMs = 2000;

//how many days of boiler event logs get send to the client
var currentlogNumDays = 30;

var lightSenCheckIntervMs = 30 * 1000; //30 sec -- frequency at which the light sensor is checked for heat requests

var tempSensorCheckIntervMs = 3 * 60 * 1000; //3 mins -- delay between asking for heat and checking the boiler output temp

var lightSensorRead = 600; //raw reading from the light sensor

var lightSensorStartThreshold = 300; //minimum light reading for the system to trigger //9000

var lightSensorStopThreshold = 50; //maximum reading for light sensor to when the system is not asking for heat //4000

var tempSensorThreshold = 150; //deg C -- accepted temp for the boiler to be considered running

var tempSensorRead = 0; //the raw boiler output temp reading

var retryCount = 0; //number of retries for the current heating cycle

var retryCountMax = 1; //maximum number of retires to turn the boiler on before going to fault mode

//boiler state object, used to store the boiler's current status
var boilerState = {
	switchState : true, //indicates if the boiler is on or off (true is on)
	boilerStateInd: 0, //the boiler's functional state: idle, heating, running, or fault (0 - 3)
	heatRequestStatus: false, //indicates if the system is asking for heat (true is yes)
	boilerCheckInProg: false, //indicates if the system is in a boiler cycle
	retryCount: 0, //how many times the boiler has been restarted for the current heat request
}

//resets the boiler state to default
//used when a heating cycle finishes, or when the boiler is manually switched on / off
const resetBoilerVars = function(){
	boilerState.boilerCheckInProg = false;
	boilerState.boilerStateInd = 0;
	boilerState.heatRequestStatus = false;
	retryCount = 0;
}

setInterval( function () { 
	pixelData[0] = color( 0, 255, 0);
	ws281x.render(pixelData);
	setTimeout( function (){
		 pixelData[0] = color(255, 0, 0);
		 ws281x.render(pixelData);
	}, 1000)
}, 2000);

var reading = 0;
const readLightSensor = function(){
	// Get a single-ended reading from channel-0 and display the results
	adc.readChannel(ADS1x15.channel.CHANNEL_0, function(err, value, volts){
			if (err) {
				console.error('Failed to fetch value from ADC', err);
			} else {
				//console.log(value);
				reading = value;
			}
	});	 
}

setInterval( function () { 
	//readLightSensor();
	//console.log(' * Value:', reading);   
}, 1000);

//main program loop:
//if the boiler is turned on
//poll the light sensor for startup signal every 30 sec
//when we get a signal, set a timer for 3mins
//when the timer expires, check the temp sensor
//if it heats up report a success to the DB, goto last step
//if it's still cold toggle the switch, start the timer again, and report a fail to the DB
//if it's still cold for retryCountMax retries, we enter fault mode where the monitoring system turns off and must be reset by toggling the switch
//if it heats up poll the light sensor every 30 sec for the signal to turn off
//once it's off, reset vars, go the start again

//returns the boiler state in json
exports.getBoilerStatus = function(req,res){
	res.json(boilerState);
}

//at the light sensor poll interval,
//if we're not already in a heating cycle, check the light sensor
//if above threshold, heat is requested (set status)
//if the boiler is switched on, begin a boiler check cycle (set status)
setInterval( function () { 
	if(!boilerState.boilerCheckInProg){
		//read lightSensor
		if( lightSensorRead >= lightSensorStartThreshold){
			boilerState.heatRequestStatus = true;
			if(boilerState.switchState){
				boilerState.boilerCheckInProg = true;
				boilerState.boilerStateInd = 1; //indicate boiler is heating up
				checkBoilerStartSuccess();
			}
		}	
	}
}, lightSenCheckIntervMs );

//after tempSensorCheckIntervMs time, check if the boiler has heated up
const checkBoilerStartSuccess = function(){

	setTimeout( function () {
		checkBoilerOutputTemp();
	} , tempSensorCheckIntervMs ); 
	
}

//if the boiler is turned on, check the temp sensor
//if it's above the threshold, the boiler has turned on correctly, log this to the db (even if it's after an initial failure)
//otherwise, toggle the switch and wait to check temps again, and post a failure to the db (only does this on the first retry)
//if the boiler is still cold after retryCountMax retries, enter fault mode
var checkBoilerOutputTemp = function(){
	if(boilerState.switchState){
		//read temp sensor
		if(tempSensorRead >= tempSensorThreshold){
			//post success to DB
			boilerState.boilerStateInd = 2; //set state to running
			checkBoilerEndSignal();	//start checking for the heat request to stop	
		} else if(retryCount < retryCountMax) {
			toggleSwitch();
			
			//if we're on the first retry post to the db (we don't log multiple failures for the same heat cycle)
			if(retryCount === 0){ 
				//post failure to DB
			}
			retryCount++;
			checkBoilerStartSuccess(); //go back and read the temps after a delay
		} else {
			//send email / sms
			boilerState.boilerStateInd = 3; //set state to fault
		}
	}
}

//if the boiler is on, check for the light sensor reading to fall below the 'off' threshold
//this means the heat cycle has ended; reset the boiler state to default 
//otherwise wait for the lightSenCheckIntervMs time and check again
const checkBoilerEndSignal = function(){
	if(boilerState.switchState){
		//read light sensor
		if ( lightSensorRead <= lightSensorStopThreshold ){
			resetBoilerVars();
		} else {
			setTimeout( function () {
				checkBoilerEndSignal();
			} , lightSenCheckIntervMs ); 
		}
	}
}

// generate integer from RGB value
const color = function(r, g, b) {
  r = r * brightness / 255;
  g = g * brightness / 255;
  b = b * brightness / 255;
  return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
}


//creates a new boiler event at the current date + time
//checks the database if there has already been an event during the current day
//if so, stores the new event under that day
//otherwise creates a new event structure and adds the new event
exports.test = function(req, res, next){

	//the new event, storing the date and status in an object
	var now = new Date();
	var newEvent = { eventTime : now, eventStatus : false} ; 
	
	//timeCheck is for checking if the database already as an event for the current day
	var timeCheck = new Date();
	//set time to the start of the day
	timeCheck.setHours(0,0,0,0);
	//mongoDB stores dates without any timezone offsets, so we need to account for this
	//by offseting the check time
	var timeOffsetms = timeCheck.getTimezoneOffset() * 60000;
	timeCheck.setTime(timeCheck.getTime() + timeOffsetms );
	
	//check the database for an existing day entry, if it exists add the new event, if not create a new day and event
	BoilerEvents.findOne({ createdAt : { $gt: timeCheck.getTime()  }}).exec(function (err, boilerEvents){
		
		if (err) { return console.log(err); } 
		if(boilerEvents){
			boilerEvents.event_list.push( newEvent );
			boilerEvents.save(function (err) {
				if (err) return handleError(err);
			});
			res.send('OK')
		} else {
			BoilerEvents.create(  { createdAt: now , event_list: [newEvent] } , function( err ){
				if (err) return handleError(err);
				res.send('OK')
				//saved!
			});
		};
	});
};

//renders the main boiler page,
//displaying the swith state, and the boiler event logs going back currentlogNumDays days
exports.index = function(req, res) {
	console.log('hi');
	//determine the time to look forward from in the DB based on currentlogNumDays
	var logTimeLength = new Date();
	logTimeLength.setTime( getLogDays( currentlogNumDays ) );
	
	//get the boiler events fron the DB, sorting them in ascending order
	//and render the page
	BoilerEvents.find( { createdAt : { $gt: logTimeLength.getTime() }} ).sort({createdAt: -1}).exec(function (err, boilerEvents ){
		
		if (err) { return console.log(err); }

		res.render('boilerMonitorView', {
			title :'boiler monitor ', 
			logNumDays : currentlogNumDays,
			boilerState : boilerState, 
			boilerEvents : boilerEvents, 
			});
	});
};

//sets the number of days from form input to be currentlogNumDays
exports.changeLogDays =[ 

	// Validate fields, numDays must be a number
	body('numDays').isNumeric().trim(),
	// Sanitize fields
	sanitizeBody('numDays').trim().escape(),
	
	function (req, res) {
		
		// Extract the validation errors from a request.
        const errors = validationResult(req);
        //if there are no errors, set the currentlogNumDays and
        //redirect to '/boilerMonitor', the index page to display the new data
		if (errors.isEmpty()) {
			currentlogNumDays = parseInt(req.body.numDays); 
		} else {
			console.log(errors);
		}
		res.redirect('/boilerMonitor');
	}
]

//returns the time to look forwards from when querying the DB for boiler events
var getLogDays = function (numDays) {
	//get the current date at the start of the day
	//(so that when we search the db we'll always catch an event that started at the furthest date, but before the current time)
	var timeLength = new Date();
	timeLength.setHours(0,0,0,0);
	
	//if the numDays is -1, we'll display all the logs,
	//otherwise we set the date back numDays days
	if(numDays > -1){
		timeLength.setDate( timeLength.getDate() - numDays );	
	} else {
		timeLength.setTime(0);
	}
	return timeLength;
}

//toggles the on-off servo
//switches to the off postion,
//and wiats servoMoveDelayMs before switching back to the on position
//(giving the servo time to move)
var toggleSwitch = exports.toggle_switch = function(req, res) {

	switch_off_servo();
	setTimeout( function () {
		switch_on_servo();
		if(req){
			res.send('OK');
		}
	} , servoMoveDelayMs );  
};

//switches the servo to the off postion, and resets boiler state (we're interupting a boiler cycle)
//waits servoMoveDelayMs before sending ok 
//to give the servo time to move
var switchOff = exports.switch_off = function(req, res) {
	switch_off_servo();
	resetBoilerVars();
	setTimeout( function () {
		if(req){
		  res.send('OK');
		}
	}, servoMoveDelayMs );
};

//switches the servo to the on postion, and resets boiler state (we're interupting a boiler cycle)
//waits servoMoveDelayMs before sending ok 
//to give the servo time to move
var switchOn = exports.switch_on = function(req, res) {
    switch_on_servo();
    resetBoilerVars();
	setTimeout( function () {
        if(req){
		  res.send('OK');
		}
	}, servoMoveDelayMs );
};

//switches the servo to the off postion,
//sets the switchState indicating the boiler is off
var switch_off_servo = function(){
	boilerState.switchState = false;
	motor.servoWrite(2000);
}

//switches the servo to the on postion,
//sets the switchState indicating the boiler is on
var switch_on_servo = function(){
	boilerState.switchState = true;
	motor.servoWrite(1000);
}
