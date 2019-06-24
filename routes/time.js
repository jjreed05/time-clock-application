const express = require("express");
const router = express.Router();
const ADMIN = 'admin';
const ADMIN_PWD = 'admin123';
const mongoClient = require("mongodb");
const mongoose = require("mongoose");

// here is where we will handle any database call
const uri = 'mongodb+srv://admin:admin123@gps-time-afto7.mongodb.net/test?retryWrites=true';

router.post("/addPunchIn", function(req, res){
    const email = req.body.email;
    const timestamp = req.body.timestamp;
    const location = req.body.location;
    const timeObj = { timestampIn: timestamp, locationIn: location };

    // connect to the database
    mongoClient.connect(uri, { useNewUrlParser: true }, function(err, client){
        if (err) throw err;

        const collection = client.db("usersDb").collection("timeTable");

        //get punchNums first
        collection.findOne({ email: email }, function(err, result){
            if (err) throw err;
            console.log("Found user, punching in");

            // this variable will allow us to keep track of the array
            const punchNums = result.punchNums + 1;
            const isWorking = result.isWorking;
            

            // make sure they are punched out before punching in
            if (!isWorking){
                collection.updateOne({ email: email }, {$set: {isWorking: true, punchNums: punchNums}, $push: {time: timeObj}},
                    function(err, result){
                        if (err) throw err;
                        res.send({
                            'punchedIn': true,
                            'lastPunch': timestamp,
                            'location': location
                        })
                        client.close();
                    });
            } else {
                res.status(400).send("User already punched in");
                client.close();
            }
        });
    });
});

router.post("/addPunchOut", function(req, res){
    const email = req.body.email;
    const timestamp = req.body.timestamp;
    const location = req.body.location;

    // connect to the database
    mongoClient.connect(uri, { useNewUrlParser: true }, function(err, client) {
        if (err) throw err;

        const collection = client.db("usersDb").collection("timeTable");

        collection.findOne({email: email}, function(err, result){
            if (err) throw err;
            console.log("Found user, punching out");
            console.log("result: ");
            console.log(result);

            const punchNums = result.punchNums;
            const isWorking = result.isWorking;
            result.time[result.time.length - 1].locationOut = location;
            result.time[result.time.length - 1].timestampOut = timestamp;

            // lets just make sure that they are working just in case
            if (isWorking) {
                collection.updateOne({email: email}, {$set: {isWorking: false, time: result.time}},
                    function(err, result){
                        if (err) throw err;
                        res.send({
                            'punchedIn': false,
                            'lastPunch': timestamp,
                            'location': location
                        })
                        client.close();
                    });
            } else {
                res.status(400).send("User isn't punched in");
                client.close();
            }
        });
    });
});

router.get('/getLastPunch', function (req, res){
    const email = req.query.email;
    console.log(email);

    mongoClient.connect(uri, { useNewUrlParser: true}, function(err, client){
        if (err) throw err;

        const collection = client.db("usersDb").collection("timeTable");
        collection.findOne({ email: email }, function(err, result){
            if (err) throw err;

            if (!result)
                return res.status(400).send("User not found");
            const isWorking = result.isWorking;
            console.log('isWorking: ' + isWorking);
            const time = result.time;
            console.log('time');
            console.log(time);
            if (time.length == 0)
                return res.status(400).send("No punches found");
            const lastPunch = time.pop();
            console.log(lastPunch);
            let lastPunchTimestamp = null;
            let location = null;
            if (isWorking){
                lastPunchTimestamp = lastPunch.timestampIn;
                location = lastPunch.locationIn;
            } else {
                lastPunchTimestamp = lastPunch.timestampOut;
                location = lastPunch.locationOut;
            }
            res.send({
                'punchedIn': isWorking,
                'lastPunch': lastPunchTimestamp,
                'location': location
            })
        });
    });
    // return 
});

router.get('/getPunches', function (req, res){
   const email = req.query.email;

   mongoClient.connect(uri, { useNewUrlParser: true }, function (err, client){
      if (err) throw err;

      const collection = client.db("usersDb").collection("timeTable");
      collection.findOne({ email: email}, function(err, result){
         if (err) throw err;

         if (!result)
            return res.status(400).send("User not found");
         res.send({
            'punches': result.time
         })
      })
   })
})

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