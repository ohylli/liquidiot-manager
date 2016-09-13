/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farshad.ahmadi.gh@gmail.com>
 * Otto Hylli <otto.hylli@tut.fi>
 */

var url = require( 'url' ); 
var express = require('express');
var sift = require( 'sift' );
var css2mongo = require( '../utils/css2mongo' );
var router = express.Router();
var _ = require( 'lodash' );
var mongo = require( 'mongoskin' );
var toObjectID = mongo.helper.toObjectID;

// Gets the list of devices.
// can be filtered with a device selector string as a query parameter named q
router.get('/', function(req, res) {
    var db = req.db;
    var queries = [];

    var operations = {
        or: 'or',
	and: 'and'
    };

    var operation = operations.and;

    if(req.query.operation == operations.or) {
	operation = operations.or;
    }


    //var devQuery = req.query.device || req.query.q;
    //var dbQuery = {}; // mongo db query for getting the devices
    // if the request has a query parameter containing a device selector string
    // parse it into a mongodb query
    var devQuery = null;
    if ( req.query.device ) {
       try {
          devQuery = css2mongo( req.query.device );
	  console.log(devQuery);
	  queries.push(devQuery);
       }
       
       catch ( error ) {
          res.status( 400 ).send( { 'message': 'device selector query parsing failed: ' +error } );
          return;
       }
   }
   
   var q = null; // app specific query part of the mongodb query for devices
   // if we have an app query selector parse it in to mongodb query
   if ( req.query.app ) {
       try {
	  //var appQuery = {};
          q = css2mongo( req.query.app, true );
          // add the app query as an elemmath query
          var appQuery = { apps: { $elemMatch: q } };
	  queries.push(appQuery);
       }
       
       catch ( error ) {
          res.status( 400 ).send( { 'message': 'app selector query parsing failed: ' +error } );
          return;
       }
       
       //console.log( JSON.stringify( dbQuery ));
   }

    var dbQuery = {};
    if(queries.length === 1){
        dbQuery = queries[0];
    } else if (queries.length === 2) {
	if(operation == operations.or) {
            dbQuery = {$or: queries};
	} else {
	    queries[0].apps = queries[1].apps;
	    dbQuery = queries[0];
	}
    }
       console.log(  dbQuery );
   
    db.collection('device').find( dbQuery ).toArray(function(err, items){
        if(err){
            res.status(400).send(err.toString());
        } else {
	    var devIds = [];

	    if(devQuery) {
	    	db.collection('device').find( devQuery ).toArray(function(err, devs){
		    if(err){
		    	res.status(400).send(err.toString());
		    } else {

			console.log(devs);
			devIds = devs.map(function(dev){
			    return dev._id.toString();
			});
			console.log(devIds);
			

		        if ( q ) {
		    	    _.each( items, function ( device ) {
			        if(devIds.indexOf(device._id.toString()) === -1){
				    device.isQueried = false;
			        } else {
				    device.isQueried = true;
			        }
			        device.matchedApps = sift( q, device.apps );
			    });
		        }
            
                        res.status(200).send( items );
		    }
	    	});
	    } else {
	    
		// if we had an app query for each device add a new attribute to the returned document
		// that will contain only those apps that matched the query
		if ( q ) {
		    _.each( items, function ( device ) {
		        device.isQueried = false;
		    	device.matchedApps = sift( q, device.apps );
		    });
	        }
		    
	        res.status(200).send( items );
	    }
        }
    });
});

// add a device
router.post('/', function(req, res){
    var db = req.db;
    console.log(typeof(req.body) + " : " + JSON.stringify(req.body));
    var device = req.body;
    device.classes = []; // an array for device classes
    
    // go through the connected devices if any and add
    // classes that correspond to the device type e.g. if device has a speaker
    // add clas canPlaySound.
    // also add connected device's information as attributes
    // for example if speaker has a model adds that as an attribute named speaker-model
    if ( device['connected-devices'] ) {
       _.each( device['connected-devices'], function ( deviceAttrs, deviceType ) {
          // contains the mapping information between device types and classes
          var deviceType2class = {
             speaker: 'canPlaySound',
             'temp-sensor': 'canMeasureTemperature',
	     led : 'canTurnLight'
          };
          
          if ( deviceType2class[deviceType] ) {
             device.classes.push( deviceType2class[deviceType] );
             _.each( deviceAttrs, function ( value, deviceAttrName ) {
                device[ deviceType +'-' +deviceAttrName ] = value;
             });
          }
       });
    }
    
    db.collection('device').insert(req.body, function(err, result){
        if(err){
            res.status(400).send(err.toString());
        } else {
            console.log(result.insertedIds[0]);
            res.status(200).send(JSON.stringify(result.insertedIds[0]));
        }
    });
});

router.get('/id/:id', function(req, res){
    var db = req.db;
    db.collection('device').findById(req.params.id.toString(), function(err, item){
        if(err){
            res.status(400).send(err.toString());
        } else {
            console.log(typeof(item) + " : " + item);
            res.status(200).send(JSON.stringify(item));
        } 
    });
});

// adds the app information in the requests body to the specified device's apps list.
router.post( '/:id/apps', function ( req, res ) {
    var db = req.db;
    var query = { '_id': toObjectID( req.params.id ) };
    var update = { '$push': { 'apps': req.body } };
    var options = { returnOriginal: false };
    db.collection( 'device' ).findOneAndUpdate( query, update, options, function ( err, result ) {
        if ( err ) {
            res.status( 500 ).send( err );
            return;
        }
        
        if ( result.lastErrorObject.n == 0 ) {
            return res.status( 404).send( { 'message': 'Device with id ' +req.params.id +' not found.' } );
        }
        
        if ( !result.lastErrorObject.updatedExisting ) {
            return res.status( 500 ).send( { 'message': 'Device found but update failed.' } );
        }
        
        res.send( result.value );
    });
});

