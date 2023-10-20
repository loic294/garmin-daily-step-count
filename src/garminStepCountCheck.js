const { GarminConnect } = require("garmin-connect"); // Waiting for oauth from main package
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

  const dateRaw = moment()
    .utc(new Date().toUTCString())
    //.tz("America/Los_Angeles"); // PST
    .tz("America/New_York"); // EST

  const date = dateRaw.format("YYYY-MM-DD");
  const hour = dateRaw.format("H");
  const minute = dateRaw.format("m");

  console.log("DATE", date, hour);

  console.log("Getting step count from Garmin Connect...");

  console.log(
    process.env.GARMIN_USERNAME,
    process.env.GARMIN_PASSWORD.substring(1, 4)
  );

  const GCClient = new GarminConnect({
    username: process.env.GARMIN_USERNAME,
    password: process.env.GARMIN_PASSWORD,
  });

  let session = {};

  try {
    session = await client.getSecret(secretName);
    console.log("Session Exist", !!session, Object.keys(session));

    if (!!session && session.value === "" && JSON.parse(session.value).oauth1) {
      throw Error("Secret is empty. New login is needed.");
    }

    const tokens = JSON.parse(session.value);

    await GCClient.loadToken(
      !!session && JSON.parse(session.value),
      tokens.oauth1,
      tokens.oauth2
    );

    const userInfo = GCClient.getUserInfo();

    console.log("USER INFO", userInfo);
  } catch (e) {
    error = e.message;
    console.error("ERROR WITH LOGING", e);

    try {
      await GCClient.login();

      console.log("USER INFO", await GCClient.getUserInfo());
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

    console.log("RETRY LOGIN");
    await GCClient.login();

    console.log("RETRY GETTING STEPS");
    steps = await GCClient.getSteps(new Date(date));
    console.log("STEPS", steps);
  }

  const totalSteps = steps.reduce((acc, item) => acc + item.steps, 0);
  const remaining = MY_GOAL - totalSteps;

  const payload = {
    value1: totalSteps,
    value2: remaining,
  };

  const goalCompleted = totalSteps > MY_GOAL;
  const isAfternoon =
    [11, 14, 17, 19].includes(parseInt(hour)) && parseInt(minute) < 30;
  const isEvening = [20, 21].includes(parseInt(hour));
  const isNight = parseInt(hour) >= 22;

  if (!goalCompleted && (isAfternoon || isEvening || isNight)) {
    await axios.post(process.env.IFTTT_WEBHOOK, payload);
  }

  if (!goalCompleted && isNight) {
    await axios.post(process.env.IFTTT_WEBHOOK_LASTCALL, payload);
  }

  return {
    date,
    hour,
    totalSteps,
    remaining,
    steps,
    error,
  };
}

module.exports = {
  garminStepCountCheck,
};
