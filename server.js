"use strict";

require("dotenv").config();

const express = require("express");
const passport = require("passport");
const UMDCASStrategy = require("passport-umd-cas").Strategy;
const cors = require("cors");
const CloudKit = require("./cloudkit.js");
const fetch = require("node-fetch");

CloudKit.configure({
  services: {
    fetch: fetch,
  },
  containers: [
    {
      containerIdentifier: process.env.CONTAINER_ID,
      serverToServerKeyAuth: {
        keyID: process.env.KEY_ID,
        privateKeyFile: __dirname + "/eckey.pem",
      },
      environment: "development",
    },
  ],
});

passport.use(new UMDCASStrategy({ callbackURL: "/return" }));

passport.serializeUser(function (user, done) {
  done(null, user.uid);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

const app = express();

app.use(
  require("express-session")({
    secret: "keyboard cat",
    resave: true,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(cors({ credentials: true, origin: "http://localhost:8080" }));

app.get("/login", passport.authenticate("umd-cas"));
app.get("/return", passport.authenticate("umd-cas"), (req, res) => {
  res.redirect("http://localhost:8080");
});

app.get("/", (req, res) => {
  if (req.user) {
    res.send(req.user);
  } else {
    res.send(null);
  }
});

app.get("/packages", (req, res) => {
  if (!req.user) {
    res.send(null);
  } else {
    const container = CloudKit.getDefaultContainer();
    const publicDatabase = container.publicCloudDatabase;
    const currentUser = "Justin Le";
    const queryUser = {
      recordType: "CD_Mailbox",
      filterBy: [
        {
          comparator: "EQUALS",
          fieldName: "CD_firstName",
          fieldValue: { value: currentUser.split(" ")[0] },
        },
        {
          comparator: "EQUALS",
          fieldName: "CD_lastName",
          fieldValue: { value: currentUser.split(" ")[1] },
        },
      ],
    };
    container
      .setUpAuth()
      .then((userInfo) => {
        return publicDatabase.performQuery(queryUser);
      })
      .then((response) => {
        if (response.hasErrors) {
          throw response.errors[0];
        } else {
          if (response.records.length != 1) {
            throw `${response.records.length} users returned instead of 1 user!`;
          }
          const userUUID = response.records[0].recordName;
          const queryPackages = {
            recordType: "CD_Package",
            filterBy: [
              {
                comparator: "EQUALS",
                fieldName: "CD_recipient",
                fieldValue: { value: userUUID },
              },
            ],
          };
          return publicDatabase.performQuery(queryPackages);
        }
      })
      .then((response) => {
        if (response.hasErrors) {
          throw response.errors[0];
        } else {
          const data = response.records.map((record) => {
            return {
              tracking_number: record.fields.CD_trackingNumber.value,
              carrier: record.fields.CD_carrier.value,
              date: record.fields.CD_timestamp.value,
            };
          });
          res.send(data);
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }
});

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("https://shib.idm.umd.edu/shibboleth-idp/profile/cas/logout");
});

app.listen(3000, () => console.log("Starting server on 3000..."));
