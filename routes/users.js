/*
|-------------------------------------------------------------
| User Routes
|-------------------------------------------------------------
*/

var User = require("../models/user.js");
var perPage = 24;
var async = require('async');
var validator = require('validator');
var isObjectId = require('valid-objectid').isValid;
var Device = require('apnagent').Device;
var _ = require('underscore');

exports.list = function(req, res){
  res.send("respond with a resource");
};
exports.registerDevice = function(req, res){
  //expect a user param
  if (!validator.isLength(req.body.uuid, 1, 100) ||
      !isObjectId(req.params.uid) ||
        !validator.isNumeric(req.body.tokenTimestamp)){
    return res.send(400, {clientMsg: "Malformed Request"});
  }
  //normalize token
  var token = new Device(req.body.uuid).toString();
  //find user associated with the id and do the update
  User.update({_id: req.params.uid}, {deviceToken: token, tokenTimestamp: req.body.tokenTimestamp}, {}, function(err, numAffected, raw){
    if (!err){
      return res.send(200, {
        'clientMsg': "Successfully registered device"
      });
    } else {
      return res.send(500, {
        clientMsg: "Could not update token/timestamp",
        err: err
      });
    }
  });
};

//Authenticate a user in order to get the user id here
exports.authenticate = function(req, res){
  var user = new User({
    username: req.body.username,
    password: req.body.password
  });
  user.authenticate(function(err, authUser){
    if (!err){
      if (authUser){
        return res.send(200, {
          '_id': authUser._id
        });
      } else {
        return res.send(401, {
          'clientMsg': 'Wrong username or password'
        });
      }
    } else {
      return res.send(401, {
        'err': err,
        'clientMsg': 'Wrong username or password'
      });
    }
  });
};
//search for a user and return list of results
exports.search = function(req, res){
  var search = new RegExp('^([a-z0-9_\\.-]*)'+req.params.search+'([a-z0-9_\\.-]*)$', "i");
  User.find({username: search})
    .select('username thumbnail')
    .exec(function(err, users){
      if (!err){
        if (users){
          return res.send(users);
        } else {
          return res.send(404, {clientMsg: "No users found, try another search term"});
        }
      } else {
        return res.send(500, err);
      }
    });
};
//see all the friend Requests for a user
exports.friendRequests = function(req, res){
  //if the page number was not passed, go ahead and default to page one for backward compatibility
  req.params.page = req.params.page || 1;
  var skip = perPage * (req.params.page - 1);
  if (!validator.isNumeric(req.params.page) ||
      !isObjectId(req.params.uid)
     ){
    return res.send(400, {clientMsg: "Malformed Request"});
  }
  User.findOne({_id: req.params.uid})
    .select('friendRequests')
    .populate({
      path: 'friendRequests', //connect the id in the friend array to the full user information
      select: 'username thumbnail _id lastLogin', //but only return the username from the full user information
      options: {
        limit: perPage,
        skip: skip
      }
    })
    .exec(function(err, user){
      if (!err){
        if (user) {
          return res.send(200, user); //return the list of friends and their usernames
        } else {
          return res.send(404, {clientMsg: "Couldn't find user"});
        }
      } else {
        return res.send(500, err);
      }
    });
};
//accept an incoming friendRequest
exports.acceptRequests = function(req, res){
  var requestorId = req.body.user;
  var acceptorId = req.params.uid;
  if (!isObjectId(req.body.user) ||
      !isObjectId(req.params.uid)
     ){
    return res.send(400, {clientMsg: "Malformed Request"});
  }
  //TODO make this parallel, they can go at the same time
  async.series([
    function(cb){
    var acceptor = null;
    //find the user accepting the request, acceptor
    User
    .findOne({_id: acceptorId})
    .select('friendRequests friends')
    .exec(function(err, acceptor){
      //load the information from the acceptor
      if (!err){
        if (acceptor){
        //remove the requestor from the acceptors friendRequests array
        acceptor.friendRequests.pull(requestorId);
        //add the requestor to the friends array of the acceptor
        acceptor.friends.addToSet(requestorId);
        acceptor.save(function(err, savedAcceptor){
          if (!err && savedAcceptor){
            cb(null, savedAcceptor);
          } else if (!err && !savedAcceptor){
            cb({clientMsg: "Could not save updated friend in acceptor"});
          } else {
            cb(err);
          }
        });
        } else {
          cb({clientMsg: "Couldn't find user accepting the request"});
        }
      } else {
        cb(err);
      }
    });
    },
    function(cb){
      var requestor = null;
      //find the user requesting the friend ship, requestor
      User
      .findOne({_id: requestorId})
      .select('friends')
      .exec(function(err, requestor){
        //load the information from the requestor
        if(!err && requestor) {
          //add the acceptor to the friends array of the requestor
          requestor.friends.addToSet(acceptorId);
          requestor.save(function(err, savedRequestor){
            if (!err && savedRequestor){
              cb(null, savedRequestor);
            } else if(!err && !savedRequestor){
              cb({clientMsg: "Could not save updated friend in requestor"});
            } else {
              cb(err);
            }
          });
        } else if(!err && !requestor){
          cb({clientMsg: "Could not find user requesting the acceptance of the request"});
        } else {
          cb(err);
        }
      });
    }
  ],
  function(err, results){
    if(err){
      return res.send(500, err);
    } else {
      //no error, send ok status to front end
      return res.send(200, {clientMsg: "Friend request accepted"});
    }
  });
};
//decline an incoming friendRequest
exports.declinedRequests = function(req, res){
  //find the decliner of the request (resource who is doing the declining)
  //User
  //.update({_id: req.params.uid},
  //        { $pull: {friendRequests: {_id: req.body.user}}}, function(err, num, raw){
  //          res.send(200);
  //        });
  if (!isObjectId(req.body.user) ||
      !isObjectId(req.params.uid)
     ){
    return res.send(400, {clientMsg: "Malformed Request"});
  }
  User
  .findOne({_id: req.params.uid})
  .select('_id friendRequests')
  .exec(function(err, decliner){
    if (!err && decliner){
      //remove the initiator from the friendRequests of the decliner
      decliner.friendRequests.pull(req.body.user);
      decliner.save(function(err, user){
        if (!err && user){
          return res.send(200, {clientMsg: "Friend request declined"});
        } else if (!err && !user){
          return res.send(500, {clientMsg: "Couldn't decline friend request, try again"});
        } else {
          return res.send(500, err);
        }
      });
    } else if(!err){
      return res.send(404, {clientMsg: "Couldn't find user, check user id"})
    } else {
      return res.send(500, err);
    }
  });
};
//make a friend request from user in body to user in the :uid
exports.requestFriend = function(req, res){
  if (!isObjectId(req.params.uid) ||
      !isObjectId(req.body.friend)
     ){
    return res.send(400, {clientMsg: "Malformed Request"});
  }
  async.series([
    function(cb){
      //find the user initiating the request
      User
      .findOne({_id: req.body.friend})
      .select('_id requestedFriends')
      .exec(function(err, initiator){
        if (!err && initiator) {
          //make sure this user hasn't tried this before, if so stop him
          //TODO below is super inefficient, consider using lean query
          if (_.indexOf(_.map(initiator.requestedFriends, function(element){return element.toString();}), req.params.uid) !== -1){
            //initiator has made this request before send error
            return cb({clientMsg: "Can't make duplicate friend request"});
          } else {
            //initiator has not made this request before, go ahead and allow it
            initiator.requestedFriends.addToSet(req.params.uid);
            //save the update initator
            initiator.save(function(err, user){
              if (!err && user){
              return cb(null);//go to next step in the series 
              } else if (!err){
                return cb({clientMsg: "Could not save friend request, try again later"});
              } else {
                return cb(err);
              }
            });
          }
        } else {
          return cb(err);
        }
      });
      //if the user has made this request before, don't let him make it again, else add to the initators requestedFriends (prevent multiple requests)
    },
    function(cb){
      //find the user accepting the request
      User
      .findOne({_id: req.params.uid})
      .select('_id friendRequests')
      .exec(function(err, acceptor){
        if (!err && acceptor){
          //add the initiator to the acceptor's friendRequests
          acceptor.friendRequests.addToSet(req.body.friend);
          acceptor.save(function(err, user){
            if (!err && user){
              return cb(null);
            } else if (!err){
              return cb({clientMsg: "Could not save friend request, try again later"});
            } else {
              return cb(err);
            }
          });
        } else if (!err){
          return cb({clientMsg: "Could not find user, check user and try again later"});
        } else {
          return cb(err);
        }
      });
    }
  ],
  function(err, results){
    if (err){
      return res.send(500, err);
    } else {
      //no error, send ok status to front end
      return res.send(200, {clientMsg: "Friend requested successfully"});
    }
  });
};

