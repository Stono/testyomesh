/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-var-requires */
const Client = require('kubernetes-client').Client
const { KubeConfig } = require('kubernetes-client')

import * as fs from 'fs'
import Request from './monkeypatch/client'
import { Models } from './models'
import Logger, { ILogger } from 'lib/logger'
import { StatefulSetStatus } from 'kubernetes-types/apps/v1'

export enum KubernetesEventType {
  ALL,
  ADDED,
  MODIFIED,
  DELETED
}

export enum PatchType {
  MergePatch,
  JsonPatch
}

interface IGodaddyPostResult {
  messages: any[]
}

export interface IGodaddyClient {
  loadSpec()
  addCustomResourceDefinition(spec: Models.IExistingResource)
  apis: {
    [apiName: string]: { [version: string]: any }
  }
  api: { [version: string]: any }
}

export interface IGodaddyApi {
  get(options?: { qs: { labelSelector: string } })
  delete()
  post(body: any)
  patch(data: any)
  namespaces(name: string)
  exec: {
    post(options: {
      qs: {
        command: any
        container: string
        stdout: boolean
        stderr: boolean
      }
    }): Promise<IGodaddyPostResult>
  }
}

export enum PodPhase {
  Pending,
  Running,
  Succeeded,
  Failed,
  Unknown
}

export interface IKubernetes {
  /**
   * Returns a single kubernetes resource
   * @param {string} api The Kubernetes API to target
   * @param {T['apiVersion']} apiVersion The version of that API
   * @param {T['kind']} kind The Kind of object to select
   * @param {string} namespace The namespace to go to
   * @param {string} name The name of the object
   * @returns {Promise<(T & Models.IExistingResource) | null>} The object, or undefined if not found
   */
  get<T extends Models.IBaseResource>(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace: string,
    name: string
  ): Promise<(T & Models.IExistingResource) | null>

  /**
   * Returns a collection of kubernetes resources based on the selection criteria
   * @param {T['apiVersion']} apiVersion The version of that API
   * @param {T['kind']} kind The Kind of object to select
   * @param {string?} namespace (optional) The namespace to restrict to
   * @param {string?} labelSelector (optional) The label to select, eg app=your-app
   * @returns {Promise<(T & Models.IExistingResource)[]>} An array of Kubernetes resources
   */
  select<T extends Models.IBaseResource>(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace?: string | null | undefined,
    labelSelector?: string | null | undefined
  ): Promise<(T & Models.IExistingResource)[]>

  /**
   * Patch a kubernetes resource
   * @param {T['apiVersion']} apiVersion The version of that API
   * @param {T['kind']} kind The Kind of object to select
   * @param {string} namespace The namespace to go to
   * @param {string} name The name of the object
   * @param {PatchType} patchType The type of patch operation to run
   * @param {any} patch The patch to apply
   * @returns {Promise<void>} A promise to indicate if the request was successful or not
   */
  patch<T extends Models.IBaseResource>(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace: string,
    name: string,
    patchType: PatchType.MergePatch,
    patch: any
  ): Promise<void>
  patch<T extends Models.IBaseResource>(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace: string,
    name: string,
    patchType: PatchType.JsonPatch,
    patch: jsonpatch.OpPatch[]
  ): Promise<void>

  /**
   * Create a new kubernetes resource
   * @param {T & Models.INewResource} manifest The manifest to create
   * @returns {Promise<void>} A promise to indicate if the request was successful or not
   */
  create<T extends Models.IBaseResource>(
    manifest: T & Models.INewResource
  ): Promise<void>

  /**
   * Removes a kubernetes resource from the cluster
   * @param {T['apiVersion']} apiVersion The version of that API
   * @param {T['kind']} kind The Kind of object to select
   * @param {string} namespace The namespace to go to
   * @param {string} name The name of the object
   * @returns {Promise<void>} A promise to indicate if the request was successful or not
   */
  delete<T extends Models.IBaseResource>(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace: string,
    name: string
  ): Promise<void>

  /**
   * Starts
   * @returns {Promise<void>}
   */
  start()

  /**
   * Stops
   * @returns {Promise<void>}
   */
  stop()

