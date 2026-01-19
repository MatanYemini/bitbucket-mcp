export enum BitbucketApiType {
  CLOUD = 'cloud',
  DATA_CENTER = 'datacenter'
}

export interface ApiDetectionResult {
  type: BitbucketApiType;
  baseUrl: string;
  normalizedUrl: string;
}

export class ApiDetector {
  static detect(url: string): ApiDetectionResult {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (host === 'api.bitbucket.org' || host === 'www.api.bitbucket.org') {
        return {
          type: BitbucketApiType.CLOUD,
          baseUrl: url,
          normalizedUrl: 'https://api.bitbucket.org/2.0'
        };
      }

      if (host === 'bitbucket.org' || host === 'www.bitbucket.org') {
        return {
          type: BitbucketApiType.CLOUD,
          baseUrl: url,
          normalizedUrl: 'https://api.bitbucket.org/2.0'
        };
      }

      return {
        type: BitbucketApiType.DATA_CENTER,
        baseUrl: url,
        normalizedUrl: url.replace(/\/+$/, '')
      };
    } catch (error) {
      throw new Error(`Invalid URL format: ${url}`);
    }
  }
}
