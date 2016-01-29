/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farshad.ahmadi.gh@gmail.com>
 * Otto Hylli <otto.hylli@tut.fi>
 */

var express = require('express');
var css2mongo = require( '../utils/css2mongo' );
var router = express.Router();
var _ = require( 'lodash' );
var mongo = require( 'mongoskin' );
var toObjectID = mongo.helper.toObjectID;

// Gets the list of devices.
// can be filtered with a device selector string as a query parameter named q
router.get('/', function(req, res) {
    var db = req.db;
    var dbQuery = {};
    // if the request has a query parameter containing a device selector string
    // parse it into a mongodb query
    if ( req.query.q ) {
       try {
          dbQuery = css2mongo( req.query.q );
       }
       
       catch ( error ) {
          res.status( 400 ).send( { 'message': 'selector query parsing failed: ' +error } );
          return;
       }
       
       console.log( dbQuery );
   }

    db.collection('device').find( dbQuery ).toArray(function(err, items){
        if(err){
            res.status(400).send(err.toString());
        } else {
            res.status(200).send(JSON.stringify(items));
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
             'temp-sensor': 'canMeasureTemperature'
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

router.post( '/:id/aps', function ( req, res ) {
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
