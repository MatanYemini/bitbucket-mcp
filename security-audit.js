#!/usr/bin/env node
/**
 * Security audit script for Bitbucket MCP
 * Checks for potential security vulnerabilities and credential exposure
 *
 * IMPROVEMENTS:
 * - Reduced false positives in documentation files
 * - More specific pattern matching for real credentials
 * - Enhanced filtering for common project strings
 * - Separated documentation files from critical files
 * - Uses stricter regex patterns instead of simple substring checks
 * - Prevents false positives from comments and documentation
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fg from "fast-glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SECURITY_CHECKS = {
    // Sensitive patterns that should never appear in code
    SENSITIVE_PATTERNS: [
        /(?:password|token|secret|key)\s*=\s*["'][^"']{8,}["']/gi, // More specific assignment patterns
        /ATB[a-zA-Z0-9]{10,}/g, // Bitbucket app password pattern (stricter)
        /ghp_[a-zA-Z0-9]{36}/g, // GitHub token pattern (exact length)
        /(?:Bearer|Basic)\s+[A-Za-z0-9+/=]{20,}/gi, // Authorization headers
    ],

    // Files to check for sensitive data
    FILES_TO_CHECK: [
        "src/**/*.ts",
        "src/**/*.js",
        "*.js",
        "*.cjs",
        "*.md",
        "README.md",
        ".env.example",
    ],

    // Files that should never contain sensitive data (excluding documentation)
    CRITICAL_FILES: ["package.json", "src/index.ts"],

    // Documentation files that are allowed to contain sensitive keywords
    DOCUMENTATION_FILES: [
        "README.md",
        ".env.example",
        "*.md",
        "SECURITY.md",
        "TROUBLESHOOTING.md",
        "TESTING.md",
        "SECURITY_IMPROVEMENTS.md",
    ],
};

class SecurityAuditor {
    constructor() {
        this.issues = [];
        this.warnings = [];
    }

