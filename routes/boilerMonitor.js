var express = require('express');
var router = express.Router();

// Require controller modules.
var boiler_controller = require('../controllers/boilerController');


/// ROUTES ///

// GET boiler home page.
router.get('/', boiler_controller.index);

router.post('/change-log-days', boiler_controller.changeLogDays);

router.post('/toggle', boiler_controller.toggle_switch);

router.post('/on', boiler_controller.switch_on);

router.post('/off', boiler_controller.switch_off);

router.post('/test', boiler_controller.test);

router.get('/boiler-status', boiler_controller.getBoilerStatus);

module.exports = router;
