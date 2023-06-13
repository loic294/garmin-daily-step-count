const { garminStepCountCheck } = require("../src/garminStepCountCheck");

module.exports = async function () {
  console.log("Start Garmin Step Count Timer Check");
  const results = await garminStepCountCheck();

  return results;
};
