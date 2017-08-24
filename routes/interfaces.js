/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Otto Hylli <otto.hylli@tut.fi>
*/

// manages Application interface descriptions

var express = require( 'express' );
var router = express.Router();
var _ = require( 'lodash' );

var devcaps = require( './devicecapabilities' ).devcaps;
var aqlQuery = require('arangojs').aqlQuery;

function AqlError(message, code){
  this.message = message;
  this.code = code;
}

// gets the names and descriptions of the interfaces
router.get( '/', function ( req, res ) {

  //console.log(req.query.devcap);

  var db = req.arango.db;

  if ( req.query.devcap ) {
      // if we have only value convert to array for use in mongo db query
      if ( typeof req.query.devcap == 'string' ) {
          req.query.devcap = [ req.query.devcap ];
      }
  } else {
    req.query.devcap = devcaps.map(devcap => devcap.name);
    req.query.devcap.push('free-class');
  }

  console.log(req.query.devcap);

  db.query(aqlQuery`
    FOR api IN interfaces
      FILTER api.devcap IN ${req.query.devcap}
      RETURN api
    `)
    .then(function(result){
      //console.log(result);
      res.status(200).send(result._result);
    })
    .catch(function(err){
      console.log('errrrr' + err);
      res.status(400).send( { 'message': err.toString() } );
    });
    
    /*var db = req.db;
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
    
    db.collection( 'apis' ).find( query ).project( project ).toArray( function ( err, docs ) {
        if ( err ) {
            return res.status( 500 ).send( err );
        }
        
        res.send( docs );
    });*/
});

// get the api description of an interface
router.get( '/:interface', function( req, res ) {
    
  var db = req.arango.db;
  
  db.query(aqlQuery`
    FOR api IN interfaces
      FILTER api.name == ${req.params.interface}
      RETURN api
    `)
    .then(function(result){
      if(result._result.length == 0){
        throw new AqlError('Ther is no api with the given name', 404);
        //throw new Error('Ther is no api with the given name');
      }
      res.status(200).send(result._result[0].api);
    })
    .catch(function(err){
      console.log('errrrr' + err);
      res.status(err.code || 400).send( { 'message': err.message || err.toString() } );
    });

    /*var db = req.db;
    var query = { name: req.params.interface };
    db.collection( 'apis' ).findOne( query, function ( err, result ) {
        if ( err ) {
            return res.status( 500 ).send( err );
        }
        
        if ( result == null ) {
            return res.status( 404 ).send( { 'message': 'interface named ' +req.params.interface +' not found.' } );
        }
        
        // have to set this because response body is only a string
        res.type( 'json' );
        res.send( result.api );
    });*/
});

// create or update an interface  description
router.put( "/:interface", function( req, res ) {
    
  var db = req.arango.db;
  var collection = req.arango.collections.interfaces;
  
  var query = { 'name': req.params.interface };
    
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
            return res.status( 400 ).send( { message: 'The interface refers to device capability ' +devcap +' which does not exist in the system.' });
        }
    }
    
    // object to be added
    var api = { name: req.params.interface, description: description, devcap: devcap, api: JSON.stringify( req.body ) };
    
  db.query(aqlQuery`
    UPSERT {name : ${req.params.interface}}
      INSERT ${api}
      REPLACE ${api} IN interfaces
    RETURN NEW
    `)
    .then(function(result){
      res.status(200).send(result._result[0].api);
    })
    .catch(function(err){
      console.log('errrrr' + err);
      res.status(400).send( { 'message': err.toString() } );
    });
  
  /*var db = req.db;
    var query = { 'name': req.params.interface };
    
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
            return res.status( 400 ).send( { message: 'The interface refers to device capability ' +devcap +' which does not exist in the system.' });
        }
    }
    
    // object to be added
    var api = { name: req.params.interface, description: description, devcap: devcap, api: JSON.stringify( req.body ) };
    // option for inserting a document if none match query
    var options = { upsert: true };
    db.collection( 'apis' ).updateOne( query, api, options, function ( err, result ) { 
        if ( err ) {
            return res.status( 500 ).send( err );
        }

        res.send( req.body );
    });*/
});

// deletes an interface description
router.delete( '/:interface', function ( req, res ) {

  
  var db = req.arango.db;
  
  db.query(aqlQuery`
    FOR api IN interfaces
      FILTER api.name == ${req.params.interface}
      REMOVE api IN interfaces
      RETURN OLD
    `)
    .then(function(result){
      if(result._result.length == 0){
        throw new AqlError('interface named ' + req.params.interface + ' not found.', 404);
        //throw new Error('Ther is no device or app with the given ids');
      }
      res.status(200).send(result._result[0].api);
    })
    .catch(function(err){
      //res.status(400).send( { 'message': err.toString() } );
      res.status( err.code || 500 ).send( err.message || err );
    });

  /*var db = req.db;
    var query = { name: req.params.interface };
    db.collection( 'apis' ).findOneAndDelete( query, function ( err, result ) {
        if ( err ) {
            return res.status( 500 ).send( err );
        }
        
        if ( result.lastErrorObject.n == 0 ) {        
            return res.status( 404 ).send( { 'message': 'interface named ' +req.params.interface +' not found.' } );
        }
        
        // set content type because we are sending just a string
        res.type( 'json' );
        res.send( result.value.api  );
    });*/
    
});

module.exports = router;
