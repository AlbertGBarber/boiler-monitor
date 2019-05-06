//dont forget to sudo npm install before trying to run
//sudo DEBUG=boiler-monitor:* npm run devstart //to start app in debug
var createError = require('http-errors');
var express = require('express');
var path = require('path');
const { body,validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var sassMiddleware = require('node-sass-middleware');
var exphbs = require( 'express-handlebars' );
var passport = require('passport');
var flash = require('connect-flash');
var bodyParser = require('body-parser');
var session = require('express-session');

//HELPERS
//we want to use the handlebars-helpers library, but 
//the main export returns a function that needs to be called to expose the object of helpers.
//exphbs.create() below expects an helpers to be wrapped as an object, so we need to make it one
//using Object.assign
//To add new helpers you need to add them to the hbsHelpers object
const hbsDefaultHelpers = require('handlebars-helpers')(['math', 'comparison']);
const hbsHelpers = Object.assign(hbsDefaultHelpers);

//MongDB stuff, don't foget to install MongoDb locally
//$ sudo apt-get install mongodb-server //to install
//$ sudo service mongod start //to set server to run on boot
//If the service doesn't work, run
//sudo rm /var/lib/mongodb/mongod.lock
//mongod --repair
//sudo service mongodb start

//Import the mongoose module
var mongoose = require('mongoose');

//Set up default mongoose connection
var mongoDB = 'mongodb://boiler_monitor:a11111@ds048537.mlab.com:48537/boiler-monitor'; //mlab database url
mongoose.connect(mongoDB);
// Get Mongoose to use the global promise library
mongoose.Promise = global.Promise;
//Get the default connection
var db = mongoose.connection;

//Bind connection to error event (to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

var indexRouter = require('./routes/index');
//var usersRouter = require('./routes/loginMain');
var boilerRouter = require('./routes/boilerMonitor');
var passportConfig = require('./config/passport');

var app = express();

// view engine setup
var hbs = exphbs.create({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: __dirname + '/views/layouts/',
	partialsDir: __dirname + '/views/partials/',
	helpers : hbsHelpers ,
});

app.engine( 'hbs', hbs.engine );

app.set('view engine', '.hbs');


app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(sassMiddleware({
  src: path.join(__dirname, '/sass'),
  dest: path.join(__dirname, '/public/stylesheets'),
  indentedSyntax: false, // true = .sass and false = .scss,
  //prefix: '/css',
  sourceMap: true
}));

// required for passport
passportConfig(passport);
app.use(session({ secret: 'beepboopbeeep', // session secret
	name: 'SessionID',
	resave: false,
	saveUninitialized: true,
	cookie: {
        secure: false,        // Use in production. Send session cookie only over HTTPS
        httpOnly: true,
	}
	
})); 

app.use(flash()); // use connect-flash for flash messages stored in session
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(passport.authenticate('remember-me'));


app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
//app.use('/loginMain', usersRouter);
app.use('/boilerMonitor', boilerRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});



module.exports = app;
