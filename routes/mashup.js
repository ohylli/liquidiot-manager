/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016 All rights
 * reserved.
 * 
 * Main author(s): Farshad Ahmadi Ghohandizi <farshad.ahmadi.gh@gmail.com> Otto
 * Hylli <otto.hylli@tut.fi>
 */

var express = require( 'express' );
var Swagger = require( 'swagger-client' );
var _ = require( 'lodash' );

var router = express.Router();

// permitted operations in comparisons
var comparisonOperators = [ '<', '>', '==', '>=', '<=', '!=' ];

// executes the mashup send in the post request body
router.post( '/', function( req, res ) {
    executeMashup( req.body, function ( err, result ) {
        if ( err ) {
            return res.status( 400 ).send( { 'message': err.message } );
        }
        
        var body = { status: 'ok' };
        if ( result ) {
            body.result = result;
        }
        
        res.send( body );
    });
});

// executes the given mashup description object
// callback is executed when mashup execution is completed or an error is encountered
function executeMashup( mashup, done ) {
    // swaggerclients for communicating with the apps
    //  the api description url will be the key
    var clients = {}; 

    //  create the swagger clients for the apps in the mashup
    var clientPromises = mashup.apps.map( function ( url ) {
        return new Swagger( { url: url, usePromise: true } )
        .then( function ( client ) {
            clients[url] = client;
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
            console.err( "Unsupported component type " +component.type );
            done( new Error( "Unsupported component type " +component.type ) );
        }
    }

    // functions for executing different mashup components
    var executors = {};
    //  executes a operation component i.e. a component that communicates with a
    //  server
    executors.operation = function ( operation, input, output, callback ) {
        console.log( 'executing ' +operation.operationId );
        // use the apps swagger client to perform the operation defined in the
        // component
        var client = clients[operation.app];
        client[operation.tag][operation.operationId]( {}, {} )
        .then( function ( res ) {
            // save the value from the response  to the operation's output variable if given
            if ( output ) {
                var value = {};
                // from which app the value came
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

            callback();
        })
        .catch( function ( err ) {
            console.log( err );
            done( err );
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
}

module.exports = router;