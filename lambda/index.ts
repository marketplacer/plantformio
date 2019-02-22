import metrics from 'datadog-metrics'
import axios from 'axios'

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

  axios
    .post(process.env.WEBHOOK_URL, {
      text: message
    })
    .then(() => {
      console.log('Succeeded')
    })
    .catch(e => {
      console.error('Network error', e)
    })

  metrics.flush(() => {
    console.log('Metrics flushed')
  }, (e) => {
    console.error('Failed to flush metrics', e)
  })
}