  /**
   * Waits for something to rollout
   * @param {T['apiVersion']} apiVersion The version of that API
   * @param {T['kind']} kind The Kind of object to select
   * @param {string} namespace The namespace to go to
   * @param {string} name The name of the object
   * @param {number?} maxTime The maximum amount of time in milliseconds to wait
   * @returns {Promise<void>} A promise that returns when all replicas are up to date
   */
  waitForRollout<T extends Models.Core.IDeployment>(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace: string,
    name: string,
    maxTime?: number
  ): Promise<void>

  /**
   * Trigger a rollout of a pod controller
   * @param {T['apiVersion']} apiVersion The version of that API
   * @param {T['kind']} kind the Kind of object to rollout
   * @param {string} namespace The namespace to go to
   * @param {string} name The name of the object
   * @returns {Promise<void>} A promise that returns once a rollout has been triggered
   */
  rollout<
    T extends
      | Models.Core.IDeployment
      | Models.Core.IStatefulSet
      | Models.Core.IDaemonSet
  >(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace: string,
    name: string
  ): Promise<void>
}

export default class Kubernetes implements IKubernetes {
  private client: IGodaddyClient
  private initialised = false
  private initialising = false
  private logger: ILogger
  private loadCustomResources = false

  // The timeout for GET, POST, PUT, PATCH, DELETE
  private requestTimeout = 5000

  constructor(
    options: {
      loadCustomResources?: boolean
      client?: IGodaddyClient
    } = {}
  ) {
    this.logger = new Logger('client')
    this.loadCustomResources = options.loadCustomResources || false

    const request = { timeout: this.requestTimeout }
    if (options.client) {
      this.client = options.client
      this.logger.info('using injected client')
      return
    }
    if (fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount')) {
      this.logger.info('using service account')
      const kubeconfig = new KubeConfig()
      kubeconfig.loadFromCluster()
      const backend = new Request({ kubeconfig, request })
      this.client = new Client({ backend })
    } else {
      this.logger.info('using kube config')
      const kubeconfig = new KubeConfig()
      kubeconfig.loadFromDefault()
      const backend = new Request({ kubeconfig, request })
      this.client = new Client({ backend })
    }
  }

  private async init(): Promise<void> {
    if (this.initialised) {
      return
    } else if (this.initialising) {
      this.logger.debug(
        'another instance of init is running, waiting for it to complete'
      )
      let waitedFor = 0
      while (!this.initialised) {
        await this.sleep(50)
        waitedFor += 1
        if (waitedFor > 100) {
          throw new Error('waited 5000 ms for init to complete, it didnt')
        }
      }
      return
    }
    this.initialising = true
    this.logger.info('loading kubernetes spec')
    await this.client.loadSpec()
    if (this.loadCustomResources) {
      this.logger.info('spec loaded, loading crds')
      const query = await (this.client.apis['apiextensions.k8s.io']
        .v1beta1 as any).customresourcedefinition.get()
      query.body.items.forEach((crd) => {
        this.client.addCustomResourceDefinition(crd)
      })
      this.logger.info(`${query.body.items.length} crds loaded`)
    }
    this.logger.info('loading complete')
    this.initialised = true
  }

  private getApiParameters<T extends Models.IBaseResource>(
    apiVersion: T['apiVersion'],
    kind: T['kind']
  ): { api: string; version: string; kind: string } {
    const [api, version] =
      apiVersion.indexOf('/') > -1 ? apiVersion.split('/') : ['', apiVersion]

    let kindLower = kind.toLowerCase()
    if (kindLower === 'networkpolicy') {
      kindLower = 'networkpolicie'
    }
    if (kindLower === 'authorizationpolicy') {
      kindLower = 'authorizationpolicie'
    }
    return { api, version, kind: kindLower }
  }

