import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

// Define the fixed path for the "ONE json file"
// Saving to the root of the project for visibility
const DATA_FILE_PATH = path.join(process.cwd(), 'pictocal_data.json');

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const jsonString = JSON.stringify(data, null, 2);

        // Write the file to disk
        await fs.writeFile(DATA_FILE_PATH, jsonString, 'utf-8');

        return NextResponse.json({ success: true, message: 'File saved successfully' });
    } catch (error) {
        console.error('Save error:', error);
        return NextResponse.json({ success: false, message: 'Failed to save file' }, { status: 500 });
    }
}

export async function GET() {
    try {
        // Check if file exists
        try {
            await fs.access(DATA_FILE_PATH);
        } catch {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Read the file
        const fileContent = await fs.readFile(DATA_FILE_PATH, 'utf-8');
        const json = JSON.parse(fileContent);

        return NextResponse.json(json);
    } catch (error) {
        console.error('Load error:', error);
        return NextResponse.json({ success: false, message: 'Failed to load file' }, { status: 500 });
    }
}
