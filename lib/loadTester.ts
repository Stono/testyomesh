import { IConfig } from 'lib/config'
import Logger from './logger'
import got from 'got'
import Operator from './apps/operator'

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
interface ITask {
  method: HttpMethod
  url: string
}

export interface ILoadTester {
  start(): Promise<void>
  stop(): Promise<void>
}

export class LoadTester implements ILoadTester {
  private readonly config: IConfig
  private readonly logger = new Logger('load-tester')
  private static readonly HTTP_METHODS: HttpMethod[] = [
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'PATCH',
    'DELETE'
  ]
  private static readonly HTTP_ENDPOINTS: string[] = ['/instant', '/delayed']
  private workers: NodeJS.Timeout[] = []
  private readonly tasks: ITask[] = []

  constructor(config: IConfig) {
    this.config = config
    Operator.HTTP_SERVICES.forEach((service) => {
      const otherServices = Operator.HTTP_SERVICES.filter(
        (other) => other !== service
      )

      LoadTester.HTTP_METHODS.forEach((method) => {
        const endpoints = LoadTester.HTTP_ENDPOINTS
        endpoints.forEach((endpoint) => {
          this.tasks.push({
            method,
            url: `http://${service}.testyomesh.svc.cluster.local${endpoint}`
          })
          otherServices.forEach((otherService) => {
            this.tasks.push({
              method,
              url: `http://${service}.testyomesh.svc.cluster.local/downstream?servers=${otherService}.testyomesh.svc.cluster.local${endpoint}`
            })
          })
        })
      })
    })
  }

  public async start(): Promise<void> {
    this.logger.info('starting load tester')

    const executeRandomTask = async (): Promise<void> => {
      const task = this.tasks[Math.floor(Math.random() * this.tasks.length)]
      this.logger.info(`${task.method}: ${task.url}`)
      try {
        await got<any>(task.url, { method: task.method, timeout: 10000 })
      } catch (ex) {
        this.logger.error(`${task.method}: ${task.url} failed.`, ex)
      }
    }

    const threads = parseInt(process.env.WORKER_THREADS || '2', 10)
    this.logger.info(`using ${threads} worker threads`)

    function createWorkerArray(): Promise<void>[] {
      const arr: Promise<void>[] = []
      for (let i = 0; i < threads; i += 1) {
        arr.push(executeRandomTask())
      }
      return arr
    }

    const workerInterval = setInterval(async () => {
      try {
        await Promise.all(createWorkerArray())
      } catch (err) {
        this.logger.error(err)
        process.exit(1)
      }
    }, 200)

    this.workers.push(workerInterval)
  }

  public async stop(): Promise<void> {
    this.workers.forEach(clearInterval)
  }
}
