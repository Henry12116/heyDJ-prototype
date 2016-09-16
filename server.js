//Mark Mirtchouk, William Cusick, Henry Thomas
//CS 546 WS
//I pledge my honor that I have abided by the Stevens Honor System
// We first require our express package
var express = require('express');
var bodyParser = require('body-parser');
var myData = require('./data.js');
var bcrypt = require('bcrypt-nodejs');
var cookieParser = require('cookie-parser');
var Guid = require('Guid');
// This package exports the function to create an express instance:
var app = express();

//Setting up ejs
app.set('view engine', 'ejs');

// This is called 'adding middleware', or things that will help parse your request
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(cookieParser());
// This middleware will activate for every request we make to 
// any path starting with /assets;
// it will check the 'static' folder for matching files 
app.use('/assets', express.static('static'));

// Setup your routes here!

//Post route for signup from the login page
app.post("/signup", function (request, response) { 
    var user = request.body.username;
    var pass = request.body.password;

    if(!user) {
        response.render("pages/login", { pageTitle: "Please enter a username!" });
    }
    else if(!pass) {
        response.render("pages/login", { pageTitle: "Please enter a password!" });
    }
    console.log("Checking to see if user is in our database!");
    console.log("Username is: "+ user);

    myData.getUserbyUser(user).then(function(status){
    if(status){
        response.render("pages/login", { pageTitle: "Username is already in the Database!" });
    }
    else{
        myData.makeUser(user,pass);
        response.render("pages/login", { pageTitle: "Username and Password created!"});
    }

    });
});

app.post("/song-requests/create-request", function(request, response) {
    var songName = request.body.songname;
    var songLink = request.body.songid;
    var eventID = request.body.event_id;
    
    if(!songName) response.render("pages/song-requests-error");
    if(!songLink) response.render("pages/song-requests-error");
    
    console.log("The songLink is this: " + songLink);
    
    //This replaces extraneous parts of the youtube link
    songLink = songLink.replace("https://www.youtube.com/watch?v=","");
    songLink = songLink.replace("http://www.youtube.com/watch?v=","");
    songLink = songLink.replace("www.youtube.com/watch?v=","");
    songLink = songLink.replace("youtube.com/watch?v=","");
    
    console.log("The songLink is now : " + songLink);
    myData.makeSongRequest(eventID, songLink, songName).then(function() {
        response.redirect("/song-requests/" + eventID);
    });
});

//Post route for creating an event
app.post("/party", function (request, response) {
    //event-name dj-name location private
    var eventName = request.body.eventname;
    var djName = request.body.djname;
    var locationName = request.body.location;
    var eventDate = request.body.eventDate;
    var privateEvent = request.body.private;
    if(privateEvent) {
        privateEvent = true;
    }
    else {
        privateEvent = false;
    }
    myData.makeEvent(eventName, djName, locationName, eventDate, privateEvent).then(function(result) {
        myData.findEvent(result).then(function(result2) {
            response.redirect("/find-events/:" + result2._id);
        });
    }).catch(function (err) {
        console.log(err);
        response.render("pages/error", {errorType: "Who knows", errorMessage: err});
    });
});

//Route for upvoting or downoting a song, redirects back to song-requests
app.post("/vote", function (request, response) {
    var songID = request.body.song_id;
    var eventID = request.body.event_id;
    var voteVal = request.body.vote;
    console.log("SongID is: " + songID);
    console.log("EventID is: " + eventID);
    console.log("Voteval is: " + voteVal);
    if(!eventID) {
        response.render("/pages/song-requests-error");
    }
    if(!songID) {
        response.render("/pages/song-requests-error");
    }
    if(!voteVal) {
        response.render("/pages/song-requests-error");
    }
    if(voteVal == "up") {
        myData.upvoteRequest(eventID, songID).then(function () {
            response.redirect("/song-requests/" + eventID);
        });
    }
    else if(voteVal == "down") {
        myData.downvoteRequest(eventID, songID).then(function () {
            response.redirect("/song-requests/" + eventID);
        });
    }
});

