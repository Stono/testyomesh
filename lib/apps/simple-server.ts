import { Request, Response } from 'express'
import WebServer from 'lib/web-server'
import got from 'got'

export default class SimpleServer extends WebServer {
  constructor() {
    super()
    this.app.all('/instant', this.handleInstantRequest.bind(this))
    this.app.all('/delayed', this.handleDelayedRequest.bind(this))
    this.app.all('/downstream', this.handleDownstreamRequest.bind(this))
  }

  private handleInstantRequest(req: Request, res: Response): void {
    const id = req.headers['x-request-id']
    const code = req.query.code ? parseInt(req.query.code as string, 10) : 200
    this.logger.debug(`${id} sending instant response`)
    this.sendMessage(`instant response`, res, req, code)
  }

  private handleDelayedRequest(req: Request, res: Response): void {
    const id = req.headers['x-request-id']
    const code = req.query.code ? parseInt(req.query.code as string, 10) : 200
    const returnAt = req.query.delay
      ? parseInt(req.query.delay as string, 10)
      : Math.floor(Math.random() * 3000) + 1

    this.logger.debug(`${id} sending a delayed response in`, returnAt, 'ms')
    this.sendDelayedMessage('delayed response', returnAt, res, req, code)
  }

  public async handleDownstreamRequest(
    req: Request,
    res: Response
  ): Promise<void> {
    const id = req.headers['x-request-id']
    if (!req.query.servers) {
      res.sendStatus(400)
      return
    }
    const servers: string[] = req.query.servers
      ? (req.query.servers as string).split(',')
      : []

    this.logger.debug(`${id} handling downstream request`, {
      servers
    })
    const headers = {}
    Object.keys(WebServer.ACCEPTABLE_HEADERS).forEach((key) => {
      if (req.headers[key]) {
        headers[key] = req.headers[key]
      }
    })

    const promises = servers.map(async (server) => {
      const result = await got<any>(`http://${server}`, {
        headers,
        method: req.method as any,
        responseType: 'json'
      })
      return result.body
    })

    Promise.all(promises)
      .then((results) => {
        this.logger.debug(`${id} downstream requests complete`)
        this.sendMessage(results, res, req)
      })
      .catch((rejection) => {
        this.logger.warn(`${id} downstream requests failed`, rejection)
        res.sendStatus(500)
      })
  }

  private sendMessage(
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    message: any,
    res: Response,
    req: Request,
    code = 200,
    delayWas = 0
  ): void {
    const data = {
      delayWas,
      hostname: WebServer.HOSTNAME,
      message,
      timestamp: new Date().getTime()
    }
    Object.keys(WebServer.ACCEPTABLE_HEADERS).forEach((key) => {
      if (req.headers[key]) {
        data[key] = req.headers[key]
      }
    })
    res.status(code).json(data)
  }

  private sendDelayedMessage(
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    message: any,
    delay: number,
    res: Response,
    req: Request,
    code = 200
  ): void {
    setTimeout(() => {
      this.sendMessage(message, res, req, code, delay)
    }, delay)
  }
}
