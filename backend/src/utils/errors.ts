export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}
export const badRequest = (message: string): HttpError => new HttpError(400, message);
export const forbidden = (message: string): HttpError => new HttpError(403, message);
export const notFound = (what: string): HttpError => new HttpError(404, `${what} not found`);
export const conflict = (message: string): HttpError => new HttpError(409, message);
export const tooManyRequests = (message: string): HttpError => new HttpError(429, message);
