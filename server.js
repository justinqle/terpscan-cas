const express = require('express');
const passport = require('passport');
const UMDCASStrategy = require('passport-umd-cas').Strategy;
const cors = require('cors');

passport.use(new UMDCASStrategy({ callbackURL: '/umd/return' }));

passport.serializeUser(function (user, done) {
    done(null, user.uid);
});

passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

const app = express();

app.set('view engine', 'pug');

app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(cors({credentials: true, origin: 'http://localhost:8080'}));

app.get('/umd/login', passport.authenticate('umd-cas'));
app.get('/umd/return', passport.authenticate('umd-cas'), (req, res) => {
    // res.redirect('/')
    res.redirect('http://localhost:8080');
});

app.get('/', (req, res) => {
    if (req.user) {
        // res.render('profile', { title: 'Profile', user: req.user })
        res.send(req.user);
    } else {
        // res.render('login', { title: 'Login' })
        res.send(null);
    }
});

app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('https://shib.idm.umd.edu/shibboleth-idp/profile/cas/logout');
});

app.listen(3000, () => console.log('Starting server on 3000...'));