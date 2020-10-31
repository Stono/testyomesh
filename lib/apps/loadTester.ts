import { IConfig } from 'lib/config'
import got from 'got'
import WebServer from 'lib/web-server'

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
interface ITask {
  method: HttpMethod
  searchParams: any
  url: string
}

export class LoadTester extends WebServer {
  private readonly config: IConfig
  private readonly tasks: ITask[] = []
  private running = true

  constructor(config: IConfig) {
    super()

    this.config = config

    const forEachService = (service) => {
      const otherServices = this.config.simpleServiceNames.filter(
        (other) => other !== service
      )

      const forEachMethod = (method) => {
        const forEachPath = (path) => {
          const forEachCode = (code) => {
            // Add each permutation of method, and path
            this.tasks.push({
              method,
              searchParams: {
                code
              },
              url: `http://${service}.testyomesh.svc.cluster.local${path}`
            })

            // Now add a downstream request with the same
            otherServices.forEach((otherService) => {
              this.tasks.push({
                method,
                searchParams: {
                  code
                },
                url: `http://${service}.testyomesh.svc.cluster.local/downstream?servers=${otherService}.testyomesh.svc.cluster.local${path}`
              })
            })
          }
          config.statusCodes.forEach(forEachCode)
        }
        config.httpPaths.forEach(forEachPath)
      }
      config.httpMethods.forEach(forEachMethod)
    }

    this.config.simpleServiceNames.forEach(forEachService)

    if (this.tasks.length === 0) {
      throw new Error('There are no tasks!')
    }
  }

  public async start(): Promise<void> {
    this.logger.info('starting load tester')

    const executeRandomTask = async (): Promise<void> => {
      const task = this.tasks[Math.floor(Math.random() * this.tasks.length)]
      this.logger.info('running', task)
      try {
        await got<any>(task.url, {
          searchParams: task.searchParams,
          method: task.method,
          timeout: 10000
        })
      } catch (ex) {
        this.logger.error(`${task.method}: ${task.url} failed.`, ex)
      } finally {
        if (this.running) {
          executeRandomTask()
        }
      }
    }

    this.logger.info(`using ${this.config.workerThreadCount} worker threads`)

    for (let i = 0; i < this.config.workerThreadCount; i += 1) {
      executeRandomTask()
    }
  }

  public async stop(): Promise<void> {
    this.running = false
  }
}
