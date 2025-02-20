import {Command} from "commander";
import * as fs from "fs";
import * as path from "path";

import {generateObject, generateText} from "ai";
import {FileType, getApiKey, getModel, getModelThinking, readSourceCode} from "./utils";
import {DocsGenIndividualFile, DocsGenListFilesPrompt, DocsGenListFilesSystemPrompt} from "./prompts";
import {z} from "zod";
import {confirm} from '@inquirer/prompts';

const program = new Command();

program
    .name("aletria")
    .description(
        "aletria is a CLI tool designed to help developers integrate AI-driven features into their codebases",
    )
    .version("0.0.1");

async function generateDocumentation(
    files: FileType[],
    apiKey: string,
    outputDir: string,
): Promise<void> {
    console.log("Generating documentation plan...");

    const sourceFilesContent = [
        ...files.map((obj) => {
            return {
                type: 'file',
                data: Buffer.from(`File path: ${obj.relativePath}\nFile Mimetype: ${obj.mimeType}\n\n<file-content>${obj.content}</file-content>`, 'utf8'),
                mimeType: 'text/plain',
            }
        })
    ]

    const {text: documentationPlan} = await generateText({
        model: getModelThinking(apiKey),
        messages: [
            {role: "system", content: DocsGenListFilesSystemPrompt},
            {
                role: 'user',
                // @ts-ignore
                content: sourceFilesContent
            },
            {role: "user", content: DocsGenListFilesPrompt},
        ],
    });

    const {object} = await generateObject({
        model: getModel(apiKey),
        messages: [
            {role: "system", content: DocsGenListFilesSystemPrompt},
            {
                role: 'user',
                content: documentationPlan
            },
            {
                role: "user",
                content: `You received a documentation plan. Your task is to convert the raw text into a structured list of filepath and summary of contents for each file mentioned in the plan.`
            },
        ],
        schema: z.object({
            files: z
                .array(z.object({
                    filepath: z.string().describe('Documentation file path in markdown format'),
                    summary: z.string().describe('Summary of what the file should describe'),
                }))
                .describe('List of documentation files to be generated'),
        }),
    });

    const filesToGenerate = object.files.map((file) => {
        let newPath = file.filepath.toLowerCase().replaceAll(' ', '-');
        if (!newPath.endsWith('.md')) {
            newPath = newPath.split('.')[0] + '.md'
        }

        return {
            filepath: newPath, summary: file.summary
        }
    });

    console.log('\nFiles to be generated:');
    for (const file of filesToGenerate) {
        console.log(` - [${file.filepath}] ${file.summary}`);
    }
    console.log('')  // Line break

    if (!(await confirm({message: `Continue with generation? (${filesToGenerate.length} files)`}))) {
        console.log('Nothing was generated, exiting...');
        return
    }

    fs.mkdir(outputDir, { recursive: true }, (err) => {
        if (err) throw err;
    });

    const docFilesList = filesToGenerate.map((file) => `- ${file.filepath}`).join('\n');

    // let i = 0
    for (const file of filesToGenerate) {
        console.log(`Generating ${file.filepath}`)
        const {object: newDocFile} = await generateObject({
            model: getModel(apiKey),
            messages: [
                {role: "system", content: DocsGenIndividualFile(docFilesList)},
                {
                    role: 'user',
                    // @ts-ignore
                    content: sourceFilesContent
                },
                {
                    role: "user",
                    content: `Documentation file path: "${file.filepath}"\n\nSummary of what should be covered in the documentation file: "${file.summary}"\n`
                },
            ],
            schema: z.object({
                file: z
                    .string()
                    .describe('File content in markdown'),
            }),
        });

        fs.writeFileSync(path.join(outputDir, file.filepath), newDocFile.file);

        // i++;
        //
        // if (filesToGenerate.length-i > 0 && !(await confirm({message: `Continue with generation? (${filesToGenerate.length-i} files)`}))) {
        //     console.log(`${i} files generated, exiting...`);
        //     return
        // }
    }
}

program
    .command("generate-docs")
    .description("Generate documentation for your project")
    .option("-i <folder>", "Source folder", "./")
    .option("-o <folder>", "Output folder", "./docs")
    .action(async (options) => {
        console.log("Running generate-docs command...");
        const apiKey = await getApiKey();
        const sourceDir = options.i;
        const outputDir = options.o;

        console.log(`Source folder: ${sourceDir}`);
        console.log(`Output folder: ${outputDir}`);

        const files = readSourceCode(sourceDir);

        if (files.length > 100) {
            const shouldContinue = await confirm({message: `Detected a large amount of files (${files.length}) is this correct and should the generation continue?`});

            if (!shouldContinue) {
                console.log('Nothing was generated, exiting...');
                return
            }
        }

        await generateDocumentation(files, apiKey, outputDir);

        console.log('\nEverything generated, thanks for using aletria!')
    });

program.parse();