// deletes the app with the given id from the app list of the specified device
router.delete( '/:devid/apps/:appid', function ( req, res ) {
    var db = req.db;
    var query = { '_id': toObjectID( req.params.devid ), 'apps.id': Number( req.params.appid ) };
    var update = { '$pull': { 'apps': { 'id': Number( req.params.appid ) } } };
    var options = { returnOriginal: false };
    db.collection( 'device' ).findOneAndUpdate( query, update, options, function ( err, result ) {
        if ( err ) {
            res.status( 500 ).send( err );
            return;
        }
        
        if ( result.lastErrorObject.n == 0 ) {
            return res.status( 404).send( { 'message': 'App with id ' +req.params.appid +' in device with id ' +req.params.devid +' not found.' } );
        }
        
        if ( !result.lastErrorObject.updatedExisting ) {
            return res.status( 500 ).send( { 'message': 'Device found but update failed.' } );
        }
        
        res.send( result.value );
    });
});

router.put( '/:devid/apps/:appid', function ( req, res ) {
    var db = req.db;
    var query = { '_id': toObjectID( req.params.devid ), 'apps.id': Number( req.params.appid ) };
    var update = { '$set': { 'apps.$': req.body } };
    var options = { returnOriginal: false };
    db.collection( 'device' ).findOneAndUpdate( query, update, options, function ( err, result ) {
        if ( err ) {
            res.status( 500 ).send( err );
            return;
        }
        
        if ( result.lastErrorObject.n == 0 ) {
            return res.status( 404).send( { 'message': 'App with id ' +req.params.appid +' in device with id ' +req.params.devid +' not found.' } );
        }
        
        if ( !result.lastErrorObject.updatedExisting ) {
            return res.status( 500 ).send( { 'message': 'Device found but update failed.' } );
        }
        
        res.send( result.value );
    });
});

// get a api description for an app running on a device
router.get( '/:devid/apps/:appid/api', function ( req, res ) {
    var db = req.db;
    var devid = req.params.devid;
    var appid = req.params.appid;
    // first find the device
    db.collection( 'device' ).findById(  devid, function ( err, device ) {
        if ( err ) {
            return res.status( 500 ).send( err );
        }
        
        if ( device == null ) {
            return res.status( 404 ).send( { 'message': 'Device with id ' +devid +' not found.' } );
        }
        
        // does the device even have apps
        if ( device.apps == undefined ) {
            return res.status( 404 ).send( { message: 'Device with id ' +devid +' does not have an app with id ' +appid } );
        }
        
        // find the app with the given id
        var app = null;
        device.apps.forEach( function ( item ) {
            if ( item.id == appid ) {
                app = item;
            }
        });
        
        if ( app == null ) {
            return res.status( 404 ).send( { message: 'Device with id ' +devid +' does not have an app with id ' +appid } );
        }
        
        // get the interface descriptions the app refers to
        var query = { name: { $in: app.applicationInterfaces } };
        db.collection( 'apis' ).find( query ).toArray( function ( err, interfaces ) {
            if ( err ) {
                return res.status( 500 ).send( err );
            }
            
            // we should have all of the interfaces the app refers to
            if ( interfaces.length != app.applicationInterfaces.length ) {
                return res.status( 404 ).send( { message: 'The app references interfaces that do not exist.' } );
            }
            
            var api = buildApiDesc( device, app, interfaces );
            res.send( api );
        });
    });
});

// builds a api description for the given app, running on the device from the array of interfaces
function buildApiDesc( device, app, interfaces ) {
    var api = {}; // build the combined description to this object
    // get only the api descriptions into an array as objects
    var apis = interfaces.map( function ( item ) {
        return JSON.parse( item.api );
    });
    
    // now just merge the objects, may be needs additionanl functionality
    // the merge method has another version that also takes a custom function used in merging so this can be customized if required
    // have to use apply merge takes one named argument and variable number after that
    // the first is the target and the rest will be merged to that
    _.merge.apply( null, [ api ].concat( apis ) );
    // add additional information
    api.info = {};
    api.swagger = "2.0";
    api.info.title = app.name;
    api.info.description = app.description;
    api.host = url.parse( device.url ).host;
    api.basePath = '/app/' +app.id +'/api';
    // this is not needed here so remove it
    api['x-device-capability'] = undefined;
    return api;
}

router.get("/functionality?", function(req, res){
    var db = req.db;
    var tempSensor = req.query.tempSensor;
    console.log(tempSensor);
    var speaker = req.query.speaker;
    var qs = "";
    if(tempSensor && speaker){
        qs = {"connected-devices": {"temp-sensor": {"model": tempSensor}, "speaker": {"model": speaker} } };
    } else if(tempSensor) {
        qs = {"connected-devices": {"temp-sensor": {"model": tempSensor} } };
    } else if(speaker) {
        qs = {"connected-devices": {"speaker": {"model": speaker} } };
    } else { 
        //qs = {"connected-devices": {"temp-sensor": {"model": tempSensor}, "speaker": {"model": speaker} } };
        qs = {};
    }
    console.log(JSON.stringify(qs));
    //var a = f.split(' ');
    //var qs = { $in : };
    //for(var i in a){
        //if(i + 1 == a.length) {

            //var qs = {"connected-devices": {"temp-sensor":{ "model": f } } };
        //}
    //}
    //var s = 
    db.collection('device').find(qs).toArray(function(err, items){
        if(err){
            res.status(400).send(err.toString());
        } else {
            res.status(200).send(JSON.stringify(items));
        }
    });
});

module.exports = router;
