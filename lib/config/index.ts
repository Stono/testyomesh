import Logger from 'lib/logger'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import { HttpMethod } from 'lib/apps/load-tester'

const logger = new Logger('config')

export interface IConfig {
  workerThreadCount: number
  simpleServices: number
  simpleServiceNames: string[]
  httpMethods: HttpMethod[]
  httpPaths: string[]
  statusCodes: number[]
}

export default class Config implements IConfig {
  public workerThreadCount = 2
  public simpleServices = 3
  public simpleServiceNames: string[] = []
  public httpMethods: HttpMethod[] = ['GET']
  public httpPaths: string[] = ['/instant']
  public statusCodes: number[] = [200]

  async start(): Promise<void> {
    const configPath = '/etc/config/config.yaml'
    if (fs.existsSync(configPath)) {
      const data = yaml.load(fs.readFileSync(configPath).toString())
      Object.keys(data).forEach((key) => {
        this[key] = data[key]
      })
    } else {
      logger.warn(`no config file found at ${configPath}`)
    }

    for (let i = 0; i < this.simpleServices; i += 1) {
      const service = `testyomesh-${i + 1}`
      this.simpleServiceNames.push(service)
    }

    logger.info('config loaded')
  }
}
