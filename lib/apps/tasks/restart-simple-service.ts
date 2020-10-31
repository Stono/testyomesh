import { Models } from 'lib/kubernetes/models'
import { BaseTask } from 'lib/apps/tasks/index'

export default class RestartSimpleService extends BaseTask {
  protected async run(): Promise<void> {
    const whichService = this.randomIntFromInterval(
      1,
      this.config.simpleServices
    )
    const serviceName = `testyomesh-${whichService}`
    this.logger.info(`patching ${serviceName} to trigger a deployment`)
    this.kubernetes.rollout<Models.Core.IDeployment>(
      'apps/v1',
      'Deployment',
      'testyomesh',
      serviceName
    )
  }
}
