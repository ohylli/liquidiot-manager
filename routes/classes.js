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

// create or update a class api description
router.put( "/:class", function( req, res ) {
    var db = req.db;
    var query = { 'name': req.params.class };
    // object to be added
    var api = { name: req.params.class, api: JSON.stringify( req.body ) };
    // option for inserting a document if none match query
    var options = { upsert: true };
    db.collection( 'classes' ).updateOne( query, api, options, function ( err, result ) { 
        if ( err ) {
            return res.status( 500 ).send( err );
        }

        res.send( req.body );
    });
});

module.exports = router;