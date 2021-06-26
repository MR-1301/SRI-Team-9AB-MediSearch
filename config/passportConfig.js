const User = require("../models/User");
const bcrypt = require("bcryptjs");
const localStrategy = require("passport-local").Strategy;
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

module.exports = function (passport) {
  passport.use(
    new localStrategy((username, password, done) => {
      User.findOne({username: username}, (err, user) => {
        if (err) throw err;
        if (!user) return done(null, false);
        bcrypt.compare(password, user.password, (err, result) => {
          if (err) throw err;
          if (result === true) {
            return done(null, user);
          } else {
            return done(null, false);
          }
        });
      });
    })
  );
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'https://medi--search.herokuapp.com/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      const newUser = {
        googleId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        username: profile.emails[0].value,
        position: 0,
      }
      try {
        let user = await User.findOne({googleId: profile.id})
        if (user) {
          console.log('found!!');
          done(null, user)
        } else {
          const newUserInstance=new User(newUser);
          newUserInstance.save()
            .then((res) => {
              console.log("contact done");
              done(null, user);
            }, (err) => {
              console.log(`posterr${err}`);
              done(null, false);
            })
        }
        
      } catch (error) {
        console.log(error);
      }
    }
    )
  )
  passport.serializeUser((user, cb) => {
    cb(null, user.id);
  });
  

  passport.deserializeUser((id, cb) => {
    User.findOne({_id: id}, (err, user) => {
      const userInformation = {
        username: user.username,
      };
      cb(null, user);
    });
  });
};