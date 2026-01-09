# Data Capture

A modern, offline-first web application for collecting Ground Truth (GT) data in the field. This application allows users to create custom data collection campaigns, capture text, numbers, images, GPS locations, and polygons, and synchronize data directly to Google Sheets.

## Features

- **Custom Campaigns:** Define your own data schema with fields like Text, Number, Image, Location (Point), and Polygon.
- **Offline First:** All data is stored locally in the browser (IndexedDB) and persists without an internet connection.
- **Interactive Maps:** 
  - Visualize collected points and polygons on a map.
  - Drag-and-drop pin adjustment for precise location data.
  - Interactive polygon drawing and vertex editing.
- **Cloud Sync:** Synchronize collected data directly to your personal Google Sheets.
- **Data Export:** Export data to CSV or download a ZIP file containing a CSV and all captured images.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
4.  Open your browser to the URL shown in the terminal (usually `http://localhost:5173`).

### Building for Production

To create a production build:

```bash
npm run build
```

The output will be in the `dist` directory, ready to be deployed to static hosting services like GitHub Pages or Vercel.

## Google Sheets API Configuration

To enable the "Sync to Sheets" feature, you must configure Google Cloud credentials.

**Note:** This application runs entirely in the browser (Client-side). You need an OAuth 2.0 Client ID and an API Key.

### Step-by-Step Guide

1.  **Go to Google Cloud Console:**
    Visit [https://console.cloud.google.com/](https://console.cloud.google.com/).

2.  **Create a Project:**
    Click on the project dropdown at the top left and select **"New Project"**. Give it a name (e.g., "Data Capture App") and click Create.

3.  **Enable Sheets API:**
    -   In the search bar at the top, type **"Google Sheets API"**.
    -   Select it from the Marketplace results.
    -   Click **Enable**.

4.  **Create API Key:**
    -   Navigate to **APIs & Services** > **Credentials**.
    -   Click **+ CREATE CREDENTIALS** and select **API key**.
    -   Copy the generated key. This is your **Google API Key**.

5.  **Configure OAuth Consent Screen:**
    -   Navigate to **APIs & Services** > **OAuth consent screen**.
    -   Select **External** (unless you are a G-Suite user and want to restrict to your org).
    -   Click **Create**.
    -   Fill in the **App Information** (App name, User support email).
    -   Fill in **Developer contact information**.
    -   Click **Save and Continue**.
    -   (Optional) You can skip "Scopes" and "Test Users" for personal testing, but for production, you may need to publish the app.

6.  **Create OAuth Client ID:**
    -   Navigate back to **Credentials**.
    -   Click **+ CREATE CREDENTIALS** and select **OAuth client ID**.
    -   **Application type:** Select **Web application**.
    -   **Name:** Enter a name (e.g., "Data Capture Web Client").
    -   **Authorized JavaScript origins:** This is crucial. Add the URL where your app is running.
        -   For development: `http://localhost:5173` (or your specific local port).
        -   For production: `https://your-username.github.io` (or your domain).
    -   Click **Create**.
    -   Copy the **Client ID** (it looks like `123456-...apps.googleusercontent.com`).

7.  **Enter Credentials in App:**
    -   Open the Data Capture app.
    -   Click the **Settings** (gear icon) in the top right corner.
    -   Paste your **Client ID** and **API Key**.
    -   Click **Save Configuration**.

## Exporting Data

You can export your collected data at any time without setting up Google Sync.

1.  Open a Campaign.
2.  Click the **Export** button in the toolbar.
3.  **If you have images:** A `.zip` file will be downloaded containing:
    -   `[campaign_name]_data.csv`: Your data in spreadsheet format.
    -   `images/`: A folder containing all captured photos.
4.  **If you have no images:** A `.zip` file containing just the `.csv` will be downloaded.

## Usage Tips

-   **Location Accuracy:** When capturing GPS points, wait a moment for the accuracy (displayed in meters) to improve before saving.
-   **Polygons:** You can add points to a polygon by capturing your current GPS location or by tapping on the map. You can drag existing points to correct the shape.
-   **Storage:** Data is stored in your browser. Clearing your browser cache/data for the site will delete your unsynced campaigns. Always Sync or Export important data.
