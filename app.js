/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farshad.ahmadi.gh@gmail.com>
 * Otto Hylli <otto.hylli@tut.fi>
 */

var MongoClient = require('mongodb').MongoClient;
var mongoURL = process.env.MONGO_DB_URL || 'mongodb://localhost/dms';
//var mongoURL = process.env.mongourl || 'mongodb://localhost/dms';
var express = require('express');
var app = express();

MongoClient.connect(mongoURL).then(function(db){

var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var rp = require('request-promise');


var mongo = require('mongoskin');
//var db = mongo.db( mongoURL, {native_parser:true});

console.log(mongoURL);

var devices = require('./routes/index');
var interfaces = require( './routes/interfaces' );
var orchestration = require( './routes/orchestration' );
var devcap = require( './routes/devicecapabilities' ).router;


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use(function(req, res, next){

    req.db = db;
    //req.db1 = db1;
    var flag = false;
    //if(req.headers.origin === "http://koodain.herokuapp.com"){
    if(req.headers.origin){
      res.header('Access-Control-Allow-Origin', req.headers.origin);
      flag = true;
    }
    if(req.headers['access-control-request-method']) {
        res.header('Access-Control-Allow-Methods', req.headers['access-control-request-method']);
        flag = true;
    }
    if(req.headers['access-control-request-headers']) {
        res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers']);
        flag = true;
    }
    if(flag) {
        res.header('Access-Control-Max-Age', 60 * 60 * 24 * 365);
    }

    if(flag && req.method === "OPTIONS"){
      res.sendStatus(200);
    } else {
      next();
    }
});

app.use('/', devices );
app.use( '/apis', interfaces );
app.use('/devices', devices );
app.use( '/orchestration', orchestration );
app.use( '/devicecapabilities', devcap );

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

function pingDevicePromise(device){
  return rp.get({url: device.url, simple: false})
    .then(function(res){
      device.status = 'active';
      return device;
    })
    .catch(function(err){
      device.status = 'passive';
      return device;
    });
}

function getAllDevices() {
  return new Promise(function (resolve, reject){
    db.collection('device').find({}).toArray(function(err, devs){
      if(err){
        return reject(err)
      } else {
        resolve(devs);
      }
    });
  });
}

function updateDevice(device){
  return new Promise( function(reject, resolve) {
    var query = {'_id': mongo.helper.toObjectID(device._id)};
    var update = {'$set': {'status': device.status} };
    var options = {returnOriginal: false};
    //console.log('1:');
    //console.log(device._id);
    //db.collection('device').find(query).toArray(function(err, dev){
    //db.collction('device').findOneAndUpdate(query, update, options, function(err, res){
    db.collection('device').update(query, update, function(err, res){
      if(err){
        return reject(err);
      } else {
        //console.log('2:');
        //console.log(res);
        resolve(res);
      }
    });
  });
}

setInterval(function(){
  getAllDevices()
    .then(function(devs){
      Promise.all(devs.map(pingDevicePromise))
        .then(function(updatedDevs){
          Promise.all(updatedDevs.map(updateDevice))
            .then(function(res){
            })
            .catch(function(err){
            });
        });
    })
    .catch(function(err){
      console.log(err);
    });
}, 10000);
    

})
.catch(function(err){
    console.log(err.toString());
});

module.exports = app;

