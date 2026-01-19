# Requirements Document

## Introduction

This document specifies the requirements for adding Bitbucket Data Center (version 7.5.0+) support to the existing Bitbucket MCP server. The server currently supports Bitbucket Cloud API (api.bitbucket.org/2.0) and needs to be extended to support self-hosted Bitbucket Data Center instances while maintaining backward compatibility with Cloud.

## Glossary

- **Bitbucket_Cloud**: The SaaS version of Bitbucket hosted at bitbucket.org using API version 2.0
- **Bitbucket_Data_Center**: The self-hosted enterprise version of Bitbucket using REST API version 1.0
- **API_Client**: The HTTP client component responsible for making requests to Bitbucket APIs
- **API_Detector**: The component that determines whether a URL points to Cloud or Data Center
- **Personal_Access_Token**: A token-based authentication credential for Bitbucket Data Center (PAT)
- **Response_Mapper**: The component that transforms API responses between Cloud and Data Center formats
- **MCP_Tool**: A Model Context Protocol tool that exposes Bitbucket functionality to AI assistants

## Requirements

### Requirement 1: API Type Detection

**User Story:** As a user, I want the server to automatically detect whether my Bitbucket URL is Cloud or Data Center, so that I don't need to manually configure the API type.

#### Acceptance Criteria

1. WHEN a user provides a URL containing "api.bitbucket.org", THE API_Detector SHALL identify it as Bitbucket_Cloud
2. WHEN a user provides a URL containing "bitbucket.org" (without "api" subdomain), THE API_Detector SHALL identify it as Bitbucket_Cloud
3. WHEN a user provides a URL that does not match Cloud patterns, THE API_Detector SHALL identify it as Bitbucket_Data_Center
4. WHEN the API type is detected, THE System SHALL log the detection result for debugging purposes

### Requirement 2: Data Center Authentication

**User Story:** As a Data Center user, I want to authenticate using Personal Access Tokens, so that I can securely access my self-hosted Bitbucket instance.

#### Acceptance Criteria

1. WHEN a Personal_Access_Token is provided via BITBUCKET_TOKEN environment variable, THE API_Client SHALL use HTTP Bearer authentication
2. WHEN a Personal_Access_Token is provided via BITBUCKET_PERSONAL_ACCESS_TOKEN environment variable, THE API_Client SHALL use HTTP Bearer authentication
3. WHEN username and password are provided for Data Center, THE API_Client SHALL use HTTP Basic authentication
4. WHEN no valid credentials are provided, THE System SHALL throw a configuration error with a descriptive message

### Requirement 3: API Endpoint Mapping

**User Story:** As a developer, I want the system to map MCP tools to the correct API endpoints for both Cloud and Data Center, so that all tools work correctly regardless of the Bitbucket type.

#### Acceptance Criteria

1. WHEN the API type is Bitbucket_Cloud, THE System SHALL use API paths starting with "/repositories/"
2. WHEN the API type is Bitbucket_Data_Center, THE System SHALL use API paths starting with "/rest/api/1.0/"
3. WHEN a tool is invoked, THE System SHALL construct the correct endpoint path based on the detected API type
4. WHEN an endpoint is not supported by Data Center, THE System SHALL return a clear error message indicating the limitation

### Requirement 4: Response Format Normalization

**User Story:** As a developer, I want API responses from both Cloud and Data Center to be normalized to a common format, so that MCP tools can process them uniformly.

#### Acceptance Criteria

1. WHEN a Data Center API response is received, THE Response_Mapper SHALL transform it to match the Cloud response structure
2. WHEN repository data is fetched from Data Center, THE Response_Mapper SHALL map Data Center fields to Cloud field names
3. WHEN pull request data is fetched from Data Center, THE Response_Mapper SHALL map Data Center fields to Cloud field names
4. WHEN pagination data is received from Data Center, THE Response_Mapper SHALL normalize it to match Cloud pagination format

### Requirement 5: Repository Operations Support

**User Story:** As a user, I want to list and retrieve repository information from Data Center, so that I can work with my self-hosted repositories.

#### Acceptance Criteria

1. WHEN listRepositories is called for Data Center, THE System SHALL fetch repositories from "/rest/api/1.0/repos"
2. WHEN getRepository is called for Data Center, THE System SHALL fetch repository details from "/rest/api/1.0/projects/{project}/repos/{repo}"
3. WHEN repository data is returned, THE System SHALL include all essential fields (name, project, links, etc.)
4. WHEN a repository does not exist, THE System SHALL return an appropriate error message

