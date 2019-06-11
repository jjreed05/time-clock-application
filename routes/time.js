const express = require("express");
const router = express.Router();
const ADMIN = 'admin';
const ADMIN_PWD = 'admin123';
const mongoClient = require("mongodb");
const mongoose = require("mongoose");

// here is where we will handle any database call
const uri = 'mongodb+srv://admin:admin123@gps-time-afto7.mongodb.net/test?retryWrites=true';

router.post("/addPunchIn", function(req, res){
    const id = req.body._id;
    const date = req.body.date;
    const location = req.body.location;
    const time = req.body.time;
    const timeObj = { date, location, timeIn: time };

    // connect to the database
    mongoClient.connect(uri, { useNewUrlParser: true }, function(err, client){
        if (err) throw err;

        const collection = client.db("usersDb").collection("timeTable");

        // find the user's table
        collection.findOneAndUpdate({ userId: id }, {$push: {"time": timeObj}}, function(err, result){
            if (err) throw err;
            res.send(result);
            client.close();
        });
    });

});

module.exports = router;