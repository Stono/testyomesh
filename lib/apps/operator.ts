/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { IKubernetes } from 'lib/kubernetes/client'
import WebServer from 'lib/web-server'
import { Models } from 'lib/kubernetes/models'
import { IConfig } from 'lib/config'

export default class Operator extends WebServer {
  private kubernetes: IKubernetes
  private config: IConfig
  private running = true

  constructor(kubernetes: IKubernetes, config: IConfig) {
    super()
    this.kubernetes = kubernetes
    this.config = config
  }

  public async start(): Promise<void> {
    const patchService = (service: string) => {
      return async () => {
        this.logger.info(`patching ${service} to trigger a deployment`)
        this.kubernetes.rollout<Models.Core.IDeployment>(
          'apps/v1',
          'Deployment',
          'testyomesh',
          service
        )
        if (this.running) {
          const schedule = this.nextInterval()
          this.logger.info(`next patch for ${service} in ${schedule}ms`)
          setTimeout(patchService(service), schedule)
        }
      }
    }

    this.config.simpleServiceNames.forEach((service) => {
      const schedule = this.nextInterval()
      this.logger.info(`next patch for ${service} in ${schedule}ms`)
      setTimeout(patchService(service), schedule)
    })

    return super.start()
  }

  private nextInterval(): number {
    function randomIntFromInterval(min, max) {
      const part1 = Math.random() * (max - min + 1)
      return Math.floor(part1 + min)
    }
    return Math.floor(Math.random() * 1000 * 60 * randomIntFromInterval(5, 10))
  }

  public async stop(): Promise<void> {
    this.running = false
    return super.stop()
  }
}
