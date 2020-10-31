import { IConfig } from 'lib/config'
import { IKubernetes } from 'lib/kubernetes/client'
import Logger, { ILogger } from 'lib/logger'

export abstract class BaseTask {
  protected kubernetes: IKubernetes
  protected logger: ILogger
  protected running = true
  protected config: IConfig

  constructor(kubernetes: IKubernetes, config: IConfig) {
    this.logger = new Logger(this.constructor.name)
    this.kubernetes = kubernetes
    this.config = config
  }

  protected randomIntFromInterval(min: number, max: number): number {
    const part1 = Math.random() * (max - min + 1)
    return Math.floor(part1 + min)
  }

  protected nextInterval(): number {
    return Math.floor(
      Math.random() * 1000 * 60 * this.randomIntFromInterval(5, 10)
    )
  }

  protected abstract run(): Promise<void>

  public start(): void {
    const schedule = this.nextInterval()
    this.logger.info(`next run in ${schedule}ms`)

    const runTask = async () => {
      try {
        await this.run()
      } catch (ex) {
        this.logger.error('failed to run', ex)
      }

      const nextSchedule = this.nextInterval()
      this.logger.info(`next run in ${nextSchedule}ms`)
      if (this.running) {
        setTimeout(runTask, nextSchedule)
      }
    }

    setTimeout(runTask, schedule)
  }

  public stop(): void {
    this.running = false
  }
}
