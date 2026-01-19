import { ApiDetector, BitbucketApiType } from '../src/api-detector';

describe('ApiDetector', () => {
  describe('Cloud URL Detection', () => {
    it('should detect api.bitbucket.org as Cloud', () => {
      const result = ApiDetector.detect('https://api.bitbucket.org');
      expect(result.type).toBe(BitbucketApiType.CLOUD);
      expect(result.normalizedUrl).toBe('https://api.bitbucket.org/2.0');
    });

    it('should detect api.bitbucket.org/2.0 as Cloud', () => {
      const result = ApiDetector.detect('https://api.bitbucket.org/2.0');
      expect(result.type).toBe(BitbucketApiType.CLOUD);
      expect(result.normalizedUrl).toBe('https://api.bitbucket.org/2.0');
    });

    it('should detect bitbucket.org as Cloud', () => {
      const result = ApiDetector.detect('https://bitbucket.org');
      expect(result.type).toBe(BitbucketApiType.CLOUD);
      expect(result.normalizedUrl).toBe('https://api.bitbucket.org/2.0');
    });

    it('should detect bitbucket.org/workspace as Cloud', () => {
      const result = ApiDetector.detect('https://bitbucket.org/myworkspace');
      expect(result.type).toBe(BitbucketApiType.CLOUD);
      expect(result.normalizedUrl).toBe('https://api.bitbucket.org/2.0');
    });

    it('should handle trailing slashes in Cloud URLs', () => {
      const result = ApiDetector.detect('https://api.bitbucket.org/');
      expect(result.type).toBe(BitbucketApiType.CLOUD);
      expect(result.normalizedUrl).toBe('https://api.bitbucket.org/2.0');
    });

    it('should handle www subdomain for Cloud', () => {
      const result = ApiDetector.detect('https://www.bitbucket.org');
      expect(result.type).toBe(BitbucketApiType.CLOUD);
      expect(result.normalizedUrl).toBe('https://api.bitbucket.org/2.0');
    });
  });

  describe('Data Center URL Detection', () => {
    it('should detect custom domain as Data Center', () => {
      const result = ApiDetector.detect('https://bitbucket.company.com');
      expect(result.type).toBe(BitbucketApiType.DATA_CENTER);
      expect(result.normalizedUrl).toBe('https://bitbucket.company.com');
    });

    it('should detect stash domain as Data Center', () => {
      const result = ApiDetector.detect('https://stash.internal.net');
      expect(result.type).toBe(BitbucketApiType.DATA_CENTER);
      expect(result.normalizedUrl).toBe('https://stash.internal.net');
    });

    it('should detect IP address as Data Center', () => {
      const result = ApiDetector.detect('https://192.168.1.100:7990');
      expect(result.type).toBe(BitbucketApiType.DATA_CENTER);
      expect(result.normalizedUrl).toBe('https://192.168.1.100:7990');
    });

    it('should handle custom port for Data Center', () => {
      const result = ApiDetector.detect('https://bitbucket.company.com:8080');
      expect(result.type).toBe(BitbucketApiType.DATA_CENTER);
      expect(result.normalizedUrl).toBe('https://bitbucket.company.com:8080');
    });

    it('should handle context path for Data Center', () => {
      const result = ApiDetector.detect('https://git.example.org/bitbucket');
      expect(result.type).toBe(BitbucketApiType.DATA_CENTER);
      expect(result.normalizedUrl).toBe('https://git.example.org/bitbucket');
    });

    it('should remove trailing slashes from Data Center URLs', () => {
      const result = ApiDetector.detect('https://bitbucket.company.com/');
      expect(result.type).toBe(BitbucketApiType.DATA_CENTER);
      expect(result.normalizedUrl).toBe('https://bitbucket.company.com');
    });

    it('should remove multiple trailing slashes from Data Center URLs', () => {
      const result = ApiDetector.detect('https://bitbucket.company.com///');
      expect(result.type).toBe(BitbucketApiType.DATA_CENTER);
      expect(result.normalizedUrl).toBe('https://bitbucket.company.com');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid URL format', () => {
      expect(() => ApiDetector.detect('not-a-url')).toThrow('Invalid URL format');
    });

    it('should throw error for empty string', () => {
      expect(() => ApiDetector.detect('')).toThrow('Invalid URL format');
    });

    it('should throw error for malformed URL', () => {
      expect(() => ApiDetector.detect('http://')).toThrow('Invalid URL format');
    });
  });

  describe('Case Sensitivity', () => {
    it('should handle uppercase in Cloud domain', () => {
      const result = ApiDetector.detect('https://API.BITBUCKET.ORG');
      expect(result.type).toBe(BitbucketApiType.CLOUD);
    });

    it('should handle mixed case in Cloud domain', () => {
      const result = ApiDetector.detect('https://Bitbucket.Org');
      expect(result.type).toBe(BitbucketApiType.CLOUD);
    });

    it('should handle uppercase in Data Center domain', () => {
      const result = ApiDetector.detect('https://BITBUCKET.COMPANY.COM');
      expect(result.type).toBe(BitbucketApiType.DATA_CENTER);
    });
  });
});
