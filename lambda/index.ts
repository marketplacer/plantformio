import metrics from 'datadog-metrics'
import axios from 'axios'
import { DynamoDB } from 'aws-sdk'
import { table } from './environment'
import { Reading, isAlertRequired } from './history'

const dynamoDb = new DynamoDB.DocumentClient()

metrics.init({
  host: 'plants',
  prefix: 'plants.',
  apiKey: process.env.DATADOG_API_KEY
})

interface Payload {
  /** Sensor reading */
  value: number
  plantName: string
}

/** Capitalize the first letter of a string */
const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1)

export const handler = ({ value, plantName }: Payload): void => {
  metrics.gauge(`${plantName}.moisture`, value)
  console.log(`Received ${value} on ${plantName}`)

  const reading: Reading = {
    value: value,
    plant: plantName,
    time: new Date()
  }

  isAlertRequired(reading, dynamoDb)
    .then(shouldAlert => {
      if (!shouldAlert) return false

      return axios
        .post(process.env.WEBHOOK_URL, {
          text: `${capitalize(plantName)} needs watering!`
        })
        .then(() => {
          console.log('Alerted')
          return true
        })
        .catch(e => {
          console.error('Failed to publish to Slack', e)
          return false
        })
    })
    .then(alerted => {
      dynamoDb.put(
        {
          TableName: table,
          Item: {
            alerted,
            plant: plantName,
            time: new Date().toISOString(),
            value
          }
        },
        (error, result) => {
          if (error) {
            console.error('Failed to write to DB', error)
          }

          if (result) {
            console.log('Wrote to DB')
          }
        }
      )
    })
    .catch(e => {
      console.log(
        'This should never fail, but here we are. We failed to get an answer on whether to water or not',
        e
      )
    })

  metrics.flush(
    () => {
      console.log('Metrics flushed')
    },
    e => {
      console.error('Failed to flush metrics', e)
    }
  )
}
