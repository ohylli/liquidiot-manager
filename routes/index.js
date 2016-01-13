var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
    var db = req.db;
    //var f = req.query.functionality || "";
    //var functionalities = f.split(',');
    //db.collection('device').find({"connected-devices": {tempSensor: {$exists:true}}}).toArray(function(err, items){

    db.collection('device').find({}).toArray(function(err, items){
        if(err){
            res.status(400).send(err.toString());
        } else {
            res.status(200).send(JSON.stringify(items));
        }
    });
});

router.post('/', function(req, res){
    var db = req.db;
    console.log(typeof(req.body) + " : " + JSON.stringify(req.body));
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
