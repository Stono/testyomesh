import * as express from 'express'
import * as stoppable from 'stoppable'
import Logger, { ILogger } from 'lib/logger'
import * as os from 'os'

export interface IWebServer {
  start(): void
  stop(): void
}

export interface IRoutes {
  /** Apply the routes to the express server */
  applyRoutes(app: express.Application, controller): void
}

export default class WebServer implements IWebServer {
  private http
  protected readonly logger: ILogger
  protected readonly app: express.Application
  protected static readonly HOSTNAME = os.hostname()
  protected static ACCEPTABLE_HEADERS = [
    'x-request-id',
    'x-b3-traceid',
    'x-b3-spanid',
    'x-b3-parentspanid',
    'x-b3-sampled',
    'x-b3-flags',
    'x-ot-span-context'
  ]

  constructor() {
    this.logger = new Logger('web-server')
    this.app = express()
  }

  /* eslint max-statements: off */
  public async start(): Promise<void> {
    this.logger.info(`starting web server on port 8080`)

    this.app.set('etag', false)
    this.app.disable('etag')
    this.app.disable('x-powered-by')

    return new Promise((resolve) => {
      const server = this.app.listen(8080, () => {
        this.logger.info(`web server started`)
      })
      this.http = stoppable(server, 10000)
      server.keepAliveTimeout = 1000 * (60 * 6)
      server.on('connection', (socket) => {
        // Disable Nagles
        socket.setNoDelay(true)
        socket.setTimeout(600 * 60 * 1000)
      })
      resolve()
    })
  }

  public async stop(): Promise<void> {
    const logger = this.logger

    return new Promise((resolve) => {
      logger.info('stopping web server')
      this.http.stop(() => {
        logger.info('web server stopped')
        resolve()
      })
    })
  }
}
