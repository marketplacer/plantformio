import fs from 'fs'
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
  /** Whether an alert was sent */
  alerted: boolean
}

interface DbResponse {
  Items: DbEntry[]
  Count: number
  ScannedCount: number
}

/** Get plant configuration */
const getConfig = (plant: string): Promise<Plant> =>
  new Promise((resolve, reject) => {
    fs.readFile(`./lambda/plants/${plant}.json`, 'utf8', (e, data) => {
      if (e) {
        console.error('Failed to fetch plant config')
        return reject(e)
      }

      resolve(JSON.parse(data))
    })
  })

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

/** Check if the most recent reading shows the plant to already be watered */
const justWatered = (value: number, thresholdValue: number): boolean => {
  const isJustWatered = value >= thresholdValue
  if (isJustWatered) console.log('Already watered')

  return isJustWatered
}

/** Check if an alert was recently sent */
const recentlyAlerted = (readingTime: Date, entries: DbEntry[]): boolean => {
  const previousAlertWindow = new Date(readingTime)
  previousAlertWindow.setHours(previousAlertWindow.getHours() - 8)

  const withinPreviousAlertWindow = (entry: DbEntry): boolean => {
    const entryTime = new Date(entry.time)

    return (
      entryTime >= previousAlertWindow &&
      entryTime <= readingTime &&
      entry.alerted
    )
  }

  const isRecentlyAlerted = entries.some(withinPreviousAlertWindow)
  if (isRecentlyAlerted) console.log('Recently alerted')

  return isRecentlyAlerted
}

/** Check if there are enough readings to proceed */
const notEnoughReadings = (
  thresholdTime: Date,
  entries: DbEntry[]
): boolean => {
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

  const isNotEnoughReadings = !entries.some(withinStartWindow)
  if (isNotEnoughReadings) console.log('Not enough readings')

  return isNotEnoughReadings
}

/* Check if every entry is below the required moisture value */
const meetsThreshold = (threshold: number, entries: DbEntry[]): boolean => {
  const isBelowThreshold = ({ value }: DbEntry): boolean => value < threshold

  if (entries.every(isBelowThreshold)) {
    console.log('Needs watering')

    return true
  }

  return false
}

/** Return whether a watering alert is required for the current plant */
export const isAlertRequired = (
  { value, plant, time: readingTime }: Reading,
  db: DynamoDB.DocumentClient
): Promise<boolean> =>
  getConfig(plant)
    .then(plantConfig => {
      /* JS Date objects (╯°□°）╯︵ ┻━┻ */
      const thresholdTime = new Date(readingTime)
      thresholdTime.setHours(
        readingTime.getHours() - plantConfig.threshold.hours
      )

      return getMoistureReadings(plant, thresholdTime, db).then(entries => ({
        plantConfig,
        thresholdTime,
        entries
      }))
    })
    .then(({ plantConfig, thresholdTime, entries }) => {
      if (justWatered(value, plantConfig.threshold.value)) return false
      if (recentlyAlerted(readingTime, entries)) return false
      if (notEnoughReadings(thresholdTime, entries)) return false

      return meetsThreshold(plantConfig.threshold.value, entries)
    })
    .catch(e => {
      console.error(e)

      /* If anything fails in alerting, we should still let logging occur */
      return false
    })
