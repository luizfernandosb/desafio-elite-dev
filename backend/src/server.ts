import { app } from './app'
import { env } from './config/env'
import { logger } from './lib/logger'

app.listen(env.PORT, () => {
  logger.info({ msg: 'server started', port: env.PORT, env: env.NODE_ENV })
})
