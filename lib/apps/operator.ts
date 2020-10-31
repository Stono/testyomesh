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
  private patchInterval: NodeJS.Timeout | undefined

  constructor(kubernetes: IKubernetes, loadTester: ILoadTester) {
    super()
    this.kubernetes = kubernetes
    this.loadTester = loadTester
  }

  public async start(): Promise<void> {
    await this.loadTester.start()

    const patchServices = async () => {
      this.logger.info('patching services to trigger a deployment')
      Operator.HTTP_SERVICES.forEach((service) => {
        this.kubernetes.rollout<Models.Core.IDeployment>(
          'apps/v1',
          'Deployment',
          'testyomesh',
          service
        )
      })
    }
    this.patchInterval = setInterval(patchServices, 1000 * 60 * 10)
    return super.start()
  }

  public async stop(): Promise<void> {
    if (this.patchInterval) {
      clearInterval(this.patchInterval)
    }
    return super.stop()
  }
}
