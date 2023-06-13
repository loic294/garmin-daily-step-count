const { GarminConnect } = require("garmin-connect");
const axios = require("axios");
var moment = require("moment-timezone");

async function garminStepCountCheck() {
  console.log("Checking environment variables...");

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

  console.log("DATE", date, hour);

  console.log("Getting step count from Garmin Connect...");

  const GCClient = new GarminConnect({
    username: process.env.GARMIN_USERNAME,
    password: process.env.GARMIN_PASSWORD,
  });
  await GCClient.login();

  const steps = await GCClient.getSteps(new Date(date));

  console.log("STEPS", steps);

  const totalSteps = steps.reduce((acc, item) => acc + item.steps, 0);
  const remaining = MY_GOAL - totalSteps;

  const payload = {
    value1: totalSteps,
    value2: remaining,
  };

  await axios.post(process.env.IFTTT_WEBHOOK, payload);

  if (totalSteps < MY_GOAL && parseInt(hour) >= 21) {
    await axios.post(process.env.IFTTT_WEBHOOK_LASTCALL, payload);
  }

  return {
    date,
    hour,
    totalSteps,
    remaining,
    steps,
  };
}

module.exports = { garminStepCountCheck };
