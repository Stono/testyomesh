import Logger from 'lib/logger'
import { IKubernetes } from 'lib/kubernetes/client'
import { Models } from 'lib/kubernetes/models'

const logger = new Logger('config')

export interface IConfig {
  workerThreadCount: number
}

export default class Config implements IConfig {
  private readonly kubernetes: IKubernetes
  public workerThreadCount = 2

  constructor(kubernetes: IKubernetes) {
    this.kubernetes = kubernetes
  }
  async start(): Promise<void> {
    const manifest = await this.kubernetes.get<Models.Core.IConfigMap>(
      'v1',
      'ConfigMap',
      'testyomesh',
      'operator'
    )
    if (!manifest) {
      throw new Error('Unable to load ConfigMap!')
    }

    const data = manifest.data || {}
    Object.keys(data).forEach((key) => {
      this[key] = data[key]
    })
    logger.info('config loaded')
  }
}
