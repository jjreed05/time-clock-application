const express = require("express");
const router = express.Router();
const mongoClient = require("mongodb");
const nodemailer = require("nodemailer");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// here is where we will handle any database call
const uri = process.env.DB_URI;

// for the csv file 
const csvWriter = createCsvWriter({
   path: 'out.csv',
   header: [
      {id: 'email', title: 'Email'},
      {id: 'total', title: 'Hours'},
      {id: 'shifts', title: 'Shifts Worked'}
   ]
})


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
                res.status(400).send({ error: "User already punched in" });
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
                res.status(400).send({ error: "User isn't punched in" });
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
                return res.status(400).send({ error: "User not found" });
            const isWorking = result.isWorking;
            console.log('isWorking: ' + isWorking);
            const time = result.time;
            console.log('time');
            console.log(time);
            if (time.length == 0)
                return res.status(400).send({ error: "No punches found" });
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
        })
    })
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
            return res.status(400).send({ error: "User not found" });
         res.send({
            'punches': result.time
         })
      })
   })
})

router.post("/SendCSVEmail", function(req, res) {
   const email = req.body.email;
   const company = req.body.company;
   const dateOne = req.body.dateOne;
   const dateTwo = req.body.dateTwo;
   const prettyDate1 = new Date(dateOne).toString();
   const prettyDate2 = new Date(dateTwo).toString();

   let usersTime = new Array();

   mongoClient.connect(uri, { useNewUrlParser: true }, function(err, client){
      if (err) throw err;

      // grab all of the emails associated with the company
      const collection = client.db("usersDb").collection("userInformation");
      collection.find({company: company}).toArray(function(err, result){
         if (err) throw err;
         
         result.forEach(element => {
            usersTime.push( {email: element.email} );
         });

         // query each user's time card
         const collection2 = client.db("usersDb").collection("timeTable");
         collection2.find({ $or: usersTime }).toArray( function(err, result) {
               if (err) throw err;
               let totals = new Array();

               // loop through all user objects
               result.forEach(user => {
                  
                  // calculate totals for the given date range
                  let userTotal = 0;
                  let shifts = 0;
                  user.time.forEach(time => {
                     shifts++;
                     if (time.timestampIn > dateOne && time.timestampIn < dateTwo) {
                        console.log(true);
                        userTotal += (time.timestampOut - time.timestampIn)
                     }
      
                  })
                  userTotal = (userTotal/1000/3600).toFixed(2);
                  totals.push({email: user.email, total: userTotal, shifts: shifts});
               })

               // write the csv file
               csvWriter
                  .writeRecords(totals)
                  .then(() => console.log('The Csv file was made'));
               res.send(totals);

               // send email
               let transporter = nodemailer.createTransport({
                  service: 'gmail',
                  auth: {
                     user: process.env.APP_EMAIL,
                     pass: process.env.APP_PASS
                  }
               })
               let mailOptions = {
                  from: process.env.APP_EMAIL,
                  to: email,
                  subject: 'TOTAL HOURS',
                  text: "Total hours from " + prettyDate1 + " - " + prettyDate2,
                  attachments: [
                     {
                        filename: 'out.csv',
                        path: process.cwd() + "/out.csv"
                     }
                  ]
               }
               transporter.sendMail(mailOptions, function(err, info) {
                  if (err) throw err;
                  console.log('email sent!');
               })
         })
      })
   });
});

module.exports = router;