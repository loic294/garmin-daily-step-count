const { garminStepCountCheck } = require("../src/garminStepCountCheck");

module.exports = async function () {
  console.log("Start Garmin Step Count Timer Check");
  await garminStepCountCheck();
};
