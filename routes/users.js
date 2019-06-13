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

router.get('/hello/', function(req, res, next){
	 res.send('Hey, looking good');
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
						return res.status(400).send("No user found");
				 if (!bcrypt.compareSync(password, user.password))
						return res.status(400).send("Bad username/email combination");
				 res.send({
				 	"company": user.company,
				 	"email": user.email,
				 	"username": user.username,
				 	"isAdmin": user.isAdmin
				 });
			});
			client.close();
	 });
});

// get all users in company
router.get("/getCompanyUsers", (req, res) => {
	 const company = req.query.company;

	 mongoClient.connect(uri, { useNewUrlParser: true }, async (err, client) => {
		if (err) throw err;

		const collection = client.db("usersDb").collection("userInformation");
		const cursor = await collection.find({ "company": company });

		let users = [];
		if (cursor){
			while (await cursor.hasNext()) {
			   let nextUser = await cursor.next();
			   console.log(nextUser);
			   users.push(nextUser);
			}
		}
		res.send(users);
		client.close();
	 });
})

// get user by id
router.get("/getUser", function(req, res){
	const email = req.query.email;
	
	mongoClient.connect(uri, { useNewUrlParser: true }, function(err, client){
		if (err) throw err;

		const collection = client.db("usersDb").collection("userInformation");
		collection.findOne({ "email": email }, (error, user) => {
			if (error) throw error;
			if (!user)
				return res.status(400).send("No user found");
			res.send(user);
		})
		client.close();
	});
});

//update user by email
router.post("/updateUser", function(req, res){
	 const email = req.body.email;
	 const username = req.body.username;
	 const newEmail = req.body.email;
	 const company = req.body.company;
	 const password = bcrypt.hashSync(req.body.password, saltRounds);
	 const isAdmin = req.body.isAdmin;
	 let userObject = { username, password, newEmail, company, isAdmin };

	 mongoClient.connect(uri, { useNewUrlParser: true }, (err, client) => {
			if (err) throw err;

			const collection = client.db("usersDb").collection("userInformation");
			collection.update({"email": email}, userObject, (error, result) => {
				 if (error) throw err;
				 if (!result)
						return res.status(400).send("No user found");
				 res.send(result);
			})
	 });
});

//delete user by email
router.delete("/deleteUser", function(req, res){
	 const email = req.body.email;

	 mongoClient.connect(uri, { useNewUrlParser: true }, (err, client) => {
			if (err) throw err;

			const collection = client.db("usersDb").collection("userInformation");
			collection.deleteOne({ "email": email }, (error, result) => {
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

		// get collections
		const userInformation = client.db("usersDb").collection("userInformation");
		const companyInformation = client.db("usersDb").collection("companyInformation");
		const timeTable = client.db("usersDb").collection("timeTable");

		// find user
		await userInformation.findOne(
			{$or: [{ "username": username }, { "email": email }]}, async (err, user) => {

				// is a new user
				if (!user) {
			
					// determine if the company exists
					await companyInformation.findOne({ "name": company }, async (error, company) => {
						if (err) throw error;

						// if company doesn't exist
						if(!!company){

							// new user should be created as admin
							isAdmin = true;
							userObject = { username, password, email, company, isAdmin };

							// new company should be created
							let name = company;
							let anotherObject = { name };
							companyInformation.insertOne(anotherObject, async (error, result) => {
								if (err) throw (err);
								await userInformation.insertOne(userObject, (err, result) => {
									if (err) throw err;

									// set up the time table
									const userInfo = result.ops;
									const userId = result.insertedId;
									const isWorking = false;
									const time = [];
									const timeObj = { userId, isWorking, time };

									// insert time table
									timeTable.insertOne(timeObj, function(err, result){
										if(err) throw err;
										res.send(userInfo);
										client.close();
									});
								});
							});

						// of company already exists
						} else {

							// only create the user (as non admin)
							await userInformation.insertOne(userObject, (err, result) => {
								if (err) throw err;

								// still set up the time table
								const userInfo = result.ops;
								const userId = result.insertedId;
								const isWorking = false;
								const time = [];
								const timeObj = { userId, isWorking, time };

								// still insert time table
								timeTable.insertOne(timeObj, function(err, result){
									if(err) throw err;
									res.send(userInfo);
									client.close();
								});
							});
						}
					});
				} else {
					res.status(400).send("User exists");
					client.close();
				}
		 }); // end finding user
	}); // end mongo connect
});



module.exports = router;