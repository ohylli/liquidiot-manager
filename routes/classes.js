/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Otto Hylli <otto.hylli@tut.fi>
*/

var express = require( 'express' );

var router = express.Router();

router.get( '/', function ( req, res ) {
    res.send( { message: 'joo' } );
});

router.put( "/:class", function( req, res ) {
    var db = req.db;
    res.send();
});

module.exports = router;