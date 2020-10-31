import WebServer, { IWebServer } from 'lib/web-server'
import got from 'got'
import * as should from 'should'

class Sut extends WebServer {
  constructor() {
    super()
    this.app.get('/', (req, res) => {
      res.sendStatus(200)
    })
  }
}

describe('Web Server', () => {
  let sut: IWebServer
  before(() => {
    sut = new Sut()
  })
  after(async () => {
    return sut.stop()
  })
  it('should start and stop', async () => {
    await sut.start()
    const result = await got('http://127.0.0.1:8080')
    should(result.statusCode).eql(200)
  })
})
