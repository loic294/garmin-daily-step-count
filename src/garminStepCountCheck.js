const { GarminConnect } = require("garmin-connect-1.6.1"); // Waiting for oauth from main package
const axios = require("axios");
var moment = require("moment-timezone");

const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

const credential = new DefaultAzureCredential();

const vaultName = "garminhourlycheck";
const url = `https://${vaultName}.vault.azure.net`;
const client = new SecretClient(url, credential);

const secretName = "GarminSession";

async function garminStepCountCheck() {
  try {
    console.log("Checking environment variables...");
    let error = null;

    if (!process.env.GARMIN_USERNAME || !process.env.GARMIN_PASSWORD) {
      throw new Error("Missing user credentials");
    }

    if (!process.env.IFTTT_WEBHOOK) {
      throw new Error("Missing IFTTT webhook URL");
    }

    if (!process.env.MY_GOAL) {
      throw new Error("Missing daily goal step objective");
    }

    const MY_GOAL = +process.env.MY_GOAL;

    const timezone = process.env.TIMEZONE || "America/Los_Angeles";
    console.log("TIMEZONE", timezone);
    const dateRaw = moment().utc(new Date().toUTCString()).tz(timezone);

    const date = dateRaw.format("YYYY-MM-DD");
    const hour = dateRaw.format("H");
    const minute = dateRaw.format("m");

    console.log("DATE", date, hour);

    console.log("Getting step count from Garmin Connect...");

    console.log(
      process.env.GARMIN_USERNAME,
      process.env.GARMIN_PASSWORD.substring(0, 5)
    );

    const GCClient = new GarminConnect({
      username: process.env.GARMIN_USERNAME,
      password: process.env.GARMIN_PASSWORD,
    });

    let session = {};

    try {
      session = await client.getSecret(secretName);
      console.log("Session Exist", !!session, Object.keys(session));

      if (!!session && session.value === "") {
        throw Error("Secret is empty. New login is needed.");
      }

      const tokens = JSON.parse(session.value);

      await GCClient.loadToken(tokens.oauth1, tokens.oauth2);
    } catch (e) {
      error = e.message;
      console.error("ERROR WITH LOGING", e);

      try {
        await GCClient.login();

        console.log("USER INFO", await GCClient.getUserProfile());
      } catch (e2) {
        error = e2.message;
        console.log("ERROR WITH LOGIN RETRY", e2.message);
      }
    }

    const oauth1 = GCClient.client.oauth1Token;
    const oauth2 = GCClient.client.oauth2Token;

    console.log("HAS AUTH TOKENS", !!oauth1, !!oauth2);

    const jsonAuthTokens = JSON.stringify({ oauth1, oauth2 });

    if (oauth1 && oauth2 && JSON.stringify(session.value) !== jsonAuthTokens) {
      console.log("ADDING SESSION TOKEN");
      await client.setSecret(secretName, jsonAuthTokens);
    }

    let steps = -1;

    try {
      steps = await GCClient.getSteps(new Date(date));
      console.log("STEPS", steps);
    } catch (e) {
      error = e.message;
      console.log("ERROR GETTING STEPS", e);

      console.log("RESET SECRET TO EMPTY VALUE");
      await client.setSecret(secretName, "");

      console.log("STEPS", steps);
    }

    const remaining = MY_GOAL - steps;

    const payload = {
      value1: steps,
      value2: remaining,
    };

    const goalCompleted = steps > MY_GOAL;
    const isAfternoon =
      [11, 14, 17, 19].includes(parseInt(hour)) && parseInt(minute) < 30;
    const isEvening = [20, 21].includes(parseInt(hour));
    const isNight = parseInt(hour) >= 22;

    console.log("Total Steps:", steps);
    console.log("Remaining:", remaining);
    console.log("Goal Completed?", goalCompleted ? "Yes" : "No");
    console.log("Is Afternoon?", isAfternoon ? "Yes" : "No");
    console.log("Is Evening?", isEvening ? "Yes" : "No");
    console.log("Is Night?", isNight ? "Yes" : "No");

    if (!goalCompleted && (isAfternoon || isEvening || isNight)) {
      console.log(
        "Sending IFTTT notification webhook",
        process.env.IFTTT_WEBHOOK
      );
      await axios.post(process.env.IFTTT_WEBHOOK, payload);
      console.log("IFTTT notification webhook sent");
    }

    if (!goalCompleted && isNight) {
      onsole.log(
        "Sending IFTTT call webhook",
        process.env.IFTTT_WEBHOOK_LASTCALL
      );
      await axios.post(process.env.IFTTT_WEBHOOK_LASTCALL, payload);
      console.log("IFTTT call webhook sent");
    }

    const results = {
      date,
      hour,
      steps,
      remaining,
      steps,
      error,
    };

    console.log("Final Results", results);

    return results;
  } catch (e) {
    console.error("SCRIPT ERROR", e);
    return { error: e };
  }
}

module.exports = {
  garminStepCountCheck,
};