### Requirement 6: Pull Request Operations Support

**User Story:** As a user, I want to manage pull requests in Data Center, so that I can review and merge code changes.

#### Acceptance Criteria

1. WHEN getPullRequests is called for Data Center, THE System SHALL fetch pull requests from "/rest/api/1.0/projects/{project}/repos/{repo}/pull-requests"
2. WHEN createPullRequest is called for Data Center, THE System SHALL create a pull request using the Data Center API format
3. WHEN pull request state filtering is requested, THE System SHALL map Cloud states (OPEN, MERGED, DECLINED) to Data Center states
4. WHEN pull request data is returned, THE System SHALL normalize it to match Cloud format

### Requirement 7: Pull Request Comment Operations Support

**User Story:** As a user, I want to add and manage comments on pull requests in Data Center, so that I can provide feedback on code changes.

#### Acceptance Criteria

1. WHEN addPullRequestComment is called for Data Center, THE System SHALL create comments using "/rest/api/1.0/projects/{project}/repos/{repo}/pull-requests/{id}/comments"
2. WHEN inline comments are requested, THE System SHALL map Cloud inline format to Data Center inline format
3. WHEN getPullRequestComments is called for Data Center, THE System SHALL fetch and normalize comment data
4. WHEN comment operations are performed, THE System SHALL handle Data Center-specific comment structure

### Requirement 8: Backward Compatibility

**User Story:** As an existing Cloud user, I want the server to continue working exactly as before, so that my existing configurations are not disrupted.

#### Acceptance Criteria

1. WHEN a Cloud URL is configured, THE System SHALL use the existing Cloud API implementation
2. WHEN Cloud authentication is provided, THE System SHALL authenticate using the existing Cloud authentication flow
3. WHEN Cloud API responses are received, THE System SHALL process them without additional transformation
4. WHEN all tests for Cloud functionality are run, THE System SHALL pass all existing test cases

### Requirement 9: Configuration Validation

**User Story:** As a user, I want clear error messages when my configuration is invalid, so that I can quickly fix configuration issues.

#### Acceptance Criteria

1. WHEN BITBUCKET_URL is missing, THE System SHALL throw an error with a descriptive message
2. WHEN authentication credentials are missing, THE System SHALL throw an error listing the required environment variables
3. WHEN an invalid URL format is provided, THE System SHALL throw an error with URL format guidance
4. WHEN configuration is validated successfully, THE System SHALL log the active configuration (without sensitive data)

### Requirement 10: Pagination Support for Data Center

**User Story:** As a user, I want pagination to work correctly with Data Center APIs, so that I can retrieve large result sets efficiently.

#### Acceptance Criteria

1. WHEN Data Center returns paginated results, THE System SHALL extract the "start" and "limit" parameters
2. WHEN fetching the next page from Data Center, THE System SHALL use the "start" parameter to request subsequent pages
3. WHEN the "all" parameter is true, THE System SHALL automatically fetch all pages up to the configured limit
4. WHEN pagination is complete, THE System SHALL return the total number of items fetched

### Requirement 11: Error Handling for Data Center

**User Story:** As a user, I want meaningful error messages when Data Center API calls fail, so that I can troubleshoot issues effectively.

#### Acceptance Criteria

1. WHEN a Data Center API returns a 401 error, THE System SHALL provide guidance on Personal Access Token configuration
2. WHEN a Data Center API returns a 404 error, THE System SHALL indicate that the resource was not found
3. WHEN a Data Center API returns a 403 error, THE System SHALL indicate insufficient permissions
4. WHEN network errors occur, THE System SHALL log the error details and return a user-friendly message

### Requirement 12: Feature Parity Assessment

**User Story:** As a developer, I want to know which MCP tools are supported for Data Center, so that I can set appropriate expectations for users.

#### Acceptance Criteria

1. WHEN the server starts with Data Center configuration, THE System SHALL log which tools are available
2. WHEN a tool is not supported by Data Center, THE System SHALL document this limitation in the tool description
3. WHEN a user attempts to use an unsupported tool, THE System SHALL return a clear error message
4. WHEN documentation is generated, THE System SHALL include a feature comparison table for Cloud vs Data Center
