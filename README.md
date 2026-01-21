# Cover Letter Generator

A React web application for creating customized cover letters using AI. Upload your CV/experience documents, paste job descriptions, and get AI-generated cover letters you can iteratively refine.

## Features

- **Profile Management**: Store your personal information and upload documents (CV, experience notes)
- **AI Cover Letter Generation**: Uses Anthropic's Claude API to generate personalized cover letters
- **Iterative Refinement**: Chat interface to refine the generated letter with follow-up requests
- **Local Storage**: All data stored locally using IndexedDB (no server required)
- **PIN Protection**: Optionally protect your data and API key with a PIN

## Tech Stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- Dexie.js (IndexedDB wrapper)
- Zustand (state management)
- React Router v7

## Installation

**Important**: If you're experiencing npm install errors on Windows, try copying this folder to a path without spaces or special characters (e.g., `C:\projects\cover-letter-generator`).

```bash
# Navigate to the project directory
cd cover-letter-generator

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

1. **Set up your API key**: Go to Settings and enter your Anthropic API key (get one from [console.anthropic.com](https://console.anthropic.com/settings/keys))

2. **Create your profile**: Go to Profile and fill in your information

3. **Upload documents**: Upload your CV and any other relevant experience documents

4. **Generate a cover letter**:
   - Go to the Generate page
   - Enter the job title and company name
   - Paste the job description
   - Click "Generate Cover Letter"

5. **Refine your letter**: Use the chat interface to make adjustments:
   - "Make it more formal"
   - "Emphasize my leadership experience"
   - "Make it shorter"

## Project Structure

```
src/
├── components/
│   ├── Layout/           # App shell, navigation, PIN lock
│   ├── Profile/          # Profile form, document upload
│   ├── CoverLetter/      # Generation form, chat refinement, history
│   └── Settings/         # API key config, PIN setup
├── services/
│   ├── claude.ts         # Anthropic API integration
│   ├── db.ts             # Dexie/IndexedDB operations
│   └── documentParser.ts # Parse uploaded files
├── stores/
│   └── useStore.ts       # Zustand state management
├── types/
│   └── index.ts          # TypeScript interfaces
└── utils/
    └── crypto.ts         # PIN hashing and encryption
```

## Security Notes

- Your API key is stored locally and can be encrypted with a PIN
- All data stays in your browser's IndexedDB
- No data is sent to any server except Anthropic's API for generation

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Troubleshooting

### npm install fails on Windows

This can happen due to:
1. OneDrive/cloud sync interference
2. Paths with spaces or special characters
3. Antivirus scanning

Solutions:
1. Copy the project to a simple path like `C:\projects\cover-letter`
2. Pause OneDrive sync temporarily
3. Run as administrator
4. Try `npm install --legacy-peer-deps`

### PDF parsing not working

If PDF text extraction fails, you can:
1. Copy and paste the text directly from your PDF
2. Save your CV as a `.txt` file first
