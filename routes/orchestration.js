/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016 All rights
 * reserved.
 * 
 * Main author(s): Farshad Ahmadi Ghohandizi <farshad.ahmadi.gh@gmail.com> Otto
 * Hylli <otto.hylli@tut.fi>
 */

// this file contains features for managing and executing orchestrations

var express = require( 'express' );
var request = require( 'request' );
var Swagger = require( 'swagger-client' );
var _ = require( 'lodash' );
var mongo = require( 'mongoskin' );
var toObjectID = mongo.helper.toObjectID;

var router = express.Router();

// permitted operations in comparisons
var comparisonOperators = [ '<', '>', '==', '>=', '<=', '!=' ];
var collectionName = 'orchestration';

// add the orchestration send in the request to the database
router.post( '/orchestrations', function( req, res ) {
    var db = req.db;
    var orc = req.body;
    var result = validateOrchestration( orc );
    
    // check that the orchestration is valid and add only if it is
    if ( !result.valid ) {
        return res.status( 400 ).send( { message: result.reason });
    }
    
    db.collection( collectionName ).insert( orc, function ( err, result ) {
        if ( err ) {
            res.status( 500 ).send( err );
        }
        
        if ( result.insertedCount != 1 ) {
            return res.status( 500 ).send( { message: 'Failed to insert to database.'});
        }
        
        res.send( result.ops[0] );
    });
});

// get list of orchestrations that includes name, description and _id
router.get( '/orchestrations', function ( req, res ) {
   var db = req.db;
   // get only id, name and description
   var project = { name: 1, description: 1, '_id': 1 };
   db.collection( collectionName ).find().project( project ).toArray( function ( err, results ) {
       if ( err ) {
           return res.status( 500 ).send( err );
       }
       
       res.send( results );
   });
});

// Get an orchestration by id
router.get( '/orchestrations/:id', function( req, res ) {
    var db = req.db;
    db.collection( collectionName ).findById( req.params.id, function ( err, result ) {
        if ( err ) {
            return res.status( 500 ).send( err );
        }
        
        if ( !result ) {
            return res.status( 404 ).send( { message: 'Orchestration with id ' +req.params.id +' not found.' });
        }
        
        return res.send( result );
    });
});

// delete the orchestration by id
router.delete( '/orchestrations/:id', function ( req, res ) {
    var db = req.db;
    db.collection( collectionName ).removeById( req.params.id, function ( err, result ) {
        if ( err ) {
            return res.status( 500 ).send( err );
        }
        
        if ( result !== 1 ) {
            return res.status( 404 ).send( { message: 'Orchestration with id ' +req.params.id +' not found.' });
        }
        
        return res.send( { 'status': 'ok' } );
    }); 
});

// update orchestration's information
router.put( '/orchestrations/:id', function ( req, res ) {
    var db = req.db;
    var query = { '_id': toObjectID( req.params.id ) };
    db.collection( collectionName ).update( query, req.body, function ( err, result ) {
        if ( err ) {
            return res.status( 500 ).send( err );
        }

        // did the query find anything
        if ( result.result.n == 0 ) {
            return res.status( 404 ).send( { message: 'Orchestration with id ' +req.params.id +' not found.' } );
        }
        
        return res.send( req.body );
    });
});

// executes the mashup send in the post request body
router.post( '/', function( req, res ) {
    executeMashup( req.body, req.app, function ( err, result ) {
        if ( err ) {
            return res.status( 400 ).send( { 'message': err.message } );
        }
        
        var body = { status: 'ok' };
        // add the mashup result to response body if there was one
        if ( result ) {
            body.result = result;
        }
        
        res.send( body );
    });
});

// validates the given orchestration object
// return value is an object with a boolean value field named valid
// if the value is false the object contains a string attributed named reason which explains 
// what is wrong with the orchestration
function validateOrchestration( orchestration ) {
    var result = { valid: true };
    if ( !orchestration.name ) {
        result.valid = false;
        result.reason = "The orchestration doesn't have a name.";
        return result;
    }
    
    // todo better validation needed may be use JSON schema and additional validation
    return result;
}

