/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Farshad Ahmadi Ghohandizi <farshad.ahmadi.gh@gmail.com>
 * Otto Hylli <otto.hylli@tut.fi>
 */

var arangoDB = require('arangojs')('http://127.0.0.1:3000');
arangoDB.useBasicAuth('root','admin');

var dbName = "liquidiot-dev";
var deviceCollection = "devices";
var apiCollection = "interfaces";

var express = require('express');
var app = express();

arangoDB.listDatabases()
  .then(function(info){
    //console.log(info);
    var dbExists = (info.indexOf(dbName) == -1) ? false : true;
    if(!dbExists){
      return arangoDB.createDatabase(dbName);
    }
  })
  .then(function(){
    arangoDB.useDatabase(dbName);
    return arangoDB.listCollections();
  })
  .then(function(info){
   // console.log(info);
    info = info.map(function(col){
      return col.name;
    });
    var devsCol = arangoDB.collection(deviceCollection);
    var colExists = (info.indexOf(deviceCollection) == -1) ? false : true;
    if(colExists){
      return { info: info, devices: devsCol};
    } else {
      return devsCol.create().then(function(){
        return { info: info, devices: devsCol};
      });
    }
  })
  .then(function(collections){
    //console.log(collections.info);
    var apiCol = arangoDB.collection(apiCollection);
    var colExists = (collections.info.indexOf(apiCollection) == -1) ? false : true;
    if(colExists){
      return {interfaces: apiCol, devices: collections.devices};
    } else {
      return apiCol.create().then(function(){
        return {interfaces: apiCol, devices: collections.devices};
      });
    }
  })
  .then(function(collections){

    var path = require('path');
    var favicon = require('serve-favicon');
    var logger = require('morgan');
    var cookieParser = require('cookie-parser');
    var bodyParser = require('body-parser');
    var rp = require('request-promise');
    var aqlQuery = require('arangojs').aqlQuery;

    var mongo = require('mongoskin');
    //var monk = require('monk');
    //var db = mongo.db("mongodb://dbuser:dbpassword@ds047911.mongolab.com:47911/device", {native_parser:true});
    // get mongodb url from environment variable or try localhost
    var mongoURL = process.env.mongourl || 'mongodb://localhost/dms';
    var db = mongo.db( mongoURL, {native_parser:true});

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
    app.use(bodyParser.json({limit:'50mb'}));
    app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
    //app.use(bodyParser.json());
    //app.use(bodyParser.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));

    app.use(function(req, res, next){
        req.db = db;
        req.arango = {db: arangoDB, collections: collections}
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

        //next();
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
      return arangoDB.query(aqlQuery`
          FOR device IN devices
            RETURN device
          `)
          .then(function(result){
            return result._result;
          });
      /*return new Promise(function (resolve, reject){
        db.collection('device').find({}).toArray(function(err, devs){
          if(err){
            return reject(err)
          } else {
            resolve(devs);
          }
        });
      });*/
    }

    function updateDevice(device){
      //console.log('sssssssssssssssssssssssssssssssss: ' + device._key);
        
      return arangoDB.query(aqlQuery`
        UPDATE ${device._key} WITH {status: ${device.status}} IN devices
        RETURN NEW
        `)
        .then(function(res){
          return res._result;
        })
        .catch(function(err){
          return err;
        });

      /*return new Promise( function(reject, resolve) {
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
      });*/
    }

    setInterval(function(){
      getAllDevices()
        .then(function(devs){
          //console.log(devs);
          Promise.all(devs.map(pingDevicePromise))
            .then(function(updatedDevs){
              Promise.all(updatedDevs.map(updateDevice))
                .then(function(res){
                  //console.log(res);
                });
            });
        })
        .catch(function(err){
          //console.log(err);
        });
    }, 10000);

  })
  .catch(function(err){
    //console.error(err);
  });

module.exports = app;
