type LogLevel = 'info' | 'warn' | 'error'

interface LogContext {
  action?: string
  userId?: string
  companyId?: string
  shipmentId?: string
  invoiceId?: string
  [key: string]: string | number | boolean | undefined
}

function log(level: LogLevel, message: string, context: LogContext = {}) {
  if (process.env.NODE_ENV === 'test') return

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  if (level === 'error') {
    console.error(JSON.stringify(entry))
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
}
