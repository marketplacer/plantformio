const axios = require("axios");

exports.handler = event => {
  axios.post(
    process.env.WEBHOOK_URL,
    {
      text: JSON.stringify(event)
    }
  );
};
