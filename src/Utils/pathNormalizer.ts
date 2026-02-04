import { App, normalizePath, TFile } from 'obsidian';

/**
 * Resolves a link text to absolute file path using Obsidian's built-in resolution
 * This handles Obsidian's shortest path logic and file resolution
 * 
 * @param app - Obsidian App instance
 * @param linkText - The link text (e.g., "testfile", "folder/testfile", etc.)
 * @param sourcePath - The source file path for relative resolution (optional)
 * @returns Resolved absolute file path or original linkText if not found
 */
export function resolveLinkToPath(app: App, linkText: string, sourcePath: string = ""): string {
    if (!linkText || typeof linkText !== 'string') {
        return linkText;
    }
    
    // Clean the link text first
    let cleanLinkText = linkText.trim();
    
    // Remove markdown link brackets if present
    cleanLinkText = cleanLinkText.replace(/^\[\[+|\]\]+$/g, '');
    
    // Remove any trailing backslashes (from escaped pipes)
    cleanLinkText = cleanLinkText.replace(/\\+$/, '');
    
    // Use Obsidian's built-in link resolution
    const resolvedFile = app.metadataCache.getFirstLinkpathDest(cleanLinkText, sourcePath);
    
    if (resolvedFile instanceof TFile) {
        return resolvedFile.path;
    }
    
    // If Obsidian can't resolve it, fall back to manual normalization
    return normalizeFilePath(cleanLinkText);
}

/**
 * Normalizes various path formats to absolute path format
 * This is a fallback when Obsidian's resolution fails
 * 
 * @param rawPath - The raw path string from existingData
 * @returns Normalized absolute path (folder/filename.md format)
 */
export function normalizeFilePath(rawPath: string): string {
    if (!rawPath || typeof rawPath !== 'string') {
        return rawPath;
    }
    
    let normalizedPath = rawPath.trim();
    
    // Remove markdown link brackets if present
    normalizedPath = normalizedPath.replace(/^\[\[+|\]\]+$/g, '');
    
    // Handle relative paths starting with ./
    if (normalizedPath.startsWith('./')) {
        normalizedPath = normalizedPath.substring(2);
    }
    
    // Handle relative paths starting with ../
    // Note: This is a simple implementation, doesn't handle complex relative paths
    while (normalizedPath.startsWith('../')) {
        normalizedPath = normalizedPath.substring(3);
    }
    
    // Ensure .md extension if not present
    if (!normalizedPath.endsWith('.md') && normalizedPath.length > 0) {
        // Check if it's already a valid path without extension (Obsidian format)
        // Only add .md if it doesn't look like a folder path
        if (!normalizedPath.includes('/') || !normalizedPath.split('/').pop()?.includes('.')) {
            normalizedPath += '.md';
        }
    }
    
    // Remove leading slash if present (make it relative to vault root)
    if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.substring(1);
    }
    
    // Normalize the path using Obsidian's normalizePath
    return normalizePath(normalizedPath);
}

/**
 * Normalizes file path specifically for Obsidian link formats
 * Handles both [[path|title]] and [[path]] formats using Obsidian's resolution
 * 
 * @param app - Obsidian App instance
 * @param linkPath - Path extracted from Obsidian link
 * @param sourcePath - Source file path for context (optional)
 * @returns Normalized absolute path
 */
export function normalizeObsidianLinkPath(app: App, linkPath: string, sourcePath: string = ""): string {
    if (!linkPath || typeof linkPath !== 'string') {
        return linkPath;
    }
    
    let normalizedPath = linkPath.trim();
    
    // Remove any trailing backslashes (from escaped pipes)
    normalizedPath = normalizedPath.replace(/\\+$/, '');
    
    // Use Obsidian's resolution first
    return resolveLinkToPath(app, normalizedPath, sourcePath);
}