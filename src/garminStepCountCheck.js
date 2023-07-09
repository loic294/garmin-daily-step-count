const { GarminConnect } = require("garmin-connect");
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
  const error = null;

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
    .tz("America/Los_Angeles");

  const date = dateRaw.format("YYYY-MM-DD");
  const hour = dateRaw.format("H");
  const minute = dateRaw.format("m");

  console.log("DATE", date, hour);

  console.log("Getting step count from Garmin Connect...");

  const GCClient = new GarminConnect({
    username: process.env.GARMIN_USERNAME,
    password: process.env.GARMIN_PASSWORD,
  });

  try {
    const session = await client.getSecret(secretName);
    await GCClient.restoreOrLogin(
      session,
      process.env.GARMIN_USERNAME,
      process.env.GARMIN_PASSWORD
    );

    if (GCClient.sessionJson) {
      await client.setSecret(secretName, GCClient.sessionJson);
    }
  } catch (e) {
    error = e.message;
  }

  const steps = await GCClient.getSteps(new Date(date));

  console.log("STEPS", steps);

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
