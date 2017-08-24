var MongoClient = require('mongodb').MongoClient,
    settings = require('./config.js'),
    runStartup = require('./startup.js'),
    Guid = require('Guid');
var bcrypt = require('bcrypt-nodejs');
var cookieParser = require('cookie-parser');
var fullMongoUrl = settings.mongoConfig.serverUrl + settings.mongoConfig.database;
var exports = module.exports = {};

var added=0;

runStartup().then(function(allEvents) {
    console.log("After the setup has been complete, we have the following events:");
    console.log(allEvents);
});

MongoClient.connect(fullMongoUrl)
    .then(function(db) {

        //Setting up collection for events in this database
        var eventsCollection = db.collection("events");


        //Setting up collection for users in this database
        var usersCollection = db.collection("users");


        //Create a new Event - used only by djs
        exports.makeEvent = function(eventName, djName, location, date, privateEvent, partyCode) {
            if(!eventName){
                return Promise.reject("You need to provide an event name");
            }
            if(!djName){
                return Promise.reject("You need to provide a sick DJ name");
            }
            if(!location){
                return Promise.reject("You need to provide a location!");
            }
            if(!date){
                return Promise.reject("You need to provide a date!");
            }
            if(!privateEvent){
                privateEvent = false;
            }
            else {
                privateEvent = true;
            }
            return eventsCollection.insertOne({ _id:Guid.create().toString(), eventName: eventName,
                djName:djName, location:location, privateEvent:privateEvent, eventCode: partyCode, eventDate:date, attendees: 0, songList: [], songRequests:[] }).then(function(newDoc) {
                console.log("makeEvent has created an item with id " + newDoc.insertedId);
                return newDoc.insertedId;
            });
        };

        //Create a new Event - used only by djs
        exports.getEvents = function() {
            return eventsCollection.find().toArray();
        };

        //Create a new user - used for registering
        exports.makeUser = function(username, password, djStatus) {
            if (!username)  return Promise.reject("You must provide a username");
            if (!password) return Promise.reject("You must provide a valid password");

			var encryptedPassword = bcrypt.hashSync(password);
			console.log("Making a User!");
            return usersCollection.insertOne({ _id: Guid.create().toString(), username: username, encryptedPassword: encryptedPassword,
            	currentSessionId: null, dj: djStatus, theirEvents: [], pastEvents: [] }).then(function(newDoc) {
                return newDoc.insertedId;
            });
        };

        //Add an event a user has attended to their list of past events
        exports.addPastEvent = function (sessionID, eventID) {
            if (!sessionID) return Promise.reject("You must provide a session and event ID");
            return usersCollection.updateOne({
                currentSessionId: sessionID
            }, {
                $push: {
                    pastEvents: eventID
                }
            });
        };

        //Add an event to a users event array, without incrementing the number of attendees (RSVP)
        exports.addUserEvent = function(userID, eventID) {
            if(!userID || !eventID) return Promise.reject("You must provide a session ID and event ID");
            return usersCollection.find({_id: userID, theirEvents: eventID}).limit(1).toArray().then(function(listOfAttendees){
                    return usersCollection.updateOne({_id: userID},{$push: {theirEvents: eventID}});
            });
        };

        //Add an event to a users event array - when user officially joins an event (JOIN)
        exports.joinEvent = function(userID, eventID) {
            if(!userID || !eventID) return Promise.reject("You must provide a session ID and event ID");
            return usersCollection.find({_id: userID, pastEvents: eventID}).limit(1).toArray().then(function(listOfAttendees){
                    return usersCollection.updateOne({_id: userID},{$push: {pastEvents: eventID}}).then(function() {
                        return eventsCollection.updateOne({_id:eventID},{$inc: {attendees: 1}});
                    });
            });
        };

        //Remove a user event - used when user "un-RSVP's"
        exports.removeUserEvent = function(sessionID, eventID) {
            if(!sessionID || !eventID) return Promise.reject("You must provide a session and Event ID");
            return usersCollection.updateOne({currentSessionId: sessionID}, {$pull: {theirEvents: eventID}}).then(function() {
                return eventsCollection.updateOne({_id:eventID},{$inc: {attendees: -1}});
            });
        };

        //Find an event by eventID
        exports.findEvent = function(eventID) {
            if(!eventID) return Promise.reject("You must provide an event ID");
            return eventsCollection.find({_id:eventID}).limit(1).toArray().then(function(listOfEvents) {
                if (listOfEvents.length === 0) return Promise.reject( "Could not find event with ID " + eventID);
                return listOfEvents[0];
            });
        };

        //Finds an event by party code
        exports.findPrivate = function(partyCode){
          if(!partyCode) return Promise.reject("You must provide a party code");
          return eventsCollection.find({eventCode:partyCode}).limit(1).toArray().then(function(listOfEvents) {
              if(listOfEvents.length === 0) return Promise.reject("Could not find event with party code of " + partyCode);
              return listOfEvents[0];
          });
        };

        //Remove an event from the eventCollection, and from all users
        exports.deleteEvent = function(eventID) {
            if(!eventID) return Promise.reject("You must provide an event ID");
            return usersCollection.update({}, {$pull: {theirEvents: eventID}}).then(function() {
                return eventsCollection.remove({_id: eventID});
            });
        };

        //Find a song
        exports.findSong = function(songID) {
            if(!songID) return Promise.reject("You must provide a song ID");
            return songsCollection.find({_id: songID}).limit(1).toArray().then(function(listOfSongs) {
                if (listOfSongs.length === 0) return Promise.reject("Could not find event with ID " + songID);
                return listOfSongs[0];
            });
        };

        //Get all song requests for an event
        exports.getSongRequests = function(eventID) {
            if(!eventID) return Promise.reject("You must provide an event ID");
            return eventsCollection.find({_id: eventID}).limit(1).toArray().then(function(whatWeJustGot){
                return whatWeJustGot[0].songRequests;
            });
        };

        //Make a song request
        exports.makeSongRequest = function(eventID, songID, songName) {
            if(!eventID) return Promise.reject("You must provide an event ID");
            if(!songID) return Promise.reject("You must provide a song ID");
            if(!songName) return Promise.reject("You must provide a song name");
            return eventsCollection.updateOne({_id: eventID}, {$push: {songRequests: {rating: 0, songID: songID, songName: songName}}});
        };

        //Upvote a song in an event
        exports.upvoteRequest = function(eventID, songID) {
            if(!eventID) return Promise.reject("You must provide an event ID");
            if(!songID) return Promise.reject("You must provide a song ID");
            return eventsCollection.update({_id: eventID, "songRequests.songID": songID}, {$inc: {"songRequests.$.rating": 1}});
        };

        //Downvote a song in an event
        exports.downvoteRequest = function(eventID, songID) {
            if(!eventID) return Promise.reject("You must provide an event ID");
            if(!songID) return Promise.reject("You must provide a song ID");
            return eventsCollection.update({_id: eventID, "songRequests.songID": songID}, {$inc: {"songRequests.$.rating": -1}});
        };

        //Add song to setlist
        exports.makeSonglistAddition = function(eventID, songID) {
            if(!eventID) return Promise.reject("You must provide an event ID");
            if(!songID) return Promise.reject("You must provide a song ID");
            return eventsCollection.updateOne({_id: eventID}, {$push: {songList: {songID: songID}}});
        };

        //Remove song from setlist
        //Add song to setlist
        exports.removeSonglistAddition = function(eventID, songID) {
            if(!eventID) return Promise.reject("You must provide an event ID");
            if(!songID) return Promise.reject("You must provide a song ID");
            return eventsCollection.updateOne({_id: eventID}, {$pull: {songList: {songID: songID}}});
        };

        //Updates a user with new information - Probably deprecated, but whatever
        exports.updateUser = function(sessID,fn, ln, hob, pn){
        	if (!sessID || !fn || !ln || !hob || !pn){
        		return Promise.reject("You must provide a firstName, lastName, hobby, petName!");
        	}

        	console.log("Updating a User Entry!");
            console.log(sessID);
        	return usersCollection.updateOne({ currentSessionId: sessID }, {$set: { "profile.firstName":fn,"profile.lastName":ln,"profile.hobby":hob,"profile.petName":pn}}).then(function(){
                console.log("done!");
                return true;
            });
        };

        exports.getUserbyID = function(id) {
            if (!id) return Promise.reject("You must provide an ID");

            // by calling .toArray() on the function, we convert the Mongo Cursor to a promise where you can
            // easily iterate like a normal array
            console.log(id);
            return usersCollection.find({ currentSessionId: id }).limit(1).toArray().then(function(listOfUsers) {
                console.log("before if");
                if (listOfUsers.length === 0) {
                    console.log("reject!");
                    return Promise.reject("Could not find User with id of " + id);
                } else {
                    console.log(id+ " is good!");
                    return listOfUsers[0];
                }

            });
        };

        exports.getUserbyUP = function(user,pass) {
            if (!user) return Promise.reject("You must provide an username");

            // by calling .toArray() on the function, we convert the Mongo Cursor to a promise where you can
            // easily iterate like a normal toArray
            return usersCollection.find({ username: user }).limit(1).toArray().then(function(listOfUsers) {
                if (listOfUsers.length === 0) return Promise.reject("Could not find User with username of " + user);
                var compPass = bcrypt.compareSync(pass,listOfUsers[0].encryptedPassword);
                console.log(compPass);
                if(!compPass){
                	return Promise.reject("Could not find User with username of " + user);
                }
                return listOfUsers[0];
            });
        };

        exports.getUserbyUser = function(user) {
            if (!user) return Promise.reject("You must provide an username");
            // var bbool=true;
            // by calling .toArray() on the function, we convert the Mongo Cursor to a promise where you can
            // easily iterate like a normal toArray
            return usersCollection.find({ username: user }).limit(1).toArray().then(function(listOfUsers) {
                console.log(listOfUsers);
                if (listOfUsers.length === 0){
                    console.log("False");
                    return false;
                }
                else{
                    console.log("True");
                    return true;
                }
            });
        };

        exports.setUserSess = function(user,sid) {
            if (!user) return Promise.reject("You must provide an username");
            if (!sid) return Promise.reject("You must provide a SessionID");
            console.log(user);
            console.log(sid);

            return exports.getUserbyUser(user).then(function (result){
            if(!result){
                console.log("ERROR!");
                return Promise.reject("You must provide a valid username");
            }
            else{
                return usersCollection.find({ username: user }).limit(1).toArray().then(function(listOfUsers) {
                    console.log(sid);
                usersCollection.updateOne({username: user}, {$set: {currentSessionId: sid}});
                return sid;
            });
            }
        });
        };


        exports.getUserSessID = function(user) {
            if (!user) return Promise.reject("You must provide a username");

            // by calling .toArray() on the function, we convert the Mongo Cursor to a promise where you can
            // easily iterate like a normal toArray
            return usersCollection.find({ username: user }).limit(1).toArray().then(function(listOfUsers) {

                return  listOfUsers[0].currentSessionId;
            });
        };

        exports.logoutUser = function(sid){
             if (!sid) return Promise.reject("You must provide a SessionID");
             return usersCollection.find({  currentSessionId: sid }).limit(1).toArray().then(function(listOfUsers) {

                usersCollection.updateOne({ currentSessionId: sid}, {$set: {currentSessionId: null}});
                return true;
            });
        };

    });
