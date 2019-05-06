var express = require('express');
var router = express.Router();
var passport = require('passport');
var mongoose = require('mongoose');
var GoogleAuthenticator = require('passport-2fa-totp').GoogeAuthenticator;
var tokenStorage = require('../config/remember-me-token');

var User = require('../models/user');

var successRedirectPage = '/boilerMonitor';

var authenticated = function (req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    
    return res.redirect('/');
}

/* GET home page. */
router.get('/', function(req, res, next) {

	if (req.isAuthenticated()) {
        return res.redirect(successRedirectPage);
    }
    
    var errors = req.flash('error');
    return res.render('loginHome', { 
        errors: errors
	});
});

router.post('/login', passport.authenticate('login', {
    failureRedirect: '/',
    failureFlash: true,
    badRequestMessage: 'Invalid username or password.'
	}), function (req, res, next) {
		if (!req.body.remember) {
			return res.redirect(successRedirectPage);    
		}
		
		// Create remember_me cookie and redirect to /profile page
		tokenStorage.create(req.user, function (err, token) {
			if (err) {
				return next(err);
			}
			
			res.cookie('remember_me', token, { path: '/', httpOnly: true, maxAge: 604800000 });
			return res.redirect(successRedirectPage);
		});    
});

router.post('/register', passport.authenticate('register', {
    successRedirect: '/setup-2fa',
    failureRedirect: '/',
    failureFlash: true 
    }), function (req, res, next) {
		console.log(req.body);
	});
//}));

router.get('/setup-2fa', authenticated, function (req, res, next) {
    var errors = req.flash('setup-2fa-error');
    var qrInfo = GoogleAuthenticator.register(req.user.username);
    req.session.qr = qrInfo.secret;
    
    return res.render('setup-2fa', {
        errors: errors,
        qr: qrInfo.qr
    });
});

router.post('/setup-2fa', authenticated, function (req, res, next) {
    if (!req.session.qr) {
        req.flash('setup-2fa-error', 'The Account cannot be registered. Please try again.');
        return res.redirect('/setup-2fa');
    }
    
    User.findById(req.user._id, function (err, user) {
        if (err) {
            req.flash('setup-2fa-error', err);
            return res.redirect('/setup-2fa');
        }
        
        if (!user) {
            // User is not found. It might be removed directly from the database.
            req.logout();
            return res.redirect('/');
        }
        
        user.secret = req.session.qr;
        
        user.save(function (err) {
            if (err) {
                req.flash('setup-2fa-error', err);
                return res.redirect('/setup-2fa');
            }
            
            res.redirect(successRedirectPage);
        });      
    });
});

router.get('/logout', authenticated, function (req, res, next) {
    tokenStorage.logout(req, res, function () {
        req.logout();
        return res.redirect('/');    
    });
});

module.exports = router;
