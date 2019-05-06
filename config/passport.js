// load all the things we need
var passport = require('passport');
var bcrypt = require('bcrypt-nodejs');
var tokenStorage = require('../config/remember-me-token');
var GoogleAuthenticator = require('passport-2fa-totp').GoogeAuthenticator;
var TwoFAStartegy = require('passport-2fa-totp').Strategy;
var RememberMeStrategy = require('passport-remember-me').Strategy;
var mongoose = require('mongoose');

// load up the user model
var User = require('../models/user');


// expose this function to our app using module.exports
module.exports = function(passport) {
	
	 var INVALID_LOGIN = 'Invalid username or password';
    
    passport.serializeUser(function (user, done) {
        return done(null, user._id);    
	});

	passport.deserializeUser(function (id, done) {
        
        User.findById(id, function (err, user) {
                done(err, user);
            })
    });  
	
	passport.use('login', new TwoFAStartegy({
        usernameField: 'username',
        passwordField: 'password',
        codeField: 'code'
    }, function (username, password, done) {
        // 1st step verification: username and password
        
        process.nextTick(function () {
            
            User.findOne({ username: username }, function (err, user) {
                if (err) {
                    return done(err);
                }
                
                if (user === null) {
                    return done(null, false, { message: INVALID_LOGIN });
                }
                
                bcrypt.compare(password, user.password, function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    
                    if (result === true) {
                        return done(null, user);
                    } else {
                        return done(null, false, { message: INVALID_LOGIN });
                    }
                });
            });
        });
    }, function (user, done) {
        // 2nd step verification: TOTP code from Google Authenticator
        
        if (!user.code) {
            done(new Error("Google Authenticator is not setup yet."));
        } else {
            // Google Authenticator uses 30 seconds key period
            // https://github.com/google/google-authenticator/wiki/Key-Uri-Format
            
            var code = GoogleAuthenticator.decodeSecret(user.code);
            done(null, code, 30);
        }
	}));
	
	passport.use('register', new TwoFAStartegy({
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true,
        skipTotpVerification: true
    }, function (req, username, password, done) {
        // 1st step verification: validate input and create new user
        
        if (!/^[A-Za-z0-9_]+$/g.test(req.body.username)) {
            return done(null, false, { message: 'Invalid username' });
        }
        
        if (req.body.password.length === 0) {
            return done(null, false, { message: 'Password is required' });
        }
        
        User.findOne({ username: username}, function (err, user) {
            if (err) {
                return done(err);
            }
            
            if (user) {
                return done(null, false, { message: 'Username Taken' });
            }
            
            bcrypt.hash(password, null, null, function (err, hash) {
                if (err) {
                    return done(err);    
                }
                
                var newUser = new User({ username: username, password: hash });
                
                User.create(newUser, function (err) {
					console.log
                    if (err) {
                        return done(err);
                    }    
                    
                    return done(null, user);
                });
            }); 
        });
	}));
	
	passport.use(new RememberMeStrategy(function (token, done) {
        process.nextTick(function() {
            tokenStorage.consume(token, function (err, user) {
                if (err) {
                    return done(err);
                } else if (user === false) {
                    return done(null, false);
                } else {
                    return done(null, user);
                }
            });
        });
    },
    function (user, done) {
        process.nextTick(function() {
            tokenStorage.create(user, done);
        });
    }));
};

