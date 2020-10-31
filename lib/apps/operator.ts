/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { IKubernetes } from 'lib/kubernetes/client'
import WebServer from 'lib/web-server'
import { IConfig } from 'lib/config'
import { BaseTask } from './tasks'
import AuthPolicyToggle from './tasks/auth-policy'
import RestartSimpleService from './tasks/restart-simple-service'

export default class Operator extends WebServer {
  private kubernetes: IKubernetes
  private config: IConfig
  private tasks: BaseTask[] = []

  constructor(kubernetes: IKubernetes, config: IConfig) {
    super()
    this.kubernetes = kubernetes
    this.config = config
  }

  public async start(): Promise<void> {
    this.tasks.push(new AuthPolicyToggle(this.kubernetes, this.config))
    this.tasks.push(new RestartSimpleService(this.kubernetes, this.config))

    this.tasks.forEach((task) => task.start())
    return super.start()
  }

  public async stop(): Promise<void> {
    this.tasks.forEach((task) => task.stop())
    return super.stop()
  }
}