  private async getApi<T extends Models.IBaseResource>(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace?: string,
    name?: string
  ): Promise<IGodaddyApi> {
    await this.init()
    const { api, version, kind: kindLower } = this.getApiParameters(
      apiVersion,
      kind
    )

    this.logger.debug('api handler:', api, version, kindLower, namespace, name)
    let query =
      api === '' ? this.client.api[version] : this.client.apis[api][version]
    if (namespace) {
      query = query.namespaces(namespace)
    }
    const result = await query[kindLower]
    if (!name) {
      if (typeof result === 'undefined') {
        throw new Error(`No handler found for ${version}/${api}/${kindLower}`)
      }
      return result
    }
    if (typeof result === 'undefined') {
      throw new Error(
        `No handler found for ${version}/${api}/${kindLower}/${namespace}/${name}`
      )
    }
    return result(name)
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async waitFor<T extends Models.IBaseResource>(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace: string,
    name: string,
    condition: (resource: T & Models.IExistingResource) => boolean,
    maxTime = 10000
  ): Promise<void> {
    const start = new Date()
    const isPresentAndConditionPasses = (resource) => {
      return resource ? condition(resource) : false
    }

    let resource = await this.get<T>(apiVersion, kind, namespace, name)
    /* eslint no-await-in-loop: off */
    while (!isPresentAndConditionPasses(resource)) {
      if (new Date().valueOf() - start.valueOf() > maxTime) {
        throw new Error('Timeout exceeded')
      }
      if (!resource) {
        throw new Error(
          `Failed to find a ${kind} named ${name} in ${namespace}`
        )
      }
      await this.sleep(1000)
      resource = await this.get(apiVersion, kind, namespace, name)
    }
  }

  public async waitForRollout<
    T extends Models.Core.IDeployment | Models.Core.IStatefulSet
  >(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace: string,
    name: string,
    maxTime = 10000
  ): Promise<void> {
    this.logger.debug(
      `waiting a maximum of ${maxTime}ms for rollout to complete`
    )

    const rolloutStart = new Date()
    // First wait for the top level object to have progressed
    const assertion = (resource: T) => {
      const replicasUpdated =
        resource.status?.updatedReplicas === resource.status?.replicas
      if (!replicasUpdated) {
        this.logger.debug(
          `${kind} updated replicas does not match the target replicas`
        )
        return false
      }

      if (kind === 'Deployment') {
        const hasStatusCondition = resource.status?.conditions?.find(
          (item) =>
            item.reason === 'NewReplicaSetAvailable' &&
            item.type === 'Progressing' &&
            item.status === 'True'
        )
        if (!hasStatusCondition) {
          this.logger.debug(
            'Deployment does not have expected status condition to indicate new replica set is available'
          )
          return false
        }
      }

      // Statefulset Specific Checks
      if (kind === 'StatefulSet') {
        const status = (resource.status as StatefulSetStatus) || {}
        if (status.currentRevision !== status.updateRevision) {
          this.logger.debug(
            'StatefulSet current revision does not match updateRevision'
          )
          return false
        }
      }

      // All checks pass
      return true
    }
    await this.waitFor<T>(apiVersion, kind, namespace, name, assertion, maxTime)

    const remainingMaxTime =
      maxTime - (new Date().valueOf() - rolloutStart.valueOf())

    this.logger.debug(
      `waiting a maximum of ${remainingMaxTime}ms for terminating pods to finish`
    )

    const resource = await this.get<T>(apiVersion, kind, namespace, name)
    if (!resource) {
      throw new Error(`No resource found ${namespace}/${name}`)
    }

    const labels = resource.spec.selector.matchLabels
    if (!labels) {
      throw new Error('No label selector so cant find pods')
    }

    const selector = Object.keys(labels)
      .map((key) => {
        return `${key}=${labels[key]}`
      })
      .join(',')

    const getPods = (): Promise<
      (Models.Core.IPod & Models.IExistingResource)[]
    > => {
      return this.select<Models.Core.IPod>('v1', 'Pod', namespace, selector)
    }

    const start = new Date()
    const hasTerminatingPods = async (): Promise<boolean> => {
      const resources = await getPods()
      const terminatingPods = resources.filter(
        (item) => typeof item.metadata.deletionTimestamp !== 'undefined'
      )
      if (terminatingPods.length > 0) {
        this.logger.debug(
          `waiting for ${terminatingPods.length} pods to finish terminating...`
        )
      }
      return terminatingPods.length > 0
    }

    while (await hasTerminatingPods()) {
      if (new Date().valueOf() - start.valueOf() > remainingMaxTime) {
        throw new Error('Timeout exceeded')
      }
      await this.sleep(2000)
    }

    this.logger.info(`rollout complete`, { namespace, name, kind })
  }

  public async delete<T extends Models.IBaseResource>(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace: string,
    name: string
  ): Promise<void> {
    try {
      const api = await this.getApi<T>(apiVersion, kind, namespace, name)
      await api.delete()
    } catch (ex) {
      if (ex.code !== 200) {
        this.logger.error('Error deleting item from kubernetes', ex)
        throw ex
      }
    }
  }

  public async get<T extends Models.IBaseResource>(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace: string,
    name: string
  ): Promise<(T & Models.IExistingResource) | null> {
    try {
      const api = await this.getApi<T>(apiVersion, kind, namespace, name)
      const result = await api.get()
      return result.body
    } catch (ex) {
      if (ex.code !== 404) {
        this.logger.error('Error getting item from kubernetes', ex)
        throw new Error(ex)
      }
      return null
    }
  }

  public async select<T extends Models.IBaseResource>(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace?: string,
    labelSelector?: string
  ): Promise<(T & Models.IExistingResource)[]> {
    const api = await this.getApi<T>(apiVersion, kind, namespace)
    const result = labelSelector
      ? await api.get({
          qs: {
            labelSelector
          }
        })
      : await api.get()

    if (result.statusCode !== 200) {
      throw new Error(
        `Non-200 status code returned from Kubernetes API (${result.statusCode})`
      )
    }
    return result.body.items
  }

  public async create<T extends Models.IBaseResource>(
    manifest: T & Models.INewResource
  ): Promise<void> {
    const kindHandler = await this.getApi<T>(
      manifest.apiVersion,
      manifest.kind,
      manifest.metadata.namespace
    )
    return kindHandler.post({ body: manifest })
  }

  public async patch<T extends Models.IBaseResource>(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace: string,
    name: string,
    patchType: PatchType,
    patch: any
  ): Promise<void> {
    const patchTypeMappings = {
      0: 'application/merge-patch+json',
      1: 'application/json-patch+json'
    }
    const contentType = patchTypeMappings[patchType]

    if (!contentType) {
      throw new Error(
        `Unable to match patch ${PatchType[patchType]} to a content type`
      )
    }

    const patchMutated: any = {
      headers: {
        accept: 'application/json',
        'content-type': contentType
      },
      body: patch
    }

    // If this is a JSON patch to add a status condition, then mutate the url
    if (
      patchType === PatchType.JsonPatch &&
      patch[0].op === 'add' &&
      patch[0].path === '/status/conditions/-'
    ) {
      let plural = kind.toLowerCase()
      if (plural.slice(-1) !== 's') {
        plural += 's'
      }

      const date = new Date().toISOString().split('.')[0]
      patch[0].value.lastTransitionTime = `${date}.000000Z`

      const pathname = `/api/v1/namespaces/${namespace}/${plural}/${name}/status`
      patchMutated.pathname = pathname
    }

    const api = await this.getApi<T>(apiVersion, kind, namespace, name)
    const result = await api.patch(patchMutated)

    if (result.statusCode !== 200) {
      throw new Error(
        `Non-200 status code returned from Kubernetes API (${result.statusCode})`
      )
    }
  }

  public async start(): Promise<void> {
    await this.init()
  }

  public async stop(): Promise<void> {
    return Promise.resolve()
  }

  public async rollout<
    T extends
      | Models.Core.IDeployment
      | Models.Core.IStatefulSet
      | Models.Core.IDaemonSet
  >(
    apiVersion: T['apiVersion'],
    kind: T['kind'],
    namespace: string,
    name: string
  ): Promise<void> {
    const target = await this.get<T>(apiVersion, kind, namespace, name)
    if (!target) {
      throw new Error(`Unable to GET ${namespace}/${name}`)
    }
    const currentGeneration = target.metadata.generation
    const patch = {
      spec: {
        template: {
          metadata: {
            annotations: {
              'kubectl.kubernetes.io/restartedAt': `${new Date().toISOString()}`
            }
          }
        }
      }
    }
    await this.patch(
      apiVersion,
      kind,
      namespace,
      name,
      PatchType.MergePatch,
      patch
    )
    let targetGeneration: number | undefined
    const assertion = (resource: T) => {
      targetGeneration = resource.metadata.generation
      return targetGeneration !== currentGeneration
    }
    await this.waitFor<T>(apiVersion, kind, namespace, name, assertion, 10000)
    this.logger.info(`rollout triggered`, {
      namespace,
      name,
      currentGeneration,
      targetGeneration
    })
  }
}
