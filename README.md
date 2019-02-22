# Plantformio

[![Build Status](https://travis-ci.org/marketplacer/plantformio.svg?branch=master)](https://travis-ci.org/marketplacer/plantformio)

**An unnecessarily complicated way of seeing if your plants need watering**

## Prerequisites

1. [Platformio](https://platformio.org/)
2. [Node, version 8](https://nodejs.org/en/)
3. [Serverless](https://serverless.com/)
3. [Datadog](https://www.datadoghq.com/)
4. Many other things, probably.

## The Software Side

Everything is configured to just work™ with AWS. A (slightly) restricted role can be used with the policy defined in `policy.json`.

To build your code locally, you'll need all the dependencies (`yarn install`) and then run `yarn run compile`. This is exactly what gets run in CI, except we also run `yarn run deploy` for master builds to get it on to AWS.

## The Hardware Side

While we're still prototyping, we're using a NodeMCU, with a soil moisture sensor. You can flash the code to the NodeMCU by going into the `module` folder (`cd module`) and running

```sh
platformio run --target upload
```

**But this isn't enough!**

You'll need to give the hardware the right credentials. Copy `module/src/env.h.example` to `module/src/env.h`, and update everything you can. The various MQTT credentials (including certificates need to be made in the AWS console), over at the [IoT Core section](https://console.aws.amazon.com/iot/home?region=us-east-1).
