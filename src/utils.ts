import {createGoogleGenerativeAI} from "@ai-sdk/google";
import {password} from "@inquirer/prompts";
import fs from "node:fs";
import path from "node:path";
import {Mime} from 'mime';
import standardTypes from 'mime/types/standard.js';

const mime = new Mime(standardTypes);
mime.define({'application/typescript': ['ts']}, true);

export function getModel(apiKey: string) {
    const google = createGoogleGenerativeAI({
        apiKey: apiKey,
    });

    return google("gemini-2.0-flash-001");
}

export function getModelThinking(apiKey: string) {
    const google = createGoogleGenerativeAI({
        apiKey: apiKey,
    });

    return google("gemini-2.0-flash-thinking-exp-01-21");
}

export async function getApiKey(): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        return password({message: 'Insert Google API Key (this will not be stored anywhere)'});
    }
    return apiKey;
}

export type FileType = { content: string, path: string, relativePath: string, mimeType: string }

export function readSourceCode(sourceDir: string, relativeDir: string = ''): FileType[] {
    let resultFiles: Array<FileType> = []

    try {
        const files = fs.readdirSync(sourceDir);
        for (const file of files) {
            const filePath = path.join(sourceDir, file);
            const relativeFilePath = path.join(relativeDir, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                const fileContent = fs.readFileSync(filePath, "utf-8");

                resultFiles.push({
                    content: fileContent,
                    mimeType: mime.getType(filePath) ?? 'plain/txt',
                    path: filePath,
                    relativePath: relativeFilePath
                });

            } else if (stat.isDirectory()) {
                const subdirectoryCode = readSourceCode(filePath, relativeFilePath); // Recursive call for subdirectories
                resultFiles = [
                    ...resultFiles,
                    ...subdirectoryCode,
                ]
            }
        }

        return resultFiles;
    } catch (error: any) {
        throw new Error(
            `Error reading source directory: ${sourceDir}`,
            error.message,
        );
    }
}
