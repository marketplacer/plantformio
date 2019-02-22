import metrics from 'datadog-metrics'
import axios from 'axios'
import { DynamoDB } from 'aws-sdk'

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

export const handler = ({ value, plantName }: Payload): void => {
  metrics.gauge(`${plantName}.moisture`, value)
  const message = `Received ${value} on ${plantName}`
  console.log(message)

  dynamoDb.put(
    {
      TableName: process.env.DYNAMODB_TABLE,
      Item: {
        plant: plantName,
        value,
        time: new Date().toISOString()
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

  axios
    .post(process.env.WEBHOOK_URL, {
      text: message
    })
    .then(() => {
      console.log('Succeeded')
    })
    .catch(e => {
      console.error('Failed to publish to Slack', e)
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
