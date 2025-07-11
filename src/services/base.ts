import axios, { AxiosInstance } from "axios";
import https from "https";
import { BitbucketConfig } from "../types/index.js";
import { logger } from "../utils/logger.js";

export abstract class BaseService {
    protected readonly api: AxiosInstance;
    protected readonly config: BitbucketConfig;

    constructor(config: BitbucketConfig) {
        this.config = config;
        this.api = this.createApiInstance();
    }

    private createApiInstance(): AxiosInstance {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": "bitbucket-mcp/4.1.0",
        };

        if (this.config.token) {
            headers["Authorization"] = `Bearer ${this.config.token}`;
        }

        const api = axios.create({
            baseURL: this.config.baseUrl,
            headers,
            auth:
                this.config.username &&
                this.config.password &&
                !this.config.token
                    ? {
                          username: this.config.username,
                          password: this.config.password,
                      }
                    : undefined,
            timeout: 30000,
            // Ensure all requests are HTTPS in production
            httpsAgent:
                process.env.NODE_ENV === "production"
                    ? new https.Agent({
                          rejectUnauthorized: true,
                      })
                    : undefined,
        });

        // Security-focused request interceptor
        api.interceptors.request.use(
            (config) => {
                logger.info("API Request", {
                    method: config.method?.toUpperCase(),
                    url: config.url,
                    params: config.params,
                });
                return config;
            },
            (error) => {
                logger.error("Request interceptor error", { error });
                return Promise.reject(error);
            }
        );

        // Security-focused response interceptor
        api.interceptors.response.use(
            (response) => {
                logger.info("API Response", {
                    status: response.status,
                    url: response.config.url,
                });
                return response;
            },
            (error) => {
                const sanitizedError = {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    url: error.config?.url,
                    method: error.config?.method,
                };
                logger.error("API Error", sanitizedError);
                return Promise.reject(error);
            }
        );

        return api;
    }
}
