const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

// Configuration
const INDEX_HTML_PATH = path.join(__dirname, 'vita.html');
const OUTPUT_DIR = path.join(__dirname, 'sscopy');

// Read and parse HTML file
function extractImageUrls(html) {
  const allUrls = [];

  // Pattern 1: Regular URLs
  const urlPattern = /https:\/\/images\.squarespace-cdn\.com\/[^"'\s]*/g;
  const regularUrls = html.match(urlPattern) || [];

  regularUrls.forEach(url => {
    const cleanUrl = url.replace(/[>)\]]+$/, '');
    if (cleanUrl !== 'https://images.squarespace-cdn.com/' &&
        cleanUrl !== 'https://images.squarespace-cdn.com' &&
        cleanUrl.includes('.')) {
      allUrls.push({ url: cleanUrl, dimensions: null });
    }
  });

  // Pattern 2: srcset pattern with dimensions (URL + space + dimension)
  // Example: https://...png?format=100w 100w
  const srcsetPattern = /(https:\/\/images\.squarespace-cdn\.com\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|ico)[^\s]*)\s+(\d+w)/gi;
  let match;

  while ((match = srcsetPattern.exec(html)) !== null) {
    const url = match[1];
    const dimension = match[2];
    allUrls.push({ url, dimensions: dimension });
  }

  // Remove duplicates based on URL
  const uniqueUrls = new Map();
  allUrls.forEach(item => {
    const key = `${item.url}_${item.dimensions || 'default'}`;
    if (!uniqueUrls.has(key)) {
      uniqueUrls.set(key, item);
    }
  });

  return Array.from(uniqueUrls.values());
}

// Download a file
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(outputPath);

    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`Redirecting to: ${redirectUrl}`);
        return downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete the file if download failed
      reject(err);
    });
  });
}

// Convert URL to local file path, preserving folder structure
function urlToLocalPath(urlString, dimensions) {
  const urlObj = new URL(urlString);
  const pathname = urlObj.pathname;

  // Get the directory and filename
  const dir = path.dirname(pathname);
  const filename = path.basename(pathname);

  // If there are dimensions, modify the filename
  let finalFilename = filename;
  if (dimensions) {
    const ext = path.extname(filename);
    const nameWithoutExt = filename.slice(0, -ext.length);

    // Parse query parameters to include in filename
    const queryParams = urlObj.search.replace('?', '').replace(/=/g, '_').replace(/&/g, '_');

    if (queryParams) {
      finalFilename = `${nameWithoutExt}_${queryParams}_${dimensions}${ext}`;
    } else {
      finalFilename = `${nameWithoutExt}_${dimensions}${ext}`;
    }
  }

  // Remove leading slash and join with output directory
  const relativePath = dir.substring(1);
  return path.join(OUTPUT_DIR, relativePath, finalFilename);
}

// Main function
async function main() {
  try {
    console.log('Reading index.html...');
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    console.log('Extracting image URLs...');
    const urlItems = extractImageUrls(html);
    console.log(`Found ${urlItems.length} unique images to download.\n`);

    // Download all images
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urlItems.length; i++) {
      const { url, dimensions } = urlItems[i];
      const localPath = urlToLocalPath(url, dimensions);

      try {
        const displayUrl = dimensions ? `${url} ${dimensions}` : url;
        console.log(`[${i + 1}/${urlItems.length}] Downloading: ${displayUrl}`);
        await downloadFile(url, localPath);
        console.log(`  ✓ Saved to: ${localPath}\n`);
        successCount++;
      } catch (error) {
        console.error(`  ✗ Failed: ${error.message}\n`);
        failCount++;
      }
    }

    console.log('\n=== Download Summary ===');
    console.log(`Total: ${urlItems.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
