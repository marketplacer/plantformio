import { DynamoDB } from 'aws-sdk'
import { table } from './environment'
import { Plant } from './plants/plant'

/** Properties of the current plant sensor reading event */
export interface Reading {
  /** Sensor value */
  value: number
  /** Plant name */
  plant: string
  /** Reading time */
  time: Date
}

interface DbEntry {
  /** Sensor value */
  value: number
  /** Plant name */
  plant: string
  /** ISO8601 string */
  time: string
}

interface DbResponse {
  Items: DbEntry[]
  Count: number
  ScannedCount: number
}

const getMoistureReadings = (
  plant: string,
  time: Date,
  db: DynamoDB.DocumentClient
): Promise<DbEntry[]> =>
  new Promise((resolve, reject) => {
    db.query(
      {
        TableName: table,
        KeyConditionExpression: '#plant = :plant AND #time >= :thresholdTime',
        ExpressionAttributeNames: {
          '#plant': 'plant',
          '#time': 'time'
        },
        ExpressionAttributeValues: {
          ':plant': plant,
          ':thresholdTime': time.toISOString()
        }
      },
      (e, data: DbResponse) => {
        if (e) {
          console.error('Failed to query for plant history')
          reject(e)
        }

        if (data) {
          resolve(data.Items)
        }
      }
    )
  })

/** Determine whether a watering alert is required for the current plant */
export const isAlertRequired = (
  { value, plant, time: readingTime }: Reading,
  db: DynamoDB.DocumentClient
): Promise<boolean> => {
  const plantConfig: Plant = require(`../plants/${plant}.json`)

  /* JS Date objects (╯°□°）╯︵ ┻━┻ */
  const thresholdTime = new Date(readingTime)
  thresholdTime.setHours(readingTime.getHours() - plantConfig.threshold.hours)

  return getMoistureReadings(plant, thresholdTime, db)
    .then(entries => {
      /* Don't alert if the most recent reading shows the plant is watered */
      if (value >= plantConfig.threshold.value) {
        console.log('Already watered')

        return false
      }

      /* Don't alert if we haven't got readings going back to the threshold time */

      /** End time wherein we must find a reading in order for the dataset to be considered complete */
      const thresholdTimeReadingWindow = new Date(thresholdTime)
      /* 30 min, being just a little bit over the submission frequency (20 min) */
      thresholdTimeReadingWindow.setMinutes(
        thresholdTimeReadingWindow.getMinutes() + 30
      )

      const withinStartWindow = (entry: DbEntry): boolean => {
        const entryTime = new Date(entry.time)

        return (
          entryTime >= thresholdTime && entryTime <= thresholdTimeReadingWindow
        )
      }

      if (!entries.some(withinStartWindow)) {
        console.log('Not enough readings')

        return false
      }

      /* Alert if every entry is below the required moisture value */
      const isBelowThreshold = ({ value }: DbEntry): boolean =>
        value < plantConfig.threshold.value

      if (entries.every(isBelowThreshold)) {
        console.log('Needs watering')

        return true
      }
    })
    .catch(() => {
      /* If we don't get history, that shouldn't stop us saving data */
      return false
    })
}
