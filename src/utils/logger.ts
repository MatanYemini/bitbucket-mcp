import winston from "winston";

/**
 * Secure logger configuration that prevents sensitive data leakage
 */
export const logger = winston.createLogger({
    level: process.env.NODE_ENV === "production" ? "error" : "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.printf((info) => {
            // Additional sanitization to prevent credential leakage
            const sanitized = JSON.stringify(info, (key, value) => {
                // Filter out sensitive keys
                if (
                    typeof key === "string" &&
                    (key.toLowerCase().includes("password") ||
                        key.toLowerCase().includes("token") ||
                        key.toLowerCase().includes("secret") ||
                        key.toLowerCase().includes("auth") ||
                        key.toLowerCase().includes("credential"))
                ) {
                    return "[REDACTED]";
                }
                return value;
            });
            return sanitized;
        })
    ),
    transports: [
        new winston.transports.File({
            filename: "bitbucket-errors.log",
            level: "error",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: "bitbucket.log",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    // Prevent unhandled errors from crashing the application
    exitOnError: false,
});

/**
 * Sanitize error objects to prevent credential leakage in logs
 */
export function sanitizeError(error: any): any {
    if (!error) return error;

    // If it's an Axios error, be extra careful with response data
    if (error.response) {
        return {
            message: error.message,
            status: error.response.status,
            statusText: error.response.statusText,
            // Don't include response data as it might contain sensitive info
        };
    }

    // For regular errors, just include the message
    if (error instanceof Error) {
        return {
            message: error.message,
            name: error.name,
            stack:
                process.env.NODE_ENV === "production" ? undefined : error.stack,
        };
    }

    return { message: String(error) };
}
