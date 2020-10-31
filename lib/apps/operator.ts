/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { IKubernetes } from 'lib/kubernetes/client'
import WebServer from 'lib/web-server'
import { Models } from 'lib/kubernetes/models'
import { IConfig } from 'lib/config'

const filter = {
  apiVersion: 'security.istio.io/v1beta1',
  kind: 'AuthorizationPolicy',
  metadata: {
    namespace: 'testyomesh',
    name: 'toggle'
  },
  spec: {
    selector: {
      matchLabels: {
        component: 'simple-service'
      }
    },
    action: 'ALLOW',
    rules: [
      {
        to: [
          {
            operation: {
              methods: ['*']
            }
          }
        ]
      }
    ]
  }
}

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

    const toggleAuthPolicy = async () => {
      try {
        const exists = await this.kubernetes.get<
          Models.Istio.AuthorizationPolicy
        >(
          'security.istio.io/v1beta1',
          'AuthorizationPolicy',
          'testyomesh',
          'toggle'
        )
        if (exists) {
          this.logger.info('deleting authorization policy')
          await this.kubernetes.delete<Models.Istio.AuthorizationPolicy>(
            'security.istio.io/v1beta1',
            'AuthorizationPolicy',
            'testyomesh',
            'toggle'
          )
        } else {
          this.logger.info('creating authorization policy')
          await this.kubernetes.create(filter)
        }
      } catch (ex) {
        this.logger.error('failed to handle authentication change', ex)
      }

      if (this.running) {
        const schedule = this.nextInterval()
        this.logger.info(`next authentication change in ${schedule}ms`)
        setTimeout(toggleAuthPolicy, schedule)
      }
    }

    this.config.simpleServiceNames.forEach((service) => {
      const schedule = this.nextInterval()
      this.logger.info(`next patch for ${service} in ${schedule}ms`)
      setTimeout(patchService(service), schedule)
    })

    const schedule = this.nextInterval()
    this.logger.info(`next authentication change in ${schedule}ms`)
    setTimeout(toggleAuthPolicy, schedule)

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
