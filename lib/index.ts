/* eslint-disable @typescript-eslint/no-extra-semi */
import * as path from 'path'
import * as tsConfigPaths from 'tsconfig-paths/lib'
const baseUrl = path.join(__dirname, '../')

tsConfigPaths.register({
  baseUrl,
  paths: {}
})

import Operator from 'lib/apps/operator'
import Kubernetes from 'lib/kubernetes/client'
import SimpleServer from 'lib/apps/simple-server'
import { IWebServer } from 'lib/web-server'
import { LoadTester } from 'lib/loadTester'
import Config from './config'

const startApp = process.argv[2]
if (!startApp) {
  throw new Error('Please specify which app to start')
}

const apps: { [key: string]: () => Promise<IWebServer> } = {
  operator: async (): Promise<IWebServer> => {
    const kubernetes = new Kubernetes()
    const config = new Config(kubernetes)
    await kubernetes.start()
    await config.start()
    const loadTester = new LoadTester(config)
    const service = new Operator(kubernetes, loadTester)
    return service
  },
  simpleService: async (): Promise<IWebServer> => {
    const service = new SimpleServer()
    return service
  }
}

const app = apps[startApp]
if (!app) {
  throw new Error(`Unknown app: ${startApp}`)
}

;(async () => {
  const service = await app()
  async function shutdown() {
    setTimeout(() => {
      process.exit(1)
    }, 300000)
    await service.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await service.start()
})()

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection!', error)
  process.exit(1)
})
