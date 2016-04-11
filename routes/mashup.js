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
    executeMashup( req.body, function ( err ) {
        if ( err ) {
            return res.status( 400 ).send( { 'message': err.message } );
        }
        
        var result = { status: 'ok' };
        res.send( result );
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
        // executes the next component or if the last component calls the call back
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
        if ( component.type === 'operation' ) {
            executeOperation( component, next );
        }

        else if ( component.type === 'if' ) {
            executeCondition( component, next );
        }

        else {
            console.err( "Unsupported component type " +component.type );
            done( new Error( "Unsupported component type " +component.type ) );
        }
    }

    //  executes a operation component i.e. a component that communicates with a
    //  server
    function executeOperation( operation, callback ) {
        console.log( 'executing ' +operation.operationId );
        // use the apps swagger client to perform the operation defined in the
        // component
        var client = clients[operation.app];
        client[operation.tag][operation.operationId]( {}, {} )
        .then( function ( res ) {
            // save the output to the operation's output variable if given
            if ( operation.output ) {
                var output = mashup.variables[operation.output];
                output.value = res.obj; // save the operations result for future use
            }

            callback();
        })
        .catch( function ( err ) {
            console.log( err );
            done( err );
        });
    }

    // executes a condition component i.e. if
    function executeCondition( condition, callback ) {
        // get the value from the component's input variable
        // assumes that the output has only one value and that it is a number
        // not really a good solution, but works in this proof of concept
        var input = mashup.variables[condition.input1].value;
        var value = input[Object.keys( input )[0]];
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
            console.log(  'Illegal operand ' +condition.operator  );
            done( new Error( 'unrecognized operator ' +condition.operator +' in if' ));
        }
    }
}

module.exports = router;