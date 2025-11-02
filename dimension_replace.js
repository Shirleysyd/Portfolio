const fs = require('fs');
const path = require('path');

// Configuration
const INDEX_HTML_PATH = path.join(__dirname, 'index.html');
const OUTPUT_HTML_PATH = path.join(__dirname, 'index_modified.html');
const LOCAL_IMAGE_DIR = 'sscopy'; // Relative path to the local images

// Function to convert URL with dimensions to local file path
function convertUrlToLocalPath(url, dimension) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Get the directory and filename
    const dir = path.dirname(pathname);
    const filename = path.basename(pathname);

    // Build the new filename
    const ext = path.extname(filename);
    const nameWithoutExt = filename.slice(0, -ext.length);

    // Parse query parameters
    const queryParams = urlObj.search.replace('?', '').replace(/=/g, '_').replace(/&/g, '_');

    let finalFilename;
    if (queryParams) {
      finalFilename = `${nameWithoutExt}_${queryParams}_${dimension}${ext}`;
    } else {
      finalFilename = `${nameWithoutExt}_${dimension}${ext}`;
    }

    // Build the local path
    const relativePath = dir.substring(1); // Remove leading slash
    return `./${LOCAL_IMAGE_DIR}${dir}/${finalFilename}`;
  } catch (error) {
    console.error(`Error converting URL: ${url}`, error.message);
    return url; // Return original if conversion fails
  }
}

// Main function
function replaceImageUrls() {
  try {
    console.log('Reading index.html...');
    let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    let replacementCount = 0;

    // Pattern 1: Local sscopy paths with ?format=XXXw XXXw
    // Example: sscopy/content/.../image.png?format=100w 100w
    const localSrcsetPattern = /(sscopy\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|ico))\?format=(\d+w)\s+(\d+w)/gi;

    html = html.replace(localSrcsetPattern, (match, pathPart, formatDim, sizeDim) => {
      // Extract directory and filename
      const dir = path.dirname(pathPart);
      const filename = path.basename(pathPart);
      const ext = path.extname(filename);
      const nameWithoutExt = filename.slice(0, -ext.length);

      // Build new filename: originalname_format_XXXw_XXXw.ext
      const newFilename = `${nameWithoutExt}_format_${formatDim}_${sizeDim}${ext}`;
      const newPath = `${dir}/${newFilename}`;

      replacementCount++;

      console.log(`Replacing:`);
      console.log(`  FROM: ${match}`);
      console.log(`  TO:   ${newPath}`);
      console.log();

      return `${newPath}`;
    });

    // Pattern 2: https://images.squarespace-cdn.com/...?format=XXXw XXXw
    const cdnSrcsetPattern = /(https:\/\/images\.squarespace-cdn\.com\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|ico)[^\s]*)\s+(\d+w)/gi;

    html = html.replace(cdnSrcsetPattern, (match, url, dimension) => {
      const localPath = convertUrlToLocalPath(url, dimension);
      replacementCount++;

      console.log(`Replacing CDN URL:`);
      console.log(`  FROM: ${match}`);
      console.log(`  TO:   ${localPath}`);
      console.log();

      return `${localPath}`;
    });

    // Pattern 3: Regular CDN URLs with query parameters (without dimensions)
    const regularCdnUrlPattern = /(https:\/\/images\.squarespace-cdn\.com\/[^\s"']+\.(?:png|jpg|jpeg|gif|webp|ico)\?[^\s"']+)(?!\s+\d+w)/gi;

    html = html.replace(regularCdnUrlPattern, (match) => {
      try {
        const urlObj = new URL(match);
        const pathname = urlObj.pathname;
        const dir = path.dirname(pathname);
        const filename = path.basename(pathname);

        const localPath = `./${LOCAL_IMAGE_DIR}${dir}/${filename}`;
        replacementCount++;

        console.log(`Replacing regular CDN URL:`);
        console.log(`  FROM: ${match}`);
        console.log(`  TO:   ${localPath}`);
        console.log();

        return localPath;
      } catch (error) {
        return match;
      }
    });

    // Pattern 4: Simple CDN URLs without query parameters
    const simpleCdnUrlPattern = /https:\/\/images\.squarespace-cdn\.com\/(content\/[^\s"'?]+\.(?:png|jpg|jpeg|gif|webp|ico))(?=["\s'])/gi;

    html = html.replace(simpleCdnUrlPattern, (match, pathPart) => {
      const localPath = `./${LOCAL_IMAGE_DIR}/${pathPart}`;
      replacementCount++;

      console.log(`Replacing simple CDN URL:`);
      console.log(`  FROM: ${match}`);
      console.log(`  TO:   ${localPath}`);
      console.log();

      return localPath;
    });

    // Write the modified HTML
    console.log(`\nWriting modified HTML to ${OUTPUT_HTML_PATH}...`);
    fs.writeFileSync(OUTPUT_HTML_PATH, html, 'utf8');

    console.log(`\n=== Replacement Summary ===`);
    console.log(`Total replacements: ${replacementCount}`);
    console.log(`Output file: ${OUTPUT_HTML_PATH}`);
    console.log(`\nDone! You can now open ${OUTPUT_HTML_PATH} to use the local images.`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
replaceImageUrls();
