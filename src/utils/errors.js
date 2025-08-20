export class AppError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const errorMiddleware = (err, req, res, next) => {
  const status = err.status || 500;
  const body = {
    error: {
      message: err.message || 'Internal Server Error',
    }
  };
  if (err.details) body.error.details = err.details;
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    body.error.stack = err.stack;
  }
  res.status(status).json(body);
};