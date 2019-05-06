var rack = require('hat').rack(); //random token generator
var Token = require('../models/token');
var User = require('../models/user');
var mongoose = require('mongoose');

module.exports = {
    consume: function (token, done) {
            
        Token.findOne({ token: token }, function (err, token) {
            if (err) {
                return done(err);
            }
            
            if (!token) {
                return done(null, false);
            }
            
            User.findById(token.userId, function (err, user) {
                if (err) {
                    return done(err);
                }
                
                Token.deleteOne(token, function (err) {
                    if (err) {
                        return done(err); 
                    } else if (user === null) {
                        return done(null, false);
                    } else {
                        return done(null, user);
                    }    
                });
            });
        });
    },
    
    create: function (user, done) {
        var tokenGen = rack();
		var newToken = new Token( { token: tokenGen, userId: user._id} );
        Token.create( newToken, function (err) {
            if (err) {
                return done(err);
            } else {
                return done(null, token);
            }
        });
    },
    
    logout: function (req, res, done) {
        var token = req.cookies['remember_me'];
        if (!token) {
            return done();
        }
        
        Token.deleteOne({ token: token }, function () {
            res.clearCookie('remember_me');
            return done();    
        });
    }
};
