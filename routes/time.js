const express = require("express");
const router = express.Router();
const ADMIN = 'admin';
const ADMIN_PWD = 'admin123';
const mongoClient = require("mongodb");
const mongoose = require("mongoose");

// here is where we will handle any database call
const uri = 'mongodb+srv://admin:admin123@gps-time-afto7.mongodb.net/test?retryWrites=true';

router.post("/addPunchIn", function(req, res){
    const user = req.body.email;
    const date = req.body.date;
    const location = req.body.location;
    const timeObj = { timestampIn: timestamp, locationIn: location };

    // connect to the database
    mongoClient.connect(uri, { useNewUrlParser: true }, function(err, client){
        if (err) throw err;

        const collection = client.db("usersDb").collection("timeTable");

        //get punchNums first
        collection.findOne({ email: user }, function(err, result){
            if (err) throw err;

            // this variable will allow us to keep track of the array
            const punchNums = result.punchNums + 1;

            // update the time table
            collection.updateOne({ email: user }, {$set: {isWorking: true, punchNums: punchNums}, $push: {time: timeObj}},
                function(err, result){
                    if (err) throw err;
                    res.send(true);
                    client.close();
                });
        });
    });
});

router.post("/addPunchOut", function(req, res){
    const email = req.body.email;
    const date = req.body.date;
    const location = req.body.location;

    // connect to the database
    mongoClient.connect(uri, { useNewUrlParser: true }, function(err, client) {
        if (err) throw err;

        const collection = client.db("usersDb").collection("timeTable");

        collection.findOne({email: email}, function(err, result){
            if (err) throw err;

            const punchNums = result.punchNums;
            const isWorking = result.isWorking;
            let timeArray = result.time;

            timeArray[punchNums].locationOut = location;
            timeArray[punchNums].timestampOut = timestamp;

            // lets just make sure that they are working just in case
            if (isWorking) {
                collection.updateOne({email: email}, {$set: {isWorking: false, time: timeArray}},
                    function(err, result){
                        if (err) throw err;
                        res.send(true);
                        client.close();
                    });
            }
            else{
                res.status(400).send("Isn't punched in");
                client.close();
            }
        });
    });
});

router.get('/getLastPunch', function (req, res){
    const email = req.body.email;

    mongoClient.connect(uri, { userNewUrlParser: true}, function(err, client){
        if (err) throw err;

        const collection = client.db("usersDb").collection("timeTable");
        collection.findOne({ email: email }, function(err, result){
            if (err) throw err;
            const isWorking = result.isWorking;
            const time = result.time;
            const lastPunch = time.pop();
            let lastPunchTimestamp = null;
            if (isWorking){
                lastPunchTimestamp = lastPunch.timestampIn;
            } else {
                lastPunchTimestamp = lastPunch.timestampOut;
            }
            res.send({
                'punchedIn': isWorking,
                'lastPunch': lastPunchTimestamp
            })
        });
    });
    // return 
});

router.get("/isWorking", function (req, res){
    const email = req.body.email;

    // connect to the database
    mongoClient.connect(uri, { useNewUrlParser: true }, function(err, client) {
        if (err) throw err;

        const collection = client.db("usersDb").collection("timeTable");

        collection.findOne({email: email}, function(err, result){
            if (err) throw err;

            res.send(result.isWorking);
            client.close();
        });
    });
});

module.exports = router;