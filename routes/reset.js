const express = require("express");
const nodemailer = require("nodemailer");
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
	res.send('hitting the reset hello endpoint');
})

router.post('/forgotPassword', function(req, res, next){
	if (req.body.email == ""){
		return res.status(400).send({ error: "Email required" });
	}
	const email = req.body.email.toString();

	mongoClient.connect(uri, { useNewUrlParser: true }, function (err, client){
		if (err) throw err;
		const collection = client.db("usersDb").collection("userInformation");
		collection.findOne({ email: email }, (error, user) => {
			if (user == null){
				return res.status(400).send({ error: "Email not recognized"});
			}
			return res.send({ message: "Email Sent (not really, I'm not done)"});
		}).catch((error) => {
			return res.status(400).send({ error: "Error Caught"});
			client.close();
		})
	})
})

module.exports = router;