//The post for the login form the login page
app.post("/login", function (request, response) { 
    var user = request.body.username;
    var pass = request.body.password;
    
    if(!user) {
        response.render("pages/login", { pageTitle: "Please enter a username!" });
    }
    else if(!pass) {
        response.render("pages/login", { pageTitle: "Please enter a password!" });
    }
    
    console.log("Checking to see if user is in our database!");
    
    //var a = myData.getUserbyUP(user,pass);
    
    myData.getUserbyUP(user,pass).then(function(result){
        if(result.username==user){
            console.log("Starting to login");
            console.log(user);
            console.log(Guid.create().toString());
            myData.setUserSess(user,Guid.create().toString()).then(function(sid){
                console.log("Made a session for username: " + user + " with a sessionID: " + sid);
                response.cookie("SessionID", sid);
                console.log("loading profile");
                myData.getUserbyID(sid).then(function(p){
                    console.log(p);
                    if(p.username==user){
                        console.log("Welcoming user...");
                        response.render("pages/home", { pageTitle: "Welcome!"});
                    }
                    else{
                        response.render("pages/login", { pageTitle: "Username and/or Password incorrect!"});
                    }
                });
            });
        }
        else {
            console.log("Could not find user with username");
            response.render("pages/login", { pageTitle: "Username and/or Password incorrect!"});
        }}).catch(function(err) {
                console.log(err.message);
                response.render("pages/login", { pageTitle: "Username and/or Password incorrect!"});
    });
});

//Get for the song-requests for an event (JOINING EVENT)
app.get("/song-requests/:event_id", function (request, response) {
    var eventID = request.params.event_id;
    eventID.replace(":", "");
    var sid = request.cookies["SessionID"];

    if (!eventID) response.render("pages/song-requests-error.ejs");

    return myData.getUserbyID(sid).then(function (user) {
        return myData.joinEvent(user._id, eventID).then(function (blah) {
            return myData.findEvent(eventID).then(function (event) {
                var song_requests = event.songRequests;
                response.render("pages/song-requests", {
                    pageTitle: "Requests for " + event.eventName,
                    eventID: eventID,
                    song_results: song_requests
                });
            });
        });
    });
});

//RSVPING EVENT
app.post("/song-requests/:event_id", function (request, response) {
    var eventID = request.params.event_id;
    eventID.replace(":", "");
    if (!eventID) response.render("pages/song-requests-error.ejs");

    var sid = request.cookies["SessionID"];
    return myData.getUserbyID(sid).then(function (user) {
        return myData.addUserEvent(user._id, eventID);
    });
});

//The get route for the homepage
app.get("/home", function (request, response) {
    response.render("pages/home", { pageTitle: "Welcome Home" });
});

//The get route for the create-event page, creates form which posts to /party
app.get("/create-event", function (request, response) {
    response.render("pages/create-event", { pageTitle: "Make an event!"});
});

//Gets route for a single event
app.get("/find-events/:id", function (request, response) {
    var myid = request.params.id;
    myid = myid.replace(":","");
    myData.findEvent(myid).then(function (result) {
        var selected_event = result;
        console.log("The result of findEvent is " + selected_event.eventName);
        response.render('pages/event', {event: selected_event});
        }).catch(function(err) {
                console.log(err.message);
                response.render("pages/login", { pageTitle: "Something went wrong finding Event"});
        }); 
});

//Get route to find all events
app.get("/find-events", function (request, response) {
    myData.getEvents().then(function (result){
        var found_events = result;
        console.log(found_events);
        response.render("pages/find-events", { pageTitle: "Find an event!", events: found_events});
    });
});

//Post route for profile, which I don't think we use
app.post("/profile", cookieParser(), function (request, response) {
    var fn = request.body.firstName;
    var ln = request.body.lastName;
    var hob = request.body.hobby;
    var pn = request.body.petName;
    var sid = request.cookies["SessionID"];
    
    console.log(fn+ ", your SessionID is: " + sid);
    
    myData.updateUser(sid, fn, ln, hob, pn).then(function(p1) {
        console.log("My id isL " + sid);
        myData.getUserbyID(sid).then(function(p2){
            console.log("The profile is: "+ p2);
            response.render("pages/profile", { pageTitle: fn+", the profile has been updated! Congrats", username: p2.username, profile: p2.profile});
        });
    });
});

//Post route for logout, which we aren't currently using
app.post("/logout", cookieParser(), function (request, response) {
        var sid = request.cookies["SessionID"];
        myData.logoutUser(sid);
        var anHourAgo = new Date();
        anHourAgo.setHours(anHourAgo.getHours() - 1);
        response.cookie("SessionID", "", { expire: anHourAgo });
        response.clearCookie("SessionID");
        response.render("pages/login", { pageTitle: "Logged out!" });
});


app.get("/", function (request, response) { 
    response.render("pages/login.ejs", { pageTitle: "Signup and Login!"});
});


// We can now navigate to localhost:3000
app.listen(3000, function () {
    console.log('Your server is now listening on port 3000! Navigate to http://localhost:3000 to access it');
});