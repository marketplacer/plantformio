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

export const handler = ({ value: rawValue, plantName }: Payload): void => {
  /** Inverted reading, so that high moisture means high number */
  const value = 1024 - rawValue
  metrics.gauge(`${plantName}.moisture`, value)

  console.log(`Received ${value} on ${plantName}`)

  const reading: Reading = {
    value,
    plant: plantName,
    time: new Date()
  }

  isAlertRequired(reading, dynamoDb)
    .then(name => {
      if (!name) return false

      return axios
        .post(process.env.WEBHOOK_URL, {
          text: `${name} needs watering!`
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
