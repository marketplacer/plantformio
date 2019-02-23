import AWS from 'aws-sdk'
import { isAlertRequired } from '../history'

AWS.config.update({
  region: 'us-east-1'
})

const db = new AWS.DynamoDB.DocumentClient()

isAlertRequired(
  {
    value: 123,
    plant: 'pubert',
    time: new Date()
  },
  db
).catch(e => {
  console.error('Bad things happened', e)
})
