/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { IKubernetes } from 'lib/kubernetes/client'
import WebServer from 'lib/web-server'
import { Models } from 'lib/kubernetes/models'
import { ILoadTester } from 'lib/loadTester'

export default class Operator extends WebServer {
  private kubernetes: IKubernetes
  private loadTester: ILoadTester
  public static readonly HTTP_SERVICES: string[] = [
    'testyomesh-1',
    'testyomesh-2',
    'testyomesh-3'
  ]
  private running = true

  constructor(kubernetes: IKubernetes, loadTester: ILoadTester) {
    super()
    this.kubernetes = kubernetes
    this.loadTester = loadTester
  }

  public async start(): Promise<void> {
    await this.loadTester.start()

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

    Operator.HTTP_SERVICES.forEach((service) => {
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
