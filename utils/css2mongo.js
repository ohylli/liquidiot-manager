/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Antti Nieminen <antti.h.nieminen@tut.fi>
 */


/**
    var css2mongo = require('css2mongo');

    css2mongo('.foo.bar[xxx="yyy"], #AAA');

    {
      "$or": [
        {
          "$and": [
            {
              "classes": {
                "$all": [
                  "bar",
                  "foo"
                ]
              }
            },
            {
              "xxx": "yyy"
            }
          ]
        },
        {
          "_id": "AAA"
        }
      ]
    }

*/

var slick = require('slick');
var mongo = require('mongoskin');

function cssToMongoQuery(css, isApp ) {
  if (typeof css === 'string') {
    css = slick.parse(css);
  }

  if (css.length === 0) {
    return {};
  }
  if (css.length === 1) {
    return exprToMongoQuery(css[0], isApp );
  }

  var or = [];
  for (var i=0; i<css.length; i++) {
    or.push(exprToMongoQuery(css[i], isApp ));
  }
  return {'$or': or};
}

function exprToMongoQuery(expr, isApp ) {
  if (expr.length !== 1) {
    throw "ERROR: Multiple parts in an expressions doesn't make sense";
  }

  var part = expr[0];

  var and = [];

  if (part.id) {
    and.push(idToMongoQuery(part.id, isApp ));
  }

  if (part.tag !== '*') {
    and.push(tagToMongoQuery(part.tag, isApp));
  }

  if (part.classList) {
    and.push(classesToMongoQuery(part.classList, isApp ));
  }

  if (part.attributes) {
    and.push(attributesToMongoQuery(part.attributes));
  }

  if (part.pseudos) {
    and.push(pseudosToMongoQuery(part.pseudos ));
  }

  if (and.length === 0) {
    return {};
  }
  if (and.length === 1) {
    return and[0];
  }
  return {$and: and};
}

function classesToMongoQuery(classes, isApp) {
    var value = {$all: classes};
    var key = 'classes';
  if (classes.length === 1) {
    value =  classes[0];
  }
  
  if ( isApp ) {
      key = 'applicationInterfaces';
  }
  
  var returnObj = {};
  returnObj[key] = value;
  return returnObj;
}

function idToMongoQuery(id, isApp ) {

  if ( isApp ) {
      return { id: parseInt(id) };
  }

  try {
    id = new mongo.ObjectId(id);
  }
  catch(e) {
    // id was not a valid MongoDB ObjectId
    // Let's use the id as is.
    // (The query will most likely return empty...)
  }
  return {_id: id};
}

function tagToMongoQuery(tag, isApp) {
  return {type: tag};
}

function attributesToMongoQuery(attrs) {
  if (attrs.length === 1) {
    return attrToMongoQuery(attrs[0]);
  }
  return {$and: attrs.map(attrToMongoQuery)};
}

function attrToMongoQuery(attr) {
  var q = {};
  var op = attr.operator;
  if (op === '=') {
    q[attr.name] = attr.value;
  }
  else {
    // TODO: other operators
    throw "Unknown operator: " + attr.operator;
  }
  return q;
}

function pseudosToMongoQuery(pseudos) {
  if (pseudos.length === 1) {
    return pseudoToMongoQuery(pseudos[0]);
  }
  return {$and: pseudos.map(pseudoToMongoQuery)};
}

function pseudoToMongoQuery(pseudo) {
  if (pseudo.name === 'not' && pseudo.value) {
    // http://stackoverflow.com/a/32972463
    return {$nor: [cssToMongoQuery(pseudo.value)]};
  }
  // TODO: other pseudo classes
  throw "Unknown pseudo: " + pseudo.name;
}

module.exports = cssToMongoQuery;
