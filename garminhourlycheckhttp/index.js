const { garminStepCountCheck } = require("../src/garminStepCountCheck");

module.exports = async function (context, req) {
  console.log("Version: #1");
  console.log("Running hourly step goal check.");

  const results = await garminStepCountCheck();

  console.log("Results", results);

  context.res = {
    body: JSON.stringify(results),
  };
};
