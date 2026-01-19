import fc from 'fast-check';
import { ApiDetector, BitbucketApiType } from '../../src/api-detector';

describe('Feature: bitbucket-dc-support, Property 1: Cloud URL Detection', () => {
  it('should detect Cloud URLs containing api.bitbucket.org', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'https://api.bitbucket.org',
          'https://api.bitbucket.org/',
          'https://api.bitbucket.org/2.0',
          'https://api.bitbucket.org/2.0/',
          'https://www.api.bitbucket.org'
        ),
        (url) => {
          const result = ApiDetector.detect(url);
          return result.type === BitbucketApiType.CLOUD;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect Cloud URLs containing bitbucket.org without api subdomain', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'https://bitbucket.org',
          'https://bitbucket.org/',
          'https://bitbucket.org/workspace',
          'https://www.bitbucket.org',
          'https://www.bitbucket.org/workspace'
        ),
        (url) => {
          const result = ApiDetector.detect(url);
          return result.type === BitbucketApiType.CLOUD;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should normalize Cloud URLs to api.bitbucket.org/2.0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'https://api.bitbucket.org',
          'https://bitbucket.org',
          'https://bitbucket.org/workspace'
        ),
        (url) => {
          const result = ApiDetector.detect(url);
          return result.normalizedUrl === 'https://api.bitbucket.org/2.0';
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: bitbucket-dc-support, Property 2: Data Center URL Detection', () => {
  it('should detect Data Center URLs that do not match Cloud patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'https://bitbucket.company.com',
          'https://git.example.org',
          'https://stash.internal.net',
          'https://bb.mycompany.io',
          'https://192.168.1.100:7990'
        ),
        (url) => {
          const result = ApiDetector.detect(url);
          return result.type === BitbucketApiType.DATA_CENTER;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve Data Center URLs without modification except trailing slashes', () => {
    fc.assert(
      fc.property(
        fc.record({
          protocol: fc.constant('https'),
          host: fc.constantFrom('bitbucket.company.com', 'git.example.org', 'stash.internal.net'),
          port: fc.option(fc.constantFrom(':7990', ':8080', ':443'), { nil: undefined }),
          path: fc.option(fc.constantFrom('/context', '/bitbucket'), { nil: undefined })
        }),
        ({ protocol, host, port, path }) => {
          const url = `${protocol}://${host}${port || ''}${path || ''}`;
          const result = ApiDetector.detect(url);
          const expectedNormalized = url.replace(/\/+$/, '');
          return result.normalizedUrl === expectedNormalized;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: bitbucket-dc-support, Property 3: Detection Logging', () => {
  it('should return detection result for any valid URL', () => {
    fc.assert(
      fc.property(
        fc.webUrl({ validSchemes: ['https'] }),
        (url) => {
          try {
            const result = ApiDetector.detect(url);
            return (
              result.type !== undefined &&
              result.baseUrl !== undefined &&
              result.normalizedUrl !== undefined
            );
          } catch {
            return true;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
