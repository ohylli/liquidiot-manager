/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Otto Hylli <otto.hylli@tut.fi>
*/

// provides information about device capabilities.

var express = require( 'express' );
var router = express.Router();

var devcaps = [
               {
                   name: 'canPlaySound',
                   description: 'The device has a speaker which can be used to play a sound.'
               },
               {
                   name: 'canMeasureTemperature',
                   description: 'The device has a temperature sensor that can be used to measure temperature.'
               },
               {
		               name: 'canTurnLight',
		               description: 'The device has an led that can be used to turn on or tuen off a light'
	             },
               {
		               name: 'canDetectFire',
		               description: 'The device has a fire detector that can be used detect fire'
	             }
              ];

// get available device capabilities
router.get( '/', function ( req, res ) {
    res.send( devcaps );
});

module.exports = { router: router, devcaps: devcaps };