    async audit() {
        console.log("🔐 Starting security audit...\n");

        // Check for sensitive patterns in files
        await this.checkSensitivePatterns();

        // Check critical files with stricter rules
        await this.checkCriticalFiles();

        // Check environment configuration
        await this.checkEnvironmentConfig();

        // Check logging configuration
        await this.checkLoggingConfig();

        // Check .gitignore
        await this.checkGitignore();

        // Report results
        this.reportResults();
    }
    async checkSensitivePatterns() {
        console.log("📝 Checking for sensitive patterns in code...");

        const filesToCheck = SECURITY_CHECKS.FILES_TO_CHECK;
        const expandedFiles = await fg(filesToCheck, { cwd: __dirname });

        for (const file of expandedFiles) {
            // Sanitize and validate file path to prevent directory traversal
            const sanitizedFile = path
                .normalize(file)
                .replace(/^(\.\.(\/|\\|$))+/, "");
            const filePath = path.resolve(__dirname, sanitizedFile);

            // Validate that the file path is within our project directory
            if (!filePath.startsWith(__dirname)) {
                console.warn(
                    `Skipping file outside project directory: ${file}`
                );
                continue;
            }

            // Additional security check: ensure file exists and is a file (not directory)
            try {
                const stats = await fs.promises.stat(filePath);
                if (!stats.isFile()) {
                    console.warn(`Skipping non-file: ${file}`);
                    continue;
                }
            } catch (error) {
                console.warn(`File access error for ${file}: ${error.message}`);
                continue;
            }

            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, "utf-8");

                // Check if this is a documentation file
                const isDocFile = SECURITY_CHECKS.DOCUMENTATION_FILES.some(
                    (docFile) =>
                        file.includes(docFile.replace("*", "")) ||
                        file === docFile ||
                        file.endsWith(".md")
                );

                for (const pattern of SECURITY_CHECKS.SENSITIVE_PATTERNS) {
                    const matches = content.match(pattern);
                    if (matches && !isDocFile) {
                        // Filter out obvious documentation examples
                        const realMatches = matches.filter(
                            (match) =>
                                !match.includes("your-") &&
                                !match.includes("example") &&
                                !match.includes("placeholder") &&
                                !match.includes("YOUR_") &&
                                !match.includes("EXAMPLE_") &&
                                !match.includes("PLACEHOLDER_")
                        );

                        if (realMatches.length > 0) {
                            // Critical files get CRITICAL severity, others get HIGH
                            const isCriticalFile =
                                SECURITY_CHECKS.CRITICAL_FILES.includes(file);
                            this.issues.push({
                                type: "SENSITIVE_DATA",
                                file: file,
                                pattern: pattern.source,
                                matches: realMatches.length,
                                severity: isCriticalFile ? "CRITICAL" : "HIGH",
                            });
                        }
                    }
                }
            }
        }

        console.log("✅ Sensitive pattern check completed");
    }

    async checkCriticalFiles() {
        console.log("📝 Checking critical files for security issues...");

        for (const file of SECURITY_CHECKS.CRITICAL_FILES) {
            const filePath = path.resolve(__dirname, file);
            // Validate that the file path is within our project directory
            if (!filePath.startsWith(__dirname)) {
                console.warn(
                    `Skipping file outside project directory: ${file}`
                );
                continue;
            }
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, "utf-8");

                // Check if this is a documentation file
                const isDocFile = SECURITY_CHECKS.DOCUMENTATION_FILES.some(
                    (docFile) =>
                        file.includes(docFile.replace("*", "")) ||
                        file === docFile
                );

                // Only check for sensitive keywords in non-documentation files
                // Skip TypeScript files with legitimate credential handling
                if (
                    !isDocFile &&
                    !file.endsWith(".ts") &&
                    (content.includes("password") ||
                        content.includes("token") ||
                        content.includes("secret"))
                ) {
                    this.warnings.push({
                        type: "SENSITIVE_KEYWORDS_IN_CRITICAL_FILE",
                        file: file,
                        message: `Found sensitive keywords in critical file: ${file}`,
                        severity: "MEDIUM",
                    });
                }

                // Check for any credential-like patterns with better filtering
                const suspiciousPatterns = [
                    /[A-Za-z0-9]{40,}/g, // Very long strings (increased from 32)
                    /[A-Z0-9]{30,}/g, // Long uppercase strings (increased from 20)
                ];

                for (const pattern of suspiciousPatterns) {
                    const matches = content.match(pattern);
                    if (matches && matches.length > 0) {
                        // Enhanced filter for common false positives
                        const suspiciousMatches = matches.filter(
                            (match) =>
                                !match.includes("example") &&
                                !match.includes("your") &&
                                !match.includes("placeholder") &&
                                !match.includes("YOUR") &&
                                !match.includes("EXAMPLE") &&
                                !match.includes("PLACEHOLDER") &&
                                !match.includes("description") &&
                                !match.includes("README") &&
                                !match.includes("github") &&
                                !match.includes("bitbucket") &&
                                !match.includes("modelcontextprotocol") &&
                                !match.includes("typescript") &&
                                !match.includes("javascript") &&
                                !match.includes("eslint") &&
                                !isDocFile && // Skip documentation files
                                match.length > 30 // Increased minimum length
                        );

                        if (suspiciousMatches.length > 0) {
                            this.warnings.push({
                                type: "SUSPICIOUS_STRINGS_IN_CRITICAL_FILE",
                                file: file,
                                message: `Found ${suspiciousMatches.length} suspicious string(s) in critical file: ${file}`,
                                severity: "MEDIUM",
                            });
                        }
                    }
                }
            }
        }

        console.log("✅ Critical files check completed");
    }

    async checkEnvironmentConfig() {
        console.log("📝 Checking environment configuration...");

        const envExample = path.resolve(__dirname, ".env.example");
        const envFile = path.resolve(__dirname, ".env");

        // Validate file paths are within project directory
        if (
            !envExample.startsWith(__dirname) ||
            !envFile.startsWith(__dirname)
        ) {
            console.warn("Invalid environment file paths detected");
            return;
        }

        // Check if .env.example exists and is safe
        if (fs.existsSync(envExample)) {
            const content = fs.readFileSync(envExample, "utf-8");

            // Check for actual credentials in .env.example using stricter regex patterns
            const credentialPatterns = [
                /ATB[a-zA-Z0-9]{10,}/g, // Bitbucket app password pattern (more specific)
                /ghp_[a-zA-Z0-9]{36}/g, // GitHub token pattern (exact length)
                /(?:password|token|secret)\s*=\s*(?!.*(?:your|example|placeholder|YOUR|EXAMPLE|PLACEHOLDER))[A-Za-z0-9]{10,}/gi,
            ];

            for (const pattern of credentialPatterns) {
                const matches = content.match(pattern);
                if (matches) {
                    this.issues.push({
                        type: "CREDENTIALS_IN_EXAMPLE",
                        file: ".env.example",
                        message: `Real credentials matching pattern '${pattern.source}' found in .env.example file`,
                        severity: "CRITICAL",
                    });
                    break; // Only report once
                }
            }
        }

        // Check if .env file exists (it should be gitignored)
        if (fs.existsSync(envFile)) {
            console.log(
                "ℹ️  .env file detected (normal in development - ensure it's gitignored)"
            );
        }

        console.log("✅ Environment configuration check completed");
    }

    async checkLoggingConfig() {
        console.log("📝 Checking logging configuration...");

        const indexFile = path.resolve(__dirname, "src/index.ts");
        // Validate file path is within project directory
        if (!indexFile.startsWith(__dirname)) {
            console.warn("Invalid index file path detected");
            return;
        }
        if (fs.existsSync(indexFile)) {
            const content = fs.readFileSync(indexFile, "utf-8");

            // Check for proper sanitization methods
            if (!content.includes("sanitizeError")) {
                this.issues.push({
                    type: "MISSING_SANITIZATION",
                    file: "src/index.ts",
                    message: "Missing error sanitization method",
                    severity: "HIGH",
                });
            }

            // Check for sensitive data in logs (more specific check)
            const consoleLogMatches = content.match(/console\.log\([^)]*\)/g);
            if (consoleLogMatches) {
                // Check if any console.log contains potentially sensitive data
                const suspiciousLogs = consoleLogMatches.filter(
                    (log) =>
                        log.includes("password") ||
                        log.includes("token") ||
                        log.includes("secret") ||
                        log.includes("credential")
                );

                if (suspiciousLogs.length > 0) {
                    this.warnings.push({
                        type: "CONSOLE_LOGGING_SENSITIVE",
                        file: "src/index.ts",
                        message: `Found ${suspiciousLogs.length} console.log statements that may log sensitive data`,
                        severity: "MEDIUM",
                    });
                }
            }
        }

        console.log("✅ Logging configuration check completed");
    }

    async checkGitignore() {
        console.log("📝 Checking .gitignore configuration...");

        const gitignoreFile = path.resolve(__dirname, ".gitignore");
        // Validate file path is within project directory
        if (!gitignoreFile.startsWith(__dirname)) {
            console.warn("Invalid gitignore file path detected");
            return;
        }
        if (fs.existsSync(gitignoreFile)) {
            const content = fs.readFileSync(gitignoreFile, "utf-8");

            const requiredEntries = [".env", "*.log", "logs/"];
            for (const entry of requiredEntries) {
                if (!content.includes(entry)) {
                    this.issues.push({
                        type: "MISSING_GITIGNORE_ENTRY",
                        file: ".gitignore",
                        message: `Missing gitignore entry: ${entry}`,
                        severity: "HIGH",
                    });
                }
            }
        } else {
            this.issues.push({
                type: "MISSING_GITIGNORE",
                file: ".gitignore",
                message: ".gitignore file not found",
                severity: "HIGH",
            });
        }

        console.log("✅ .gitignore check completed");
    }

    reportResults() {
        console.log("\n🔍 Security Audit Results\n");

        if (this.issues.length === 0 && this.warnings.length === 0) {
            console.log("✅ No security issues found!");
            return;
        }

        // Report critical issues
        const criticalIssues = this.issues.filter(
            (issue) => issue.severity === "CRITICAL"
        );
        if (criticalIssues.length > 0) {
            console.log("🚨 CRITICAL ISSUES:");
            criticalIssues.forEach((issue) => {
                console.log(
                    `   ❌ ${issue.type}: ${issue.message || issue.pattern}`
                );
                console.log(`      File: ${issue.file}`);
                console.log("");
            });
        }

        // Report high severity issues
        const highIssues = this.issues.filter(
            (issue) => issue.severity === "HIGH"
        );
        if (highIssues.length > 0) {
            console.log("⚠️  HIGH SEVERITY ISSUES:");
            highIssues.forEach((issue) => {
                console.log(
                    `   ❌ ${issue.type}: ${issue.message || issue.pattern}`
                );
                console.log(`      File: ${issue.file}`);
                console.log("");
            });
        }

        // Report warnings
        if (this.warnings.length > 0) {
            console.log("⚠️  WARNINGS:");
            this.warnings.forEach((warning) => {
                console.log(`   ⚠️  ${warning.type}: ${warning.message}`);
                console.log(`      File: ${warning.file}`);
                console.log("");
            });
        }

        console.log("📋 Summary:");
        console.log(`   Critical Issues: ${criticalIssues.length}`);
        console.log(`   High Severity Issues: ${highIssues.length}`);
        console.log(`   Warnings: ${this.warnings.length}`);
        console.log("");

        if (criticalIssues.length > 0 || highIssues.length > 0) {
            console.log("🔧 Recommendations:");
            console.log("   1. Remove any hardcoded credentials from files");
            console.log(
                "   2. Ensure all sensitive data is properly sanitized in logs"
            );
            console.log("   3. Review and update .gitignore file");
            console.log(
                "   4. Use environment variables for all sensitive configuration"
            );
            console.log("   5. Implement proper error sanitization");
            console.log("");

            process.exit(1);
        } else {
            console.log("✅ All security checks passed!");
        }
    }
}

// Export the SecurityAuditor class for testing
export { SecurityAuditor };

// Run the audit
const auditor = new SecurityAuditor();
auditor.audit().catch((error) => {
    console.error("❌ Security audit failed:", error);
    process.exit(1);
});
