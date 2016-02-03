/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Antti Nieminen <antti.h.nieminen@tut.fi>
 */

/**
 * A simple command line script for trying out css2mongo queries on MongoDB.
 */


var css2mongo = require('./css2mongo');
var mongodb = require('mongodb');

var MongoClient = mongodb.MongoClient;

var args = process.argv.slice(2);

if (args.length < 3) {
  console.log('Usage: node try_css2mongo.js <MONGOURL> <COLLECTION> <CSSQUERY>');
  console.log('Example: node try_css2mongo.js mongodb://localhost:27017/mydb devices .foobar');
  process.exit(1);
}

run.apply(null, args);

function run(url, collection) {
  var qs = Array.apply(null, arguments).slice(2);
  MongoClient.connect(url, function(err, db) {
      if (err) {
        console.log(err);
        process.exit(1);
      }

      var coll = db.collection(collection);

      var queries = qs.map(function(q) {
        return query(coll, q);
      });

      Promise.all(queries).then(function() {
        db.close();
      });
  });
}



function query(db, q) {
  var mq = css2mongo(q);
  return db.find(mq).toArray().then(function(result) {
    console.log("\n\nCSS Query:\n", q);
    console.log("\nMongoDB Query:\n", JSON.stringify(mq));
    console.log("\nRESULT:\n", result);
  });
}
