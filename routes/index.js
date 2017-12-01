/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farshad.ahmadi.gh@gmail.com>
 * Otto Hylli <otto.hylli@tut.fi>
 */

'use strict'

var url = require( 'url' ); 
var express = require('express');
var sift = require( 'sift' );
var css2mongo = require( '../utils/css2mongo' );
var router = express.Router();
var _ = require( 'lodash' );
var mongo = require( 'mongoskin' );
var toObjectID = mongo.helper.toObjectID;

var aqlQuery = require('arangojs').aqlQuery;

// get the list of devices
router.get('/', function(req, res) {

  var db = req.arango.db;
  var collection = req.arango.collections.devices;

  var devQuery = req.query.device;

  //console.log(devQuery);

  if(!devQuery){
    devQuery = "FOR device IN devices RETURN device";
  }
  
    db.query(devQuery)
      .then(function(docs){
        res.status(200).send(docs._result);
      })
      .catch(function(err){
        res.status(400).send( { 'message': err.toString() } );
      });
});

// add a device
router.post('/', function(req, res){
    
  var db = req.arango.db;
  var collection = req.arango.collections.devices;
    
  //console.log(typeof(req.body) + " : " + JSON.stringify(req.body));
  var device = req.body;
  //device.apps = [];
  device.classes = []; // an array for device classes
    
  // go through the connected devices if any and add
  // classes that correspond to the device type e.g. if device has a speaker
  // add clas canPlaySound.
  // also add connected device's information as attributes
  // for example if speaker has a model adds that as an attribute named speaker-model
  if ( device['connectedDevices'] ) {
    _.each( device['connectedDevices'], function ( deviceAttrs, deviceType ) {
      // contains the mapping information between device types and classes
      var deviceType2class = {
        speaker: 'canPlaySound',
        tempSensor: 'canMeasureTemperature',
        led : 'canTurnLight',
        fireDetector: 'canDetectFire'
      };
        
      if ( deviceType2class[deviceType] ) {
        device.classes.push( deviceType2class[deviceType] );
        _.each( deviceAttrs, function ( value, deviceAttrName ) {
          device[ deviceType +'-' +deviceAttrName ] = value;
        });
      }
    });
  }
  collection.save(device)
    .then(function(meta){
      //console.log(meta._key);
      //next();
      res.status(200).send(meta._key);
    })
    .catch(function(err){
      console.error(err);
      //next();
      res.status(400).send(err.toString());
    });
});

// get a device specified with its id
// This api does not use AQL query
router.get('/id/:id', function(req, res){

  var db = req.arango.db;
  var collection = req.arango.collections.devices;

  collection.document(req.params.id.toString())
    .then(function(doc){
      //console.log(typeof(doc) + " : " + doc);
      res.status(200).send(JSON.stringify(doc));
    })
    .catch(function(err){
      console.error(err);
      res.status(400).send(err.toString());
    });
});

// adds the app information in the requests body to the specified device's apps list.
// This api uses AQL query
router.post( '/:id/apps', function ( req, res ) {
  
  var db = req.arango.db;
  var devId = req.params.id.toString();

  db.query(aqlQuery`
    FOR device IN devices
      FILTER device._key == ${devId}
        UPDATE device WITH {apps: HAS(device, "apps") ? PUSH(device.apps[*], ${req.body}) : [${req.body}]} IN devices
        RETURN NEW
    `)
    .then(function(result){
      if(result._result.length == 0){
        throw new Error('Ther is no device or app with the given ids');
      }
      res.status(200).send(result._result[0]);
    })
    .catch(function(err){
      res.status(400).send( { 'message': err.toString() } );
    });

});

// deletes the app with the given id from the app list of the specified device
router.delete( '/:devid/apps/:appid', function ( req, res ) {
  
  var db = req.arango.db;
  var devId = req.params.devid.toString();
  var appId = parseInt(req.params.appid);

  db.query(aqlQuery`
    FOR device IN devices
      FILTER device._key == ${devId}
      FOR app in device.apps[*]
        FILTER app.id == ${appId}
        UPDATE device WITH {apps: REMOVE_VALUE(device.apps[*], app)} IN devices
        RETURN NEW
    `)
    .then(function(result){
      if(result._result.length == 0){
        throw new Error('Ther is no device or app with the given ids');
      }
      res.status(200).send(result._result[0]);
    })
    .catch(function(err){
      res.status(400).send( { 'message': err.toString() } );
    });
});

// deletes the device with the given id from the app list of the specified device
router.delete( '/:devname', function ( req, res ) {
  
  var db = req.arango.db;
  var devName = req.params.devname;
  //var appId = parseInt(req.params.appid);

  db.query(aqlQuery`
    FOR device IN devices
      FILTER device.name == ${devName}
      REMOVE device IN devices RETURN OLD
    `)
    .then(function(result){
      if(result._result.length == 0){
        throw new Error('Ther is no device or app with the given name');
      }
      res.status(200).send(result._result[0]);
    })
    .catch(function(err){
      res.status(400).send( { 'message': err.toString() } );
    });
});

// updates the app information in the requests body to the specified device's apps list.
// This api uses AQL query
router.put( '/:devid/apps/:appid', function ( req, res ) {
  
  var db = req.arango.db;
  var devId = req.params.devid.toString();
  var appId = parseInt(req.params.appid);

  db.query(aqlQuery`
    FOR device IN devices
      FILTER device._key == ${devId}
      FOR app in device.apps[*]
        FILTER app.id == ${appId}
        UPDATE device WITH {apps: PUSH(REMOVE_VALUE(device.apps[*], app), ${req.body})} IN devices
        RETURN NEW
    `)
    .then(function(result){
      if(result._result.length == 0){
        throw new Error('Ther is no device or app with the given ids');
      }
      res.status(200).send(result._result[0]);
    })
    .catch(function(err){
      res.status(400).send( { 'message': err.toString() } );
    });
});

// TO DO: it is not yet converted to use arango db
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

// TO DO: it is not yet converted to use arango db
router.get("/functionality?", function(req, res){
    var db = req.db;
    var tempSensor = req.query.tempSensor;
    //console.log(tempSensor);
    var speaker = req.query.speaker;
    var qs = "";
    if(tempSensor && speaker){
        qs = {"connectedDevices": {"tempSensor": {"model": tempSensor}, "speaker": {"model": speaker} } };
    } else if(tempSensor) {
        qs = {"connectedDevices": {"tempSensor": {"model": tempSensor} } };
    } else if(speaker) {
        qs = {"connectedDevices": {"speaker": {"model": speaker} } };
    } else { 
        //qs = {"connected-devices": {"temp-sensor": {"model": tempSensor}, "speaker": {"model": speaker} } };
        qs = {};
    }
    //console.log(JSON.stringify(qs));
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
