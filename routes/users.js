const express = require("express");
const router = express.Router();
const ADMIN = 'admin';
const ADMIN_PWD = 'admin123';
const mongoClient = require("mongodb");
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const saltRounds = 10;

// here is where we will handle any database call
const uri = 'mongodb+srv://admin:admin123@gps-time-afto7.mongodb.net/test?retryWrites=true';

router.get('/hello', function(req, res, next){
   res.send('CRUD testing 1');
})

router.post("/authenticate/", function(req, res, next){
   const username = req.body.username.toString();
   const password = req.body.password.toString();

   mongoClient.connect(uri, { useNewUrlParser: true }, function(err, client){
      if (err) throw err;

      const collection = client.db("usersDb").collection("userInformation");
      collection.findOne({
         $or: [
            { "username": username },
            { "email": username }
         ]
      }, (error, user) => {
         if (error) throw err;
         if (!user)
            return res.status(400).send(false);
         if (!bcrypt.compareSync(password, user.password))
            return res.status(400).send(false);
         res.send(user);
     });
     client.close();
   });
});

// get all users in company
router.get("/getCompanyUsers", function (req, res){
   const company = req.params.company.toString();
   res.send(company);

   mongoClient.connect(uri, { useNewUrlParser: true },function(err, client){
      if (err) throw err;

      const collection = client.db("usersDb").collection("userInformation");
      collection.find({ "company": company}, (error, users) => {
         if (error) throw err;
         if (!users)
            return res.status(400).send(false);
         res.send(users);
      });
      client.close();
   });
})

// get user by id
router.get("/getUser", function(req, res){
   res.json(req.query);
   /*
   const userId = req.params.userId.toString();
   res.send(userId);
   
   mongoClient.connect(uri, { useNewUrlParser: true },function(err, client){
      if (err) throw err;

      const collection = client.db("usersDb").collection("userInformation");
      collection.find({"_id": ObjectId(userId)}, (error, user) => {
         if (error) throw err;
         if (!user)
            return res.status(400).send(false);
         res.send(user);
      })
   });
   */
});

//update user by id
router.post("/updateUser", function(req, res){
   const userId = req.body.userId.toString();
   const username = req.body.username;
   const email = req.body.email;
   const company = req.body.company;
   const password = bcrypt.hashSync(req.body.password, saltRounds);
   const isAdmin = req.body.isAdmin;
   let userObject = { username, password, email, company, isAdmin };
   res.send(userObject);

   mongoClient.connect(uri, { useNewUrlParser: true },function(err, client){
      if (err) throw err;

      const collection = client.db("usersDb").collection("userInformation");
      collection.update({"_id": ObjectId(userId)}, userObject, (error, result) => {
         if (error) throw err;
         if (!result)
            return res.status(400).send(false);
         res.send(result);
      })

   });
})

//delete user by id
router.delete("/deleteUser", function(req, res){
   const userId = req.body.userId.toString();
   res.send(userId);


   mongoClient.connect(uri, { useNewUrlParser: true },function(err, client){
      if (err) throw err;

      const collection = client.db("usersDb").collection("userInformation");
      collection.deleteOne({"_id": ObjectId(userId)}, (error, result) => {
         if (error) throw error;
         if (!result)
            return res.status(400).send(false);
         res.send(result);
      })

   });
})

router.post("/addUser", function(req, res){
   const username = req.body.username;
   const email = req.body.email;
   const company = req.body.company;
   const password = bcrypt.hashSync(req.body.password, saltRounds);

   let isAdmin = false;
   let userObject = { username, password, email, company, isAdmin };


   // connect to atlas
   mongoClient.connect(uri, { useNewUrlParser: true }, async (err, client) => {
      if (err) throw err;

      // determine if company already exists
      let companyExists;
      const companyInformation = client.db("usersDb").collection("companyInformation");
      await companyInformation.findOne({ "name": company}, (error, company) => {
            if (err) throw Error("start of connect");
            companyExists = !!company; // the bang! bang! should convert the company object to a boolean 
      });

      // no error above this line

      // some things need to happen if the company is new
      if (!companyExists){

         // first the new user should be admin
         isAdmin = true;
         userObject = { username, password, email, company, isAdmin };

         // and add the new company to the company collection
         let name = company;
         let anotherObject = { name };
         companyInformation.insertOne(anotherObject, (error, result) => {
            if (err) throw (err);
         })
      }

      // add user to the db
      const userInformation = client.db("usersDb").collection("userInformation");
      const timeTable = client.db("usersDb").collection("timeTable");
      await userInformation.findOne(
          {$or: [{ "username": username }, { "email": email }]}, function (err, user) {
              if (!user) {
                  userInformation.insertOne(userObject, function(err, result){
                      if (err) throw err;

                      // set up the time table
                      const userInformation = result.ops;
                      const userId = result.insertedId;
                      const isWorking = false;
                      const time = {};
                      const timeObj = { userId, isWorking, time };

                      // insert time table
                      timeTable.insertOne(timeObj, function(err, result){
                          if(err) throw err;
                          res.send(userInformation);
                          client.close();
                      });
                  });
              }
              else {
                  res.status(400).send("User exists");
                  client.close();
              }
       });
    });
});



module.exports = router;