/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Otto Hylli <otto.hylli@tut.fi>
*/

// manages classes and their api descriptions

var express = require( 'express' );
var router = express.Router();
var _ = require( 'lodash' );

var devcaps = require( './devicecapabilities' ).devcaps;

// gets the names and descriptions of the classes
router.get( '/', function ( req, res ) {
    var db = req.db;
    // get only name, description and device capability
    var project = { name: 1, description: 1, devcap: 1, '_id': 0  };
    // filter by device capability if the devcap query parameter is present
    var query = {};
    if ( req.query.devcap ) {
        // if we have only value convert to array for use in mongo db query
        if ( typeof req.query.devcap == 'string' ) {
            req.query.devcap = [ req.query.devcap ];
        }
        
        query = { devcap: { $in: req.query.devcap }};
    }
    
    db.collection( 'classes' ).find( query ).project( project ).toArray( function ( err, docs ) {
        if ( err ) {
            return res.status( 500 ).send( err );
        }
        
        res.send( docs );
    });
});

// get the api description of a class
router.get( '/:class', function( req, res ) {
    var db = req.db;
    var query = { name: req.params.class };
    db.collection( 'classes' ).findOne( query, function ( err, result ) {
        if ( err ) {
            return res.status( 500 ).send( err );
        }
        
        if ( result == null ) {
            return res.status( 404 ).send( { 'message': 'class named ' +req.params.class +' not found.' } );
        }
        
        // have to set this because response body is only a string
        res.type( 'json' );
        res.send( result.api );
    });
});

// create or update a class api description
router.put( "/:class", function( req, res ) {
    var db = req.db;
    var query = { 'name': req.params.class };
    
    // try to get a description from the api specification
    var description = '';
    if ( req.body.info && req.body.info.description ) {
        description = req.body.info.description;
    }
    
    var devcap = 'free-class';
    if ( req.body['x-device-capability']) {
        devcap = req.body['x-device-capability'];
        var devcapNames = devcaps.map( function( item ) {
           return item.name; 
        });
        
        if ( !_.includes( devcapNames, devcap ) ) {
            return res.status( 400 ).send( { message: 'The class refers to device capability ' +devcap +' which does not exist in the system.' });
        }
    }
    
    // object to be added
    var api = { name: req.params.class, description: description, devcap: devcap, api: JSON.stringify( req.body ) };
    // option for inserting a document if none match query
    var options = { upsert: true };
    db.collection( 'classes' ).updateOne( query, api, options, function ( err, result ) { 
        if ( err ) {
            return res.status( 500 ).send( err );
        }

        res.send( req.body );
    });
});

// deletes a class api description
router.delete( '/:class', function ( req, res ) {
    var db = req.db;
    var query = { name: req.params.class };
    db.collection( 'classes' ).findOneAndDelete( query, function ( err, result ) {
        if ( err ) {
            return res.status( 500 ).send( err );
        }
        
        if ( result.lastErrorObject.n == 0 ) {        
            return res.status( 404 ).send( { 'message': 'class named ' +req.params.class +' not found.' } );
        }
        
        // set content type because we are sending just a string
        res.type( 'json' );
        res.send( result.value.api  );
    });
    
});

module.exports = router;