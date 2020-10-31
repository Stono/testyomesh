import { Models } from 'lib/kubernetes/models'
import { BaseTask } from 'lib/apps/tasks/index'

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

export default class AuthPolicyToggle extends BaseTask {
  protected async run(): Promise<void> {
    const exists = await this.kubernetes.get<Models.Istio.AuthorizationPolicy>(
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
  }
}
