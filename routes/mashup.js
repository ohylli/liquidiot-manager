/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farshad.ahmadi.gh@gmail.com>
 * Otto Hylli <otto.hylli@tut.fi>
 */

var express = require( 'express' );
var router = express.Router();
router.post( '/', function( req, res ) {
    res.send( 'hello' );
});

module.exports = router;