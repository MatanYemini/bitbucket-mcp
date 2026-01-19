# Implementation Plan: Bitbucket Data Center Support

## Overview

This implementation plan adds Bitbucket Data Center (version 7.5.0+) support to the existing MCP server using an adapter pattern. The approach maintains backward compatibility with Bitbucket Cloud while enabling seamless support for self-hosted Data Center instances. Implementation will be incremental, with each task building on previous work and including validation through tests.

## Tasks

- [x] 1. Create API detection and type system
  - [x] 1.1 Create BitbucketApiType enum and ApiDetectionResult interface
    - Define enum with CLOUD and DATA_CENTER values
    - Define interface for detection results
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 1.2 Implement ApiDetector class with URL detection logic
    - Implement detect() method with Cloud pattern matching
    - Add Data Center detection as fallback
    - Add URL normalization logic
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 1.3 Write property tests for API detection
    - **Property 1: Cloud URL Detection**
    - **Property 2: Data Center URL Detection**
    - **Validates: Requirements 1.1, 1.2, 1.3**
  
  - [x] 1.4 Write unit tests for API detection edge cases
    - Test trailing slashes, ports, and path variations
    - Test specific known URLs
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Create adapter interface and base types
  - [x] 2.1 Define BitbucketAdapter interface
    - Define method signatures for all supported operations
    - Include repository, pull request, and comment operations
    - Add pagination and error handling types
    - _Requirements: 3.3_
  
  - [x] 2.2 Define normalized data models
    - Create Repository, PullRequest, Comment interfaces
    - Create pagination result types
    - Ensure compatibility with existing Cloud types
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 2.3 Create field mapping documentation
    - Document Cloud to DC field mappings in code comments
    - Create mapping tables as constants
    - _Requirements: 4.2, 4.3, 4.4_

- [ ] 3. Implement CloudAdapter
  - [ ] 3.1 Create CloudAdapter class implementing BitbucketAdapter
    - Wrap existing Cloud implementation
    - Ensure all interface methods are implemented
    - Maintain existing behavior
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ] 3.2 Write property tests for Cloud adapter backward compatibility
    - **Property 19: Cloud Backward Compatibility**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement DataCenterAdapter core functionality
  - [ ] 5.1 Create DataCenterAdapter class skeleton
    - Implement constructor with AxiosInstance and config
    - Add helper methods (parseRepoSlug, buildPaginationParams)
    - _Requirements: 3.2_
  
  - [ ] 5.2 Implement repository operations
    - Implement listRepositories with DC endpoint
    - Implement getRepository with project/repo extraction
    - Add repository response normalization
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 5.3 Write property tests for repository operations
    - **Property 11: Repository Field Mapping**
    - **Property 14: Repository Endpoint Construction**
    - **Validates: Requirements 4.2, 5.2, 5.3**
  
  - [ ] 5.4 Write unit tests for repository edge cases
    - Test 404 handling
    - Test invalid repo_slug format
    - _Requirements: 5.4_

- [ ] 6. Implement DataCenterAdapter pull request operations
  - [ ] 6.1 Implement pull request listing and retrieval
    - Implement getPullRequests with DC endpoint
    - Implement getPullRequest
    - Add state mapping logic
    - Add PR response normalization
    - _Requirements: 6.1, 6.3, 6.4_
  
  - [ ] 6.2 Implement pull request creation and updates
    - Implement createPullRequest with payload transformation
    - Implement updatePullRequest
    - Implement approvePullRequest, mergePullRequest
    - _Requirements: 6.2_
  
  - [ ] 6.3 Write property tests for pull request operations
    - **Property 12: Pull Request Field Mapping**
    - **Property 15: Pull Request Endpoint Construction**
    - **Property 16: Pull Request State Mapping**
    - **Validates: Requirements 4.3, 6.1, 6.3, 6.4**
  
  - [ ] 6.4 Write unit tests for pull request edge cases
    - Test invalid state values
    - Test missing required fields
    - _Requirements: 6.2, 6.3_

- [ ] 7. Implement DataCenterAdapter comment operations
  - [ ] 7.1 Implement comment operations
    - Implement addPullRequestComment with DC endpoint
    - Implement getPullRequestComments
    - Add inline comment transformation
    - Add comment response normalization
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 7.2 Write property tests for comment operations
    - **Property 17: Comment Endpoint Construction**
    - **Property 18: Inline Comment Transformation**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [ ] 8. Implement pagination for Data Center
  - [ ] 8.1 Add DC pagination logic to DataCenterAdapter
    - Implement buildPaginationParams (start/limit)
    - Add pagination response normalization
    - Implement automatic pagination for all=true
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ] 8.2 Write property tests for pagination
    - **Property 13: Pagination Normalization**
    - **Property 22: Pagination Navigation**
    - **Property 23: Automatic Pagination**
    - **Property 24: Pagination Count**
    - **Validates: Requirements 4.4, 10.1, 10.2, 10.3, 10.4**

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement authentication configuration
  - [ ] 10.1 Update configuration validation
    - Add support for BITBUCKET_PERSONAL_ACCESS_TOKEN
    - Validate credentials based on API type
    - Add descriptive error messages
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.1, 9.2_
  
  - [ ] 10.2 Update Axios client configuration
    - Set Bearer token for DC when PAT is provided
    - Maintain Basic auth support
    - Add configuration logging (without sensitive data)
    - _Requirements: 2.1, 2.2, 2.3, 9.4_
  
  - [ ] 10.3 Write property tests for authentication
    - **Property 4: Bearer Authentication with Token**
    - **Property 5: Basic Authentication with Credentials**
    - **Property 6: Missing Credentials Error**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  
  - [ ] 10.4 Write unit tests for configuration validation
    - Test missing URL error
    - Test missing credentials error
    - Test invalid URL format error
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 11. Integrate adapters into BitbucketServer
  - [ ] 11.1 Update BitbucketServer constructor
    - Add API detection on initialization
    - Instantiate appropriate adapter based on API type
    - Log detected API type and configuration
    - _Requirements: 1.4, 3.3_
  
  - [ ] 11.2 Update tool handlers to use adapter
    - Delegate all tool operations to adapter
    - Remove direct API calls from BitbucketServer
    - Maintain existing tool signatures
    - _Requirements: 3.3_
  
  - [ ] 11.3 Write property tests for adapter routing
    - **Property 9: Adapter Routing**
    - **Validates: Requirements 3.3**

- [ ] 12. Implement error handling
  - [ ] 12.1 Add Data Center specific error handling
    - Handle 401 with PAT guidance
    - Handle 404, 403 with appropriate messages
    - Handle network errors with logging
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [ ] 12.2 Add unsupported operation handling
    - Identify operations not supported by DC
    - Return clear error messages for unsupported ops
    - Log unsupported operation attempts
    - _Requirements: 3.4, 12.3_
  
  - [ ] 12.3 Write unit tests for error handling
    - Test 401 error message for DC
    - Test 404 error handling
    - Test 403 error handling
    - Test unsupported operation error
    - _Requirements: 11.1, 11.2, 11.3, 3.4, 12.3_
  
  - [ ] 12.4 Write property tests for error handling
    - **Property 25: Network Error Handling**
    - **Property 26: Unsupported Tool Error**
    - **Validates: Requirements 11.4, 12.3**

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Update documentation and configuration
  - [ ] 14.1 Update README.md
    - Add Data Center configuration section
    - Document BITBUCKET_PERSONAL_ACCESS_TOKEN
    - Add feature comparison table (Cloud vs DC)
    - Add troubleshooting section for DC
    - _Requirements: 12.4_
  
  - [ ] 14.2 Update environment variable documentation
    - Document all DC-related environment variables
    - Provide configuration examples
    - _Requirements: 2.1, 2.2_

- [ ] 15. Final integration testing
  - [ ] 15.1 Write integration tests
    - Test complete flow from tool invocation to response
    - Test both Cloud and DC configurations
    - Test error scenarios end-to-end
    - _Requirements: All_
  
  - [ ] 15.2 Manual testing checklist
    - Test with real DC instance (if available)
    - Verify all supported tools work
    - Verify error messages are clear
    - _Requirements: All_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The adapter pattern allows easy extension to future Bitbucket versions
