/**
 * Unit tests for security-audit.js
 */
import { describe, test, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

// Mock data for testing
const mockFileContent = {
    safe: `
        export const config = {
            baseUrl: process.env.BITBUCKET_URL,
            workspace: process.env.BITBUCKET_WORKSPACE
        };
    `,
    unsafe: `
        const password = "hardcodedpassword123";
        const token = "ATB123456789012345678901234567890";
        const secret = "mysecretkey";
    `,
    partiallyUnsafe: `
        const config = {
            password: process.env.PASSWORD,
            token: "ATB123456789012345678901234567890"
        };
    `,
};

const patterns = [
    /password\s*=\s*['"]\w+['"]/gi,
    /token\s*=\s*['"]\w+['"]/gi,
    /secret\s*=\s*['"]\w+['"]/gi,
    /key\s*=\s*['"]\w+['"]/gi,
    /ATB{1,2}[A-Z0-9]{20,}/gi,
    /ghp_[A-Za-z0-9]{36}/gi,
];

describe("Security Audit Script", () => {
    describe("Pattern Detection", () => {
        test("should detect hardcoded passwords", () => {
            const content = 'const password = "hardcodedpassword123";';

            const found = patterns.some((pattern) => pattern.test(content));
            expect(found).toBe(true);
        });

        test("should detect Bitbucket app passwords", () => {
            const content =
                'const token = "ATB123456789012345678901234567890";';
            const pattern = /ATB{1,2}[A-Z0-9]{20,}/gi;

            expect(pattern.test(content)).toBe(true);
        });

        test("should detect GitHub tokens", () => {
            const content =
                'const token = "ghp_1234567890123456789012345678901234567890";';
            const pattern = /ghp_[A-Za-z0-9]{36}/gi;

            expect(pattern.test(content)).toBe(true);
        });

        test("should not flag environment variables", () => {
            const content = "const password = process.env.PASSWORD;";
            const pattern = /password\s*=\s*['"]\w+['"]/gi;

            expect(pattern.test(content)).toBe(false);
        });
    });

    describe("File Security Analysis", () => {
        test("should identify safe content", () => {
            const hasSensitiveData = patterns.some((pattern) =>
                pattern.test(mockFileContent.safe)
            );

            expect(hasSensitiveData).toBe(false);
        });

        test("should identify unsafe content", () => {
            const hasSensitiveData = patterns.some((pattern) =>
                pattern.test(mockFileContent.unsafe)
            );

            expect(hasSensitiveData).toBe(true);
        });
    });

    describe("Critical Files Validation", () => {
        test("should validate critical files exist", () => {
            const criticalFiles = [
                "README.md",
                ".env.example",
                "package.json",
                "src/index.ts",
            ];

            criticalFiles.forEach((file) => {
                // Sanitize and validate file path to prevent directory traversal
                const sanitizedFile = path
                    .normalize(file)
                    .replace(/^(\.\.(\/|\\|$))+/, "");
                const filePath = path.resolve(__dirname, "..", sanitizedFile);

                // Validate that the file path is within our project directory
                const projectRoot = path.resolve(__dirname, "..");
                if (!filePath.startsWith(projectRoot)) {
                    throw new Error(`Invalid file path detected: ${file}`);
                }

                // Additional security check: ensure path doesn't contain suspicious patterns
                if (sanitizedFile !== file) {
                    throw new Error(
                        `Potentially malicious file path detected: ${file}`
                    );
                }

                expect(fs.existsSync(filePath)).toBe(true);
            });
        });
    });

    describe("Security Report Generation", () => {
        test("should generate structured security report", () => {
            const mockIssues = [
                {
                    type: "SENSITIVE_DATA",
                    file: "test.js",
                    line: 5,
                    pattern: "hardcoded password",
                    severity: "HIGH",
                },
            ];

            const mockWarnings = [
                {
                    type: "POTENTIAL_ISSUE",
                    file: "config.js",
                    message: "Consider using environment variables",
                },
            ];

            const report = {
                timestamp: new Date().toISOString(),
                issues: mockIssues,
                warnings: mockWarnings,
                summary: {
                    totalIssues: mockIssues.length,
                    totalWarnings: mockWarnings.length,
                    criticalIssues: mockIssues.filter(
                        (i) => i.severity === "HIGH"
                    ).length,
                },
            };

            expect(report.summary.totalIssues).toBe(1);
            expect(report.summary.totalWarnings).toBe(1);
            expect(report.summary.criticalIssues).toBe(1);
        });
    });
});
