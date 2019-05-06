var mongoose = require('mongoose');
var moment = require('moment'); //for time formatting

var Schema = mongoose.Schema;

/*
The boiler event storage schema structure:
{
	createdAt : Date,
	event_list: { 
					{
						eventTime : Date1, 
						eventStatus : Boolean1,
						virtual : 'eventTimeString'
					}, 
					
					{
						eventTime : Date1, 
						eventStatus : Boolean1,
						virtual : 'eventTimeString'
					}, 
					
					etc
				}
	virtual : 'eventDateString'	
} 

*/

var BoilerEventSchema = new Schema(
  {
	eventTime : Date, 
	eventStatus : Boolean,
  }
);

BoilerEventSchema
.virtual('eventTimeString')
.get(function () {
	return moment(this.eventTime).format('h:mm a');
});

var BoilerEventListSchema = new Schema(
  {
	  createdAt : Date,
	  event_list: { type: [ BoilerEventSchema ] }
  }
);


BoilerEventListSchema
.virtual('eventDateString')
.get(function () {
	return moment(this.createdAt).format('MM-DD-YY');
});

//Export model
module.exports = mongoose.model('BoilerEvent', BoilerEventListSchema, 'boilerEvent');