// executes the given mashup description object
// expressApp is the express application whose information is used
// done (a callback function)  is executed when mashup execution is completed or an error is encountered
function executeMashup( mashup, expressApp, done ) {
    // swaggerclients for communicating with the apps
    //  the api description url or dynamic app id will be the key
    var clients = {};
    // information about what actual apps matched the dynamic app definitions
    var dynamicApps = {};
    var count = 0; // how many dynamic apps, used in counting callbacks
    mashup.appMap = {};
    // find out what actual apps correspond to the dynamic app queries
    mashup.apps.forEach( function ( app ) {
        if (typeof app == 'object' && app.api ) {
            mashup.appMap[app.id] = app;
            dynamicApps[app.id] = [ app.api ];
        }
        
        else if ( typeof app == 'object' ) {
            mashup.appMap[app.id] = app;
            // this is a dynamic app group not a predefined api url
            count++; // one more dynamic app to process
            // query parameters for the request that gets the apps
            var query = {};
            if ( app.app ) {
                // what kind of apps we want
                query.app = app.app;
            }
            
            if ( app.device ) {
                // on which kind of device
                query.device = app.device;
            }
            
            // url for device and app query api
            var url = 'http://localhost:' +expressApp.get( 'port' ) +'/devices';
            request.get( {
                url: url,
                qs: query,
                json: true
            }, function ( err, resp, body ) {
                if ( err ) {
                    done( err );
                }
                
                if ( resp.statusCode != 200 ) {
                    return done( new Error( 'Could not get dynamic apps for ' +app.id ));
                }
                
                if ( body.length == 0 ) {
                    // no dynamic apps found cannot continue execution
                    var message = "No dynamic apps found for " +app.id;
                    console.log( message );
                    return done( new Error( message ));
                }
                
                count--; // one dynamic app processed
                var apis = []; // api description urls
                
                // for each device get the apps that matched the query and build the url for getting the app's
                // api description
                body.forEach( function( device ) {
                    device.matchedApps.forEach( function ( deviceApp ) {
                        apis.push( url +'/' +device._id +'/apps/' +deviceApp.id +'/api' );
                    });
                });
                
                dynamicApps[app.id] = apis;
                
                if ( count == 0 ) {
                    // all dynamic apps processed
                    console.log( "Dynamic apps processed found:", dynamicApps );
                    // now we can get swagger clients for all apps both dynamic and predefined
                    getClients();
                }
            });
        }
    });

    // this mashup did not contain any dynamic apps
    if ( count == 0 ) {
        console.log( "no dynamic apps" );
        getClients();
    }
    
    // get swagger clients for all apps participating in the mashup both dynamic and predefined
    function getClients() {
        //  create the swagger clients for the predefined apps
        var clientPromises = mashup.apps.filter( function( app ) {
            // now process only predefined apps not dynamic
            return typeof app == 'string';
        })
        .map( function ( url ) {
            return new Swagger( { url: url, usePromise: true } )
            .then( function ( client ) {
                // save the client app api description url is the key
                clients[url] = [client];
            });
        });

        // get clients for dynamically defined applications
        _.forEach( dynamicApps, function( urls, id ) {
            var appGroup = mashup.appMap[ id ];
            // for saving the clients for this dynamic app definition
            // the id is the key
            clients[ id ] = [];
            urls.forEach( function( url ) {
                // a promise for client creation
                var clientPromise = new Swagger( { url: url, usePromise: true } );
                clientPromises.push( clientPromise );
                clientPromise.then( function( client ) {
                    if ( appGroup.auth ) {
                        if ( appGroup.auth.type == 'basic' ) {
                            var auth = new Swagger.PasswordAuthorization( appGroup.auth.username, appGroup.auth.password );
                            client.clientAuthorizations.add( 'basicAuth',  auth );
                        }
                    }
                   clients[ id ].push( client ); 
                });
            });
        });
        
        //  when all clients are created start executing the mashup
        Promise.all( clientPromises )
        .then( function () {
            console.log( "Clients created. Execution started." );
            // execute the first component
            executeComponent( mashup.components, 0, function () { 
                console.log( "done" );
                // if the mashup has a result field add the variabled it refers to the response 
                if ( mashup.result && mashup.variables[ mashup.result ] ) {
                    return done( null, mashup.variables[ mashup.result ]);
                }

                done();
            });
        })
        .catch( function ( err ) { 
            console.log( err );
            done( err );
        });
    }

    //  executes the component from components array with the given index
    //  callback is called when all componets in the array have been executed
    function executeComponent( components, index, callback ) {
        console.log( "execute component" );
        // will be called when the component and its possible subcomponents are
        // executed
        // executes the next component or if the last component calls the callback
        // for the component array
        function next() {
            console.log( "next" );
            if ( index < components.length -1 ) {
                executeComponent( components, index +1, callback );
            }

            else {
                callback();
            }
        }

        // component to be executed
        var component = components[index];
        // get the components input and output variables
        var input = mashup.variables[ component.input ];
        var output = mashup.variables[ component.output ];
        
        // check if there is a function for executing the type of component we have
        if ( executors[ component.type ] ) {
            // execute the component
            executors[ component.type]( component, input, output, next );
        }

        else {
            console.log( "Unsupported component type " +component.type );
            done( new Error( "Unsupported component type " +component.type ) );
        }
    }

    // functions for executing different mashup components
    var executors = {};
    //  executes a operation component i.e. a component that communicates with a
    //  server
    executors.operation = function ( operation, input, output, callback ) {
        console.log( 'executing ' +operation.operationId );
        // perform the operation to all apps defined for this component
        // the app can refer to a particular app by api description url or to a dynamic app definition by id
        var operationClients = clients[operation.app];

        var operationPromises = operationClients.map( function( client ) {
            return client[operation.tag][operation.operationId]( {}, {} )
            .then( function ( res ) {
                // save the value from the response  to the operation's output variable if given
                if ( output ) {
                    var value = {};
                    // from which app the value came
                    // todo fix doesn't work with dynamic apps
                    value.source = operation.app;
                    if ( output.type == "Number" || (output.type == "Array" && output.item == "Number"  )) {
                        // we want a number from the response that will be saved to a variable or added to an array
                        // assumes that the response body has only one value and that it is a number
                        // not really a good solution, but works in this proof of concept
                        value.value = res.obj[Object.keys( res.obj )[0]];
                        if ( output.type == "Number" ) {
                            output.value = value;
                        }

                        else {
                            // save to array create an array if this is the first value
                            if ( output.value == undefined ) {
                                output.value = [];
                            }

                            output.value.push( value );
                        }
                    }

                    else {
                        // value type not recognized
                        if ( output.type == "Array" ) {
                            var message = "Unrecognized type " +output.item +" for array item.";
                        }

                        else {
                            var message = "Unrecognized type " +output.type +" for variable."; 
                        }

                        console.log( message );
                        done( new Error( message ));
                    }
                }
            })
            .catch( function ( err ) {
                console.log( err );
                done( err );
            });
        });

        // continue when the operation has been performed to all apps
        Promise.all( operationPromises )
        .then( function () {
            callback();
        });
    };

    // executes a condition component i.e. if
    executors.if = function ( condition, input, output,  callback ) {
        // get the value from the component's input variable
        // note if can have multiple inputs so the parameter input doesn't work with this component type
        var value = mashup.variables[condition.input1].value.value;
        // check that we have a legal comparison operation
        if ( _.includes( comparisonOperators, condition.operator ) ) {
            var expression = value +' ' +condition.operator +' ' +condition.value;
            console.log( expression );
            if ( eval( expression ) ) {
                console.log( 'condition ok' );
                // condition ok execute the then branch of componets
                executeComponent( condition.then, 0, callback );
            }

            else {
                console.log( 'condition not ok' );
                callback();
            }
        }
        
        else {
            console.log(  'Illegal operator ' +condition.operator  );
            done( new Error( 'unrecognized operator ' +condition.operator +' in if' ));
        }
    };
    
    // calculates the average for the array in the input variable and saves it to output variable
    executors.average = function ( component, input, output, callback ) {
        var inputVal = input.value;
        var sum = 0;
        var numbers = "";
        for ( i = 0, len = inputVal.length; i < len; i++ ) {
            sum += inputVal[i].value;
            numbers += inputVal[i].value +" ";
        }

        var avg = sum /inputVal.length;
        console.log( "Calculating average for " +numbers +" result " +avg );
        output.value = { value: avg };
        callback();
    };
    
    // execute component that gets the minimum value from the array in the input variable
    // the result is saved to the output variable
    executors.minimum = function ( component, input, output, callback ) {
        var inputVal = input.value;
        var min = Math.min.apply( null, inputVal.map( function ( item ) { return item.value }));
        console.log( "Got minimum value " +min );
        output.value = { value: min };
        callback();
    };
    
    // execute maximum component which gets the maximum value from a array
    executors.maximum = function ( component, input, output, callback ) {
        var inputVal = input.value;
        var max = Math.max.apply( null, inputVal.map( function ( item ) { return item.value }));
        console.log( "Got maximum value " +max );
        output.value = { value: max };
        callback();
    };
    
    // execute filter component that filters values from the array in input variable
    // and saves the result to output
    executors.filter = function ( component, input, output, callback ) {
        if ( _.includes( comparisonOperators, component.operator ) ) {
            output.value = input.value.filter( function( item ) {
                return eval( item.value +' ' +component.operator +' ' +component.value );
            });
            
            callback();
        }
        
        else {
            var message = "Unrecognized operator " +component.operator +" in filter.";
            console.log( message );
            done( new Error( message ));
        }
    };
}

module.exports = router;