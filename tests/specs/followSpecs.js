var frisby = require('frisby');
var async = require('async');
var superagent = require('superagent');
var User = require('../../models/user.js');

var user1 = {
  username: 'popular123',
  password: '123',
  email: 'popular123@gmail.com',
};

var user2 = {
  username: 'nerd314',
  password: '314',
  email: 'nerd314@gmail.com',
};
var user3 = {
  username: 'user3',
  password: 'password',
  email: 'user3@gmail.com',
};
// old style user4
var user4 = {
  username: 'oldModel',
  password: 'password',
  email: 'user4@gmail.com',
};
exports.spec = function(domain, callback){
  console.log('Running Follow Tests');
  describe('The test setup', function(){
    it('should be able to delete the database', function(done){
      superagent
      .del(domain + "/server")
      .end(function(res){
        expect(res.status).toEqual(200);
        console.log("Done deleting db");
        done();
      });
    });
    it('should create a user', function(done){
      console.log('after delete');
      superagent
      .post(domain + "/register")
      .type('form')
      .attach("image", "./tests/specs/images/defaultProfile.png")
      .field("username", user1.username)
      .field("password", user1.password)
      .field("email", user1.email)
      .end(function(err, res){
        var user = res.body;
        expect(res.status).toEqual(200);
        user1.id = user._id;
        done();
      });
    });
    it('should create another user', function(done){
      console.log('after delete');
      superagent
      .post(domain + "/register")
      .type('form')
      .attach("image", "./tests/specs/images/defaultProfile.png")
      .field("username", user2.username)
      .field("password", user2.password)
      .field("email", user2.email)
      .end(function(err, res){
        var user = res.body;
        expect(res.status).toEqual(200);
        user2.id = user._id;
        done();
      });
    });
    it('should create another user', function(done){
      User.create({
        username: user3.username,
        password: user3.password,
        email: user3.email
      }, function(err, user){
        expect(user).toBeDefined();
        user3.id = user.id;
        done();
      });
    });
  });
  describe('Follows', function(){
    //this image is appropriate, the moderator will not confirm this image is bad
    it('should allow user2 to follow user1', function(done){
      superagent
      .post(domain + "/users/" + user2.id + '/follows')
      .send({
        user: user1.id,
      })
      .end(function(res){
        expect(res.status).toEqual(200);
        done();
      });
    });
    // check that the followsUser flag is set
    it('should show user2 is following user1', function(done){
      superagent
      .get(domain + "/users/" + user2.id + '/users/page/1')
      .end(function(res){
        var users = res.body;
        console.log(users);
        users.forEach(function(user){
          if (user._id == user1.id){
            // user2 just followed this user
            expect(user.followStatus).toEqual(true);
          } else {
            expect(user.followStatus).toEqual(false);
          }
        });
        expect(res.status).toEqual(200);
        done();
      });
    });
    // check that the user shows up in the follows list of user2
    it('should allow you to see that user2 is following user1', function(done){
      superagent
      .get(domain + "/users/" + user2.id + '/follows/page/1')
      .end(function(res){
        var follows = res.body;
        expect(follows.length).toEqual(1);
        expect(follows[0]._id).toEqual(user1.id);
        expect(follows[0].username).toEqual(user1.username);
        expect(res.status).toEqual(200);
        done();
      });
    });
    it('should not matter if you do it a second time', function(done){
      superagent
      .post(domain + "/users/" + user2.id + '/follows')
      .send({
        user: user1.id,
      })
      .end(function(res){
        expect(res.status).toEqual(200);
        User.findOne({_id: user2.id})
        .exec(function(err, user){
          expect(user.follows.length).toEqual(1);
          done();
        });
      });
    });
    it('should allow you to stop following a user', function(done){
      superagent
      .del(domain + "/users/" + user2.id + '/follows')
      .send({
        user: user1.id,
      })
      .end(function(res){
        expect(res.status).toEqual(200);
        User.findOne({_id: user2.id})
        .exec(function(err, user){
          expect(user.follows.length).toEqual(0);
          done();
        });
      });
    });
  });
  describe('Followers', function(){
    it('should set up user2 to follow user1', function(done){
      superagent
      .post(domain + "/users/" + user2.id + '/follows')
      .send({
        user: user1.id,
      })
      .end(function(res){
        expect(res.status).toEqual(200);
        User.findOne({_id: user2.id})
        .exec(function(err, user){
          expect(user.follows.length).toEqual(1);
          done();
        });
      });
    });
    it('can be listed', function(done){
      superagent
      .get(domain + "/users/" + user1.id + '/followers/page/1')
      .end(function(res){
        var followers = res.body;
        expect(followers.length).toEqual(1);
        expect(followers[0]._id).toEqual(user2.id);
        expect(followers[0].username).toEqual(user2.username);
        expect(followers[0].thumbnail).toBeDefined();
        expect(res.status).toEqual(200);
        done();
      });
    });
    it('should not crash when the user id is incorrect', function(done){
      // gh #163
      superagent
      .get(domain + "/users/" + '1234' + '/followers/page/1')
      .end(function(res){
        throw new Error()
        var followers = res.body;
        expect(followers.length).toEqual(1);
        expect(followers[0]._id).toEqual(user2.id);
        expect(followers[0].username).toEqual(user2.username);
        expect(followers[0].thumbnail).toBeDefined();
        expect(res.status).toEqual(200);
        done();
      });
    });
    it('should allow user1 to block user2', function(done){
      superagent
      .del(domain + "/users/" + user1.id + '/followers')
      .send({
        user: user2.id,
      })
      .end(function(res){
        expect(res.status).toEqual(200);
        // see who user2 follows and expect it to be no one now
        User.findOne({_id: user2.id})
        .exec(function(err, user){
          expect(user.follows.length).toEqual(0);
          done();
        });
      });
    });
  });
  describe('Peeps setup and testing', function(){
    describe('Reset for peeps testing', function(){
      it('should be able to delete the database', function(done){
        superagent
        .del(domain + "/server")
        .end(function(res){
          expect(res.status).toEqual(200);
          console.log("Done deleting db");
          done();
        });
      });
      it('should create a user', function(done){
        console.log('after delete');
        User.create({
          username: user1.username,
          password: user1.password,
          email: user1.email
        }, function(err, user){
          expect(user).toBeDefined();
          user1.id = user.id;
          done();
        });
      });
      it('should create another user', function(done){
        User.create({
          username: user2.username,
          password: user2.password,
          email: user2.email
        }, function(err, user){
          expect(user).toBeDefined();
          user2.id = user.id;
          done();
        });
      });
      it('should create another user', function(done){
        User.create({
          username: user3.username,
          password: user3.password,
          email: user3.email
        }, function(err, user){
          expect(user).toBeDefined();
          user3.id = user.id;
          done();
        });
      });
    });
    describe('Peeps', function(){
      // setup as follows user2 follows user1, user3 follows user2, user2 follows user3
      // then look from user2 perspective
      it('should show empty when no peeps exist', function(done){
        superagent
        .get(domain + "/users/" + user2.id + '/peeps/page/1')
        //.get(domain + "/users/" + '1' + '/peeps/page/1')
        .end(function(res){
          var peeps = res.body;
          expect(peeps.length).toEqual(0);
          expect(res.status).toEqual(200);
          done();
        });
      });
      it('should be able to handle old user models that dont have the follows field set', function(done){
        superagent
        .get(domain + "/users/" + user2.id + '/peeps/page/1')
        //.get(domain + "/users/" + '1' + '/peeps/page/1')
        .end(function(res){
          var peeps = res.body;
          expect(peeps.length).toEqual(0);
          expect(peeps).toBeDefined();
          expect(res.status).toEqual(200);
          done();
        });
      });
      it('should get the peeps from user2 perspective when no following has occured', function(done){
        // make sure something is returned without an error when no one is being followed
        superagent
        .get(domain + "/users/" + user2.id + '/peeps/page/1')
        .end(function(res){
          var peeps = res.body;
          expect(peeps.length).toEqual(0);
          expect(peeps.length).toBeDefined();
          expect(res.status).toEqual(200);
          done();
        });
      });
      it('should allow user2 to follow user1', function(done){
        superagent
        .post(domain + "/users/" + user2.id + '/follows')
        .send({
          user: user1.id,
        })
        .end(function(res){
          expect(res.status).toEqual(200);
          done();
        });
      });
      it('should get the peeps from user2 perspective', function(done){
        // make sure peeps list shows when no one is following user2 gh#157
        superagent
        .get(domain + "/users/" + user2.id + '/peeps/page/1')
        .end(function(res){
          var peeps = res.body;
          expect(peeps.length).not.toEqual(0);
          expect(peeps.length).toBeDefined();
          peeps.forEach(function(peep){
            if (peep._id == user1.id){
              expect(peep.isFollow).toEqual(true);
              expect(peep.isFollower).toEqual(false);
            } else {
              // should not happen, all cases should be accounted for
              expect(true).toEqual(false);
            }
          });
          expect(res.status).toEqual(200);
          done();
        });
      });
      it('should get the peeps from user1 perspective', function(done){
        // make sure peeps list shows when user1 is being followed but not following
        superagent
        .get(domain + "/users/" + user1.id + '/peeps/page/1')
        .end(function(res){
          var peeps = res.body;
          expect(peeps.length).not.toEqual(0);
          expect(peeps.length).toBeDefined();
          peeps.forEach(function(peep){
            if (peep._id == user2.id){
              expect(peep.isFollow).toEqual(false);
              expect(peep.isFollower).toEqual(true);
            } else {
              // should not happen, all cases should be accounted for
              expect(true).toEqual(false);
            }
          });
          expect(res.status).toEqual(200);
          done();
        });
      });
      it('should set up user3 to follow user2', function(done){
        superagent
        .post(domain + "/users/" + user3.id + '/follows')
        .send({
          user: user2.id,
        })
        .end(function(res){
          expect(res.status).toEqual(200);
          User.findOne({_id: user3.id})
          .exec(function(err, user){
            expect(user.follows.length).toEqual(1);
            done();
          });
        });
      });
      it('should set up user2 to follow user3', function(done){
        superagent
        .post(domain + "/users/" + user2.id + '/follows')
        .send({
          user: user3.id,
        })
        .end(function(res){
          expect(res.status).toEqual(200);
          User.findOne({_id: user2.id})
          .exec(function(err, user){
            expect(user.follows.length).toEqual(2);
            done();
          });
        });
      });
      it('should get the peeps from user1 perspective', function(done){
        superagent
        .get(domain + "/users/" + user2.id + '/peeps/page/1')
        .end(function(res){
          var peeps = res.body;
          peeps.forEach(function(peep){
            if (peep._id == user3.id){
              expect(peep.isFollow).toEqual(true);
              expect(peep.isFollower).toEqual(true);
            } else if (peep._id == user1.id){
              expect(peep.isFollow).toEqual(true);
              expect(peep.isFollower).toEqual(false);
            } else if (peep._id == user2.id){
              // should not happen, there is no user interaction here
              expect(true).toEqual(false);
            } else {
              // should not happen, all cases should be accounted for
              expect(true).toEqual(false);
            }
          });
          expect(res.status).toEqual(200);
          done();
        });
      });
    });
    describe('Peep backward compatibility', function(){
      // this is to address gh#129 where a user which doesn't have a follows property
      // due to old schema version causes a crash
      it('should create a user without a follows property', function(done){
        var user = new User(user4);
        user.set('follows', undefined);
        user.save(function(err, doc){
          user4.id = doc._id;
          done();
        })
      });
      it('should be able to get the followers without error gh#129', function(done){
        superagent
        .get(domain + "/users/" + user4.id + '/peeps/page/1')
        //.get(domain + "/users/" + '1' + '/peeps/page/1')
        .end(function(res){
          var peeps = res.body;
          expect(peeps).toBeDefined();
          expect(res.status).toEqual(200);
          done();
        });
      });
    });
  });
  xdescribe('A submission deemed acceptable by a moderator', function(){
    it('simulates the moderator keeping submission1, not emailing the user anything', function(done){
      spyOn(mailers, 'mailUserTerms');
      spyOn(transporter, 'sendMail');
      Submission.keepFlagged({
        submissionId: submission1.id
      }, function(err){
        expect(err).toEqual(null);
        //make sure no mail is sent out to the user for a submission that was never flagged
        expect(mailers.mailUserTerms).not.toHaveBeenCalled();
        //make sure that the underlying function that actually sends the mail wasn't called
        expect(transporter.sendMail).not.toHaveBeenCalled();
        done();
      });
    });
    it('should not reset the submission flag value, we want this submission to be sensitive', function(done){
      Submission
      .findOne({_id: submission1.id})
      .exec(function(err, submission){
        expect(submission.flaggers.length).toEqual(3);
        done();
      });
    });
  });
  xdescribe('A submission deemed unacceptable by a moderator', function(){
    it('simulates the moderator removing submission2 and emailing user the TOS', function(done){
      //TODO we never tested the actual rest interface
      spyOn(mailers, 'mailUserTerms').andCallThrough();
      spyOn(transporter, 'sendMail'); //we aren't actually sending the TOS since we aren't calling through
      runs(function(){
        //remove the flagged submission
        Submission.removeFlagged({
          submissionId: submission2.id
        }, function(){});
      });
      waitsFor(function(){
        //keep going until drain has been called so we know all the messages have processed
        return mailers.mailUserTerms.callCount === 1;
      }, "Expect queue drain to finish and be called", 2000);
      runs(function(){
        //check that everything ran correctly and do any other checks here
        //console.log("first call", agent.send.mostRecentCall.args);
        //make sure it sent an options with the correct email
        expect(mailers.mailUserTerms.mostRecentCall.args[0].email).toEqual(user4.email);
        expect(mailers.mailUserTerms).toHaveBeenCalled();
        //make sure something was sent to the actual transporter, at least that the email is correct
        expect(transporter.sendMail).toHaveBeenCalled();
        expect(transporter.sendMail.mostRecentCall.args[0].to).toEqual(user4.email);
        done();
      });
     // superagent
     // .post(domain + "/challenges/" + challenge1.id + '/submissions/' + submission2.id + '/remove')
     // .send({
     //   placeholder: 'empty holder'
     // })
     // .end(function(res){
     //   expect(res.status).toEqual(200);
     //   expect(mailers.mailUserTerms).toHaveBeenCalled();
     //   done();
     // });
    });
    it('should remove user4 from challenge1', function(done){
      //user 4 should no longer have any challenges
      superagent
      .get(domain + "/users/" + user4.id + '/challenges/page/1')
      .end(function(res){
        expect(res.status).toEqual(404);
        done();
      });
    });
    it('should still allow user1 to see challenge1', function(done){
      //other users should still see the challenge
      superagent
      .get(domain + "/users/" + user1.id + '/challenges/page/1')
      .end(function(res){
        expect(res.status).toEqual(200);
        done();
      });
    });
    it('should still allow user2 to see challenge1', function(done){
      //other users should still see the challenge
      superagent
      .get(domain + "/users/" + user2.id + '/challenges/page/1')
      .end(function(res){
        expect(res.status).toEqual(200);
        done();
      });
    });
    it('should still allow user3 to see challenge1', function(done){
      //other users should still see the challenge
      superagent
      .get(domain + "/users/" + user3.id + '/challenges/page/1')
      .end(function(res){
        expect(res.status).toEqual(200);
        done();
      });
    });
    it('should remove user4\'s inappropriate submission2 from challenge1', function(done){
      //submission with that ID should no longer exist
      Challenge
      .findOne({_id: challenge1.id})
      .exec(function(err, challenge){
        //only one submission should be left
        expect(challenge.submissions.length).toEqual(1);
        //the only one left should be submission1 as submission2 is gone
        expect(challenge.submissions[0].toString()).toEqual(submission1.id);
        done();
      });
    });
    it('should not crash when a user tries to access a removed submission', function(done){
      // we need this route incase a submission is removed but a user is looking at a list of submissions
      // and tries to access it directly
      superagent
      .get(domain + '/challenges/' + challenge1.id + '/submissions/' + submission2.id)
      //.inspectJSON()
      .end(function(res){
        expect(res.status).toEqual(404);
        done(null);
      });
    });
    it('should keep user1\'s comment from submission1 in challenge1', function(done){
      Submission
      .findOne({_id: submission1.id, 'comments.commenter': user1.id})
      .exec(function(err, submission){
        expect(err).toEqual(null);
        expect(submission).toBeDefined();
        expect(submission).not.toEqual(null);
        done();
      });
    });
    it('should keep user2\'s comment from submission1 in challenge1', function(done){
      Submission
      .findOne({_id: submission1.id, 'comments.commenter': user2.id})
      .exec(function(err, submission){
        expect(err).toEqual(null);
        expect(submission).toBeDefined();
        expect(submission).not.toEqual(null);
        done();
      });
    });
    it('should remove user4\'s comment from submission1 in challenge1', function(done){
      Submission
      .findOne({_id: submission1.id})
      .exec(function(err, submission){
        expect(err).toEqual(null);
        submission.comments.forEach(function(comment, index){
          //make sure the user ejected from challenge1 has no comments in the other submission for that challenge
          expect(comment.commenter.toString()).not.toEqual(user4.id);
        });
        done();
      });
    });
    it('should have incremented the badSubmissions counter on user4 after submission flagged by moderator', function(done){
      //find user by id
      User
      .findOne({_id: user4.id})
      .select('badSubmissions')
      .exec(function(err, user){
        //check that the flaggedSubmission value is now 1
        expect(user.badSubmissions).toEqual(1);
        done();
      });
    });
    it('should remove that submission from the recent activity of user4', function(done){
      //at this point user4 shouldn't have any activities
      superagent
      .get(domain + '/users/' + user4.id + '/activities/page/1')
      .end(function(res){
        //make sure there are no activities for this user
        expect(res.status).toEqual(404);
        expect(res.body.activities).toBeUndefined();
      });
      done();
    });
    it('should remove that submission from the recent activity of user1', function(done){
      superagent
      .get(domain + '/users/' + user1.id + '/activities/page/1')
      .end(function(res){
        var activities = res.body;
        //no activities should have a reference to submission2
        //no activities should have a reference to user4
        activities.forEach(function(activity, index){
          //only some have a submission id to compare to
          if (activity.references.submision){
            expect(activity.references.submission.id).not.toEqual(submission2.id);
          }
          //not all activities have an object, make sure it does before comparing
          if (activity.object){
            expect(activity.object.id).not.toEqual(user4.id);
          }
          expect(activity.subject.id).not.toEqual(user4.id);
        });
        expect(res.status).toEqual(200);
        done();
      });
    });
  });
  xdescribe('A Banned User', function(){
    it('should be banned on the final strike and sent an email to both him and the moderator', function(done){
      spyOn(mailers, 'mailBannedUser').andCallThrough();
      spyOn(transporter, 'sendMail').andCallThrough();
      runs(function(){
        User
        .findOne({_id: user4.id})
        .exec(function(err, user){
          //increase to one less than the ban amount
          user.badSubmissions = 2;
          //then run the function to perform the banincrement and check to ban
          user.incrementBadSubmissions(function(err){
            expect(user.badSubmissions).toEqual(3);
          });
        });

      });
      waitsFor(function(){
        return mailers.mailBannedUser.callCount === 1;
      }, "Expect Queue drain to finish and be called", 2000);
      runs(function(){
        //make sure an email was sent
        expect(mailers.mailBannedUser).toHaveBeenCalled();
        //make sure it was called with the correct email address
        expect(mailers.mailBannedUser.mostRecentCall.args[0].email).toEqual(user4.email);
        //make sure the sendMail protocol was called twice, for email to user and one for email to moderator
        expect(transporter.sendMail).toHaveBeenCalled();
        expect(transporter.sendMail.callCount).toEqual(2);
        done();
      });
    });
    it('should no longer let the user login', function(done){
      superagent
      .post(domain + "/users")
      .send({
        username: user4.username,
        password: user4.password
      })
      .end(function(res){
        expect(res.status).not.toEqual(200);
        expect(res.status).toEqual(401);
        done();
      });
    });
    it('should remove the device ids of the user', function(done){
      //this prevents any notifications from being sent to the user system wide
      User
      .findOne({_id: user4.id})
      .exec(function(err, user){
        expect(user.devices.length).toEqual(0);
        done();
      });
    });
    it('should remove the email address of the user allowing them to sign up with it again', function(done){
      //this allows the user to use the same email address to sign up again later
      User
      .findOne({_id: user4.id})
      .exec(function(err, user){
        expect(user.email).not.toEqual(user4.email);
        //we take the userid and add it to their email address to come up with a unique non conflicting email
        expect(user.email).toEqual(user4.id + '|' + user4.email);
        done();
      });
    });
    it('should not allow the user to sign up with the same username', function(done){
      //prevent user from registering with a user with the same username as before
      superagent
      .post(domain + '/register')
      .send({
        username: user4.username,
        password: user4.password,
        email: user4.email
      })
      .end(function(res){
        expect(res.status).not.toEqual(200);
        done();
      });
    });
    it('should allow the user to sign up with the same email address but a different username', function(done){
      //this allows the user to use the same email address to sign up again later
      //pick another, different username
      user4.username = user4.username + '123';
      superagent
      .post(domain + '/register')
      .send({
        username: user4.username,
        password: user4.password,
        email: user4.email
      })
      .end(function(res){
        expect(res.status).toEqual(200);
        user4.id = res.body._id;
        done();
      });
    });
    it ('should allow user4 to now get banned', function(done){
      //before we were setting all banned users to the same email, that causes a conflict when the second user
      //was banned since the email had to be unique
      User.findOne({_id: user4.id})
      .exec(function(err, user){
        user.ban(function(err, user){
          expect(err).toBe(null);
          done();
        });
      });
    });
  });
  describe('it can move to the next test', function(){
    // we need this here so that it moves to the next test in the specRunner since
    // every test invoked requires a callback
    callback(null);
  });

};

