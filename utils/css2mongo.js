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

  attr.name = toEmbeddedDocument(attr.name);

  var q = {};
  var op = attr.operator;
  if (op === '=') {
    //q[attr.name] = attr.value;
    q[attr.name] = makeLigalAttrValue(attr.value);
  }
  else if (op === '*=') {
    var regex = {};
    regex.$regex = '.*' + attr.value + '.*';
    q[attr.name] = regex;
  }
  else {
    // TODO: other operators
    throw "Unknown operator: " + attr.operator;
  }
  return q;
}

// in mongodb, embedded document is in the form of js objects,
// e.g, 'person' is an embedded document here: [ _id: 1, person {name: "farshad", age: 27}].
// mongodb query should be like this: db.collection.find({"person.name":"farshad"})
// css selectors does not allow dot notation. So, we assumne 'person-name' represents 'name' field of 'person' embedded documents.
// This function tranforms 'person-name' to 'person.name'
function toEmbeddedDocument(attrName) {
  return attrName.split('-').join('.');
}


// This function converts attribute values to legal mongodb queries.
// For example, [location=lt 12 gt 4]   ---> {location: { '$lt': 12, '$gt': 5 }}
function makeLigalAttrValue(attrValue) {

  var q = {};
  var parts = attrValue.split(' ');
  if(parts.length == 1){
    return isNaN(parts[0]) ? attrValue : Number(attrValue);
    //return attrValue;
  }
  else if(parts.length == 2) {

    if(isNaN(parts[1])){
      throw "ERROR: \"" + parts[1] + "\" is not a number.";
    }

    if(parts[0] == 'lt'){
      q.$lt = Number(parts[1]);
    } else if(parts[0] == 'gt'){
      q.$gt = Number(parts[1]);
    } else {
      throw "ERROR: only lt and gt operators are allowed.";
    }

    return q;
  }
  else if(parts.length == 4) {

    if(isNaN(parts[1]) || isNaN(parts[3])){
      throw "ERROR: \"" + parts[1] + "\" or/and \"" + parts[3]  + "\" is/are not (a) number(s).";
    }

    if(parts[0] == 'lt'){
      q.$lt = Number(parts[1]);
    } else if(parts[0] == 'gt'){
      q.$gt = Number(parts[1]);
    } else {
      throw "ERROR: only lt and gt operators are allowed.";
    }

    if(parts[2] == 'lt'){
      q.$lt = Number(parts[3]);
    } else if(parts[2] == 'gt'){
      q.$gt = Number(parts[3]);
    } else {
      throw "ERROR: only lt and gt operators are allowed.";
    }

    return q;
  } else {
    throw "ERROR: \"" + attrValue + "\" is an invalid input.";
  }
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
  } else if (pseudo.name === 'matches' && pseudo.value) {
    return cssToMongoQuery(pseudo.value);
  }
  // TODO: other pseudo classes
  throw "Unknown pseudo: " + pseudo.name;
}

module.exports = cssToMongoQuery;
