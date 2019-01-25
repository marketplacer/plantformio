const metrics = require("datadog-metrics");
metrics.init({
  host: "plants",
  prefix: "plants.",
  apiKey: process.env.DATADOG_API_KEY
});
const axios = require("axios");

exports.handler = ({ value, plantName }) => {
  metrics.gauge(`${plantName}.moisture`, value);
  console.log("ARE WE EVEN STARTING");
  const message = `Received ${value} on ${plantName}`;
  console.log(message);

  axios
    .post(process.env.WEBHOOK_URL, {
      text: message
    })
    .then(() => {
      console.log("succeeded");
    })
    .catch(e => {
      console.error("Network error", e);
    });
};
