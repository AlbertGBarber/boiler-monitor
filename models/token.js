var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var tokenSchema = new Schema(
  {
	token : String, 
	userId : String,
  }
);

module.exports = mongoose.model('Token', tokenSchema);