//get list of friends of the user
exports.listFriends = function(req, res){
  //if the page number was not passed, go ahead and default to page one for backward compatibility
  req.params.page = req.params.page || 1;
  var skip = perPage * (req.params.page - 1);

  if (!validator.isNumeric(req.params.page) ||
      !isObjectId(req.params.uid)
     ){
    return res.send(400, {clientMsg: "Malformed Request"});
  }
  User.findOne({_id: req.params.uid})
    .select('friends')
    .populate({
      path: 'friends', //connect the id in the friend array to the full user information
      select: 'username thumbnail _id lastLogin', //but only return the username from the full user information
      options: {
        limit: perPage,
        skip: skip
      }
    })
    .exec(function(err, user){
      if (!err){
        if (user) {
          return res.send(200, user); //return the list of friends and their usernames
        } else {
          return res.send(404, {clientMsg: "Couldn't find user"});
        }
      } else {
        return res.send(500, err);
      }
    });
};

//get list of users
exports.listUsers = function(req, res){
  //TODO, show users with pending friend requests
  //if the page number was not passed, go ahead and default to page one for backward compatibility
  req.params.page = req.params.page || 1;
  if (!validator.isNumeric(req.params.page) ||
      !isObjectId(req.params.uid)
     ){
    return res.send(400, {clientMsg: "Malformed Request"});
  }
  User.find({}, 'username _id thumbnail')
    .ne('_id', req.params.uid) //don't return the user who is running the query
    .skip(perPage * (req.params.page - 1))
    .limit(perPage)
    .exec(function(err, users){
      if(!err && users.length){
        return res.send(200, users);
      } else if (!err){
        return res.send(404, {clientMsg: "Could not find users"});
      } else {
        return res.send(500, err);
      }
    });
};
//get profile of a user
exports.profile = function(req, res){
  if (!isObjectId(req.params.uid)
     ){
    return res.send(400, {clientMsg: "Malformed Request"});
  }
  User.findOne({_id: req.params.uid})
    .select('username email thumbnail rank')
    .exec(function(err, user){
      if (!err){ //no error
        if (user){
          return res.send(200, user);
        } else { //we didn't find a user but no error
          return res.send(404, {clientMsg: "Could not find user"});
        }
      } else { //error occured
        return res.send(500, err);
      }
    });
};
//Update a user here
exports.update = function(req, res){
  if (!isObjectId(req.params.uid)
     ){
    return res.send(400, {clientMsg: "Malformed Request"});
  }
  User.findOne({_id: req.params.uid}, function(err, user){
    if (!err){
      if (user){
        //get the information passed in from the body and set it to the properties of the model
        user.username  = req.body.newUsername ? req.body.newUsername : user.username;
        user.email = req.body.email ? req.body.email : user.email;
        user.password = req.body.newPassword ? req.body.newPassword : user.password;
        user.addImage(req, function(){
          //save the user the user to the database.
          user.save(function(err, updatedUser){
            if (!err){
              return res.send(200, {
                username: updatedUser.username,
                _id : updatedUser._id
              });
            } else { //there was some sort of db error saving
              return res.send(500, err);
            }
          });
        });
      } else { //no user found, no error
        return res.send(404);
      }
    } else { //some sort of error, let the client know
      console.log("some error");
      return res.send(500, err);
    }

  });

};

//Register a new user here
exports.register = function(req, res){
  var user = new User({
    username: req.body.username,
    password: req.body.password,
    email: req.body.email
  });
  user.addImage(req, function(err){
    if (!err){
      user.save(function(err, newUser){
        if (!err){
          return res.send(200, {
            'username': newUser.username,
            '_id': newUser._id
          });
        } else {
          return res.send(500, {
            'err': err,
            'clientMsg': 'Could not register user'
          });
        }
      });
    } else {
      return res.send(500, err);
    }
  });
};
