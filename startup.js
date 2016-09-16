var MongoClient = require('mongodb').MongoClient,
    settings = require('./config.js'),
    Guid = require('Guid');

var fullMongoUrl = settings.mongoConfig.serverUrl + settings.mongoConfig.database;

function runSetup() {
    return MongoClient.connect(fullMongoUrl)
        .then(function(db) {
            return db.createCollection("events");
        }).then(function(eventsCollection) {

            return eventsCollection.count().then(function(theCount) {
                // the result of find() is a cursor to MongoDB, and we can call toArray() on it
                if (theCount > 0) {
                    return eventsCollection.find.toArray();
                }

                // _id:Guid.create().toString(), eventName: eventName, djName:djName, location:location, privateEvent:privateEvent, eventCode: null, attendees: 0, songList: [], songRequests:[] 


                return eventsCollection.insertOne({ _id: Guid.create().toString(), eventName: "The Last Samurai", djName: "DJ Khaled", location: "Stevens", privateEvent: false, eventCode: null, eventDate: "May 11 2016", attendees: 0, songList: [], songRequests: []}).then(function(newDoc) {
                    return newDoc;
                }).then(function() {
                    return eventsCollection.insertOne({ _id: Guid.create().toString(), eventName: "Hey Hi Hello", djName: "DJ Hi", location: "mama's place", privateEvent: false, eventCode: null, eventDate: "May 8 2016", attendees: 0, songList: [], songRequests: []});
                }).then(function() {
                    return eventsCollection.insertOne({ _id: Guid.create().toString(), eventName: "lalalalala", djName: "DJ dj", location: "Hoboken", privateEvent: false, eventCode: null, eventDate: "May 19 2016", attendees: 0, songList: [], songRequests: []});
                }).then(function() {
                    return eventsCollection.insertOne({ _id: Guid.create().toString(), eventName: "adfadfasdfasdf", djName: "DJ Ad", location: "asdf land", privateEvent: false, eventCode: null, eventDate: "May 14 2016", attendees: 0, songList: [], songRequests: []});
                }).then(function() {
                    return eventsCollection.insertOne({ _id: Guid.create().toString(), eventName: "321564", djName: "DJ Me", location: "NYC", privateEvent: false, eventCode: null, eventDate: "May 11 2016", attendees: 0, songList: [], songRequests: []});
                }).then(function() {
                    return eventsCollection.find().toArray();
                });
            });
        });
}

// By exporting a function, we can run 
var exports = module.exports = runSetup